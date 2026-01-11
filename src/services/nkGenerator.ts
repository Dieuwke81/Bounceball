import { Player, NKSession, NKRound, NKMatch } from '../types';

type PairKey = string;
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
  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;

  if (!Number.isInteger(totalMatches)) {
    throw new Error("Dit aantal spelers komt niet uit met het aantal wedstrijden p.p.");
  }

  const totalRounds = Math.ceil(totalMatches / hallNames.length);
  let session: NKSession | null = null;
  let attempt = 0;

  while (!session && attempt < 50) {
    attempt++;
    onProgress(`Poging ${attempt}: Schema berekenen...`);
    await delay(10);

    try {
      const playedCount = new Map(players.map(p => [p.id, 0]));
      const allRounds: NKRound[] = [];

      for (let r = 1; r <= totalRounds; r++) {
        const roundMatches: NKMatch[] = [];
        const usedThisRound = new Set<number>();
        
        // Welke spelers MOETEN spelen (minst gespeeld eerst)
        const pool = [...players]
          .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
          .sort((a, b) => (playedCount.get(a.id)! - playedCount.get(b.id)!) || (Math.random() - 0.5));

        const matchesInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));

        for (let h = 0; h < matchesInRound; h++) {
          const matchPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
          if (matchPlayers.length < playersPerMatch) break;

          matchPlayers.forEach(p => usedThisRound.add(p.id));
          matchPlayers.sort((a, b) => b.rating - a.rating);

          const team1: Player[] = [];
          const team2: Player[] = [];
          
          // Snake distribution (1,4,5,8 vs 2,3,6,7)
          matchPlayers.forEach((p, i) => {
            const snake = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
            if (snake[i % 10] === 0) team1.push(p); else team2.push(p);
          });

          // Balans check (rating mag niet te ver uit elkaar liggen)
          const avg1 = team1.reduce((s, p) => s + p.rating, 0) / team1.length;
          const avg2 = team2.reduce((s, p) => s + p.rating, 0) / team2.length;
          
          if (Math.abs(avg1 - avg2) > 0.8) throw new Error("Balans mislukt");

          // Reserves & Scheids (mensen die deze ronde NIET spelen)
          const reserves = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
          
          roundMatches.push({
            id: `r${r}h${h}`,
            hallName: hallNames[h],
            team1, team2,
            team1Score: 0, team2Score: 0,
            isPlayed: false,
            subLow: reserves[0] || null,
            subHigh: reserves[reserves.length - 1] || null,
            referee: reserves[Math.floor(reserves.length / 2)] || null
          });

          matchPlayers.forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1));
        }

        allRounds.push({
          roundNumber: r,
          matches: roundMatches,
          restingPlayers: players.filter(p => !usedThisRound.has(p.id))
        });
      }

      // Check of iedereen exact genoeg gespeeld heeft
      if (Array.from(playedCount.values()).every(v => v === matchesPerPlayer)) {
        session = {
          competitionName, hallNames, playersPerTeam,
          totalRounds: allRounds.length,
          rounds: allRounds,
          standings: players.map(p => ({ playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 })),
          isCompleted: false
        };
      }
    } catch (e) {
      // Poging mislukt, loop gaat opnieuw
    }
  }

  if (!session) throw new Error("Geen geldig schema gevonden. Probeer de parameters aan te passen.");
  return session;
}
