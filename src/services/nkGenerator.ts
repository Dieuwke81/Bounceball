import { Player, NKSession, NKRound, NKMatch } from '../types';

type PairKey = string;
const pairKey = (a: number, b: number): PairKey => [a, b].sort().join('-');

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> {
  const playersPerMatch = playersPerTeam * 2;
  const totalSpots = players.length * matchesPerPlayer;
  const totalMatches = totalSpots / playersPerMatch;

  if (!Number.isInteger(totalMatches)) {
    throw new Error(`Onmogelijk schema: ${totalSpots} plekken verdeeld over ${playersPerMatch} spelers per match komt niet uit.`);
  }

  const totalRounds = Math.ceil(totalMatches / hallNames.length);
  
  // State bijhouden
  let playedCount = new Map<number, number>();
  let together = new Map<PairKey, number>();
  let against = new Map<PairKey, number>();
  let allRounds: NKRound[] = [];

  const resetState = () => {
    playedCount = new Map(players.map(p => [p.id, 0]));
    together = new Map();
    against = new Map();
    allRounds = [];
  };

  let globalAttempt = 0;
  while (globalAttempt < 50) { // Maximaal 50 pogingen voor het hele toernooi
    globalAttempt++;
    resetState();
    let success = true;

    for (let r = 1; r <= totalRounds; r++) {
      onProgress(`Poging ${globalAttempt}: Ronde ${r}/${totalRounds} genereren...`);
      await delay(5); // UI thread ademruimte

      let roundAttempt = 0;
      let roundMatches: NKMatch[] | null = null;

      while (roundAttempt < 100) { // Maximaal 100 pogingen per ronde
        roundAttempt++;
        roundMatches = tryGenerateRound(r, players, hallNames, playedCount, matchesPerPlayer, playersPerTeam, together, against);
        if (roundMatches) break;
      }

      if (!roundMatches) {
        success = false;
        break;
      }

      // Ronde toevoegen en stats updaten
      const usedInRound = new Set(roundMatches.flatMap(m => [...m.team1, ...m.team2].map(p => p.id)));
      allRounds.push({
        roundNumber: r,
        matches: roundMatches,
        restingPlayers: players.filter(p => !usedInRound.has(p.id))
      });
      
      // Update playedCount
      roundMatches.forEach(m => {
        [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1));
      });
    }

    if (success) {
      return {
        competitionName,
        hallNames,
        playersPerTeam,
        totalRounds: allRounds.length,
        rounds: allRounds,
        standings: players.map(p => ({
          playerId: p.id,
          playerName: p.name,
          points: 0,
          goalsFor: 0,
          goalDifference: 0,
          matchesPlayed: 0
        })),
        isCompleted: false
      };
    }
  }

  throw new Error("Het lukt niet om een eerlijk schema te vinden. Probeer het aantal wedstrijden p.p. of het aantal zalen aan te passen.");
}

function tryGenerateRound(
  roundNr: number,
  allPlayers: Player[],
  halls: string[],
  playedCount: Map<number, number>,
  maxMatches: number,
  playersPerTeam: number,
  together: Map<string, number>,
  against: Map<string, number>
): NKMatch[] | null {
  const playersPerMatch = playersPerTeam * 2;
  
  // 1. Wie moeten er deze ronde spelen? (mensen met minste wedstrijden eerst + random factor)
  const pool = [...allPlayers]
    .filter(p => playedCount.get(p.id)! < maxMatches)
    .sort((a, b) => (playedCount.get(a.id)! - playedCount.get(b.id)!) || (Math.random() - 0.5));

  const numMatches = Math.min(halls.length, Math.floor(pool.length / playersPerMatch));
  const matches: NKMatch[] = [];
  const usedThisRound = new Set<number>();

  for (let h = 0; h < numMatches; h++) {
    const matchPool = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
    if (matchPool.length < playersPerMatch) return null;

    // Sorteer op rating voor Snake-verdeling
    matchPool.sort((a, b) => b.rating - a.rating);
    
    const team1: Player[] = [];
    const team2: Player[] = [];
    
    // Snake distribution: T1, T2, T2, T1, T1, T2, T2, T1...
    matchPool.forEach((p, i) => {
      const snake = [0, 1, 1, 0, 0, 1, 1, 0];
      if (snake[i % 8] === 0) team1.push(p); else team2.push(p);
    });

    // Check balans (max 0.7 rating verschil tussen teams)
    const avg1 = team1.reduce((s, p) => s + p.rating, 0) / team1.length;
    const avg2 = team2.reduce((s, p) => s + p.rating, 0) / team2.length;
    if (Math.abs(avg1 - avg2) > 0.7) return null;

    // Check keepers (max 1 per team)
    if (team1.filter(p => p.isKeeper).length > 1 || team2.filter(p => p.isKeeper).length > 1) return null;

    // Check "al bij elkaar gezeten" (optioneel, voor betere mix)
    // We laten dit hier even soepel voor de snelheid.

    matchPool.forEach(p => usedThisRound.add(p.id));

    // Reserves en scheids uit de mensen die NIET spelen deze ronde
    const roundReserves = allPlayers.filter(p => !usedThisRound.has(p.id)).sort((a, b) => b.rating - a.rating);
    
    matches.push({
      id: `r${roundNr}h${h}`,
      hallName: halls[h],
      team1, team2,
      team1Score: 0, team2Score: 0,
      isPlayed: false,
      subHigh: roundReserves[0] || null,
      subLow: roundReserves[roundReserves.length - 1] || null,
      referee: roundReserves[Math.floor(roundReserves.length / 2)] || null
    });
  }

  return matches;
}
