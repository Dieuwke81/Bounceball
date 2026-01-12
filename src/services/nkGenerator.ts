import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Berekent een "Sociale Strafscore" voor een sessie.
 * Hoe vaker dezelfde spelers samen of tegen elkaar spelen, hoe hoger de score.
 * We streven naar de LAAGSTE score voor de beste verdeling.
 */
function calculateSocialScore(session: NKSession): number {
  const pairCounts = new Map<string, number>();

  session.rounds.forEach(r => r.matches.forEach(m => {
    const allPlayers = [...m.team1, ...m.team2];
    for (let i = 0; i < allPlayers.length; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const key = [allPlayers[i].id, allPlayers[j].id].sort().join('-');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }));

  // Kwadratische som: 2x dezelfde ontmoeting weegt zwaarder (4) dan 2x een unieke (1+1=2)
  let score = 0;
  pairCounts.forEach(count => {
    score += Math.pow(count, 2);
  });
  return score;
}

function getBestTeamSplit(players: Player[], playersPerTeam: number, targetDiff: number) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  function combine(start: number, team1: Player[]) {
    if (team1.length === playersPerTeam) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const diff = Math.abs(avg1 - avg2);

      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      if (k1 <= 1 && k2 <= 1 && avg1 >= 4.0 && avg2 >= 4.0) {
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = { t1: [...team1], t2: [...team2] };
        }
      }
      return;
    }
    for (let i = start; i < players.length; i++) {
      team1.push(players[i]);
      combine(i + 1, team1);
      team1.pop();
      if (bestDiff <= targetDiff) return; 
    }
  }

  combine(0, []);
  return { split: bestSplit, diff: bestDiff };
}

/**
 * Genereert één valide toernooi-versie.
 */
async function generateSingleVersion(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<NKSession | null> {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatches / hallNames.length);

  const playedCount = new Map(players.map(p => [p.id, 0]));
  const allRounds: NKRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    let roundMatches: NKMatch[] = [];
    let roundSuccess = false;
    
    for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
      const target = rAttempt < 50 ? 0.3 : 0.4;
      const usedThisRound = new Set<number>();
      const currentMatches: NKMatch[] = [];

      const pool = [...players]
        .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
        .sort(() => Math.random() - 0.5); // Randomize pool voor variatie tussen versies

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
      
      try {
        const roundPool = pool.slice(0, mInRound * playersPerMatch);
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = roundPool.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
          const { split } = getBestTeamSplit(mPlayers, playersPerTeam, target);
          if (!split) throw new Error("Fail");

          mPlayers.forEach(p => usedThisRound.add(p.id));
          currentMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h],
            team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        let restingPool = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        for (let m of currentMatches) {
          m.subLow = restingPool.shift()!;
          m.subHigh = restingPool.pop()!;
          const midIdx = Math.floor(restingPool.length / 2);
          m.referee = restingPool.splice(midIdx, 1)[0];
        }

        roundMatches = currentMatches;
        roundSuccess = true;
        break; 
      } catch (e) { continue; }
    }

    if (roundSuccess) {
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
      allRounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: [] });
    } else return null;
  }

  return {
    competitionName, hallNames, playersPerTeam, totalRounds: allRounds.length,
    rounds: allRounds, standings: players.map(p => ({ playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 })),
    isCompleted: false
  };
}

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let attempts = 0;

  onProgress("Start optimalisatie...");

  while (validVersions.length < 10 && attempts < 500) {
    attempts++;
    const version = await generateSingleVersion(players, hallNames, matchesPerPlayer, playersPerTeam, competitionName);
    
    if (version) {
      validVersions.push(version);
      onProgress(`Versie ${validVersions.length}/10 gevonden...`);
      await delay(10);
    }
    
    if (attempts % 20 === 0) {
      onProgress(`Zoeken naar combinaties (poging ${attempts})...`);
      await delay(1);
    }
  }

  if (validVersions.length === 0) {
    throw new Error("Het lukt niet om een valide schema te vinden. Controleer de ratings of het aantal spelers.");
  }

  // Kies de versie met de laagste sociale strafscore (minste dubbele ontmoetingen)
  onProgress("Beste schema selecteren...");
  return validVersions.reduce((best, current) => 
    calculateSocialScore(current) < calculateSocialScore(best) ? current : best
  );
}
