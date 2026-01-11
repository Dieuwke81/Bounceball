import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Vindt de allerbeste teamverdeling voor een groep van 8 of 10 spelers.
 * Checkt alle combinaties voor de kleinste rating-verschil.
 */
function getBestTeamSplit(players: Player[], playersPerTeam: number, maxAllowedDiff: number) {
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

      if (diff < bestDiff && k1 <= 1 && k2 <= 1) {
        bestDiff = diff;
        bestSplit = { t1: [...team1], t2: [...team2] };
      }
      return;
    }
    for (let i = start; i < players.length; i++) {
      team1.push(players[i]);
      combine(i + 1, team1);
      team1.pop();
    }
  }

  combine(0, []);
  return bestDiff <= maxAllowedDiff ? bestSplit : null;
}

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
    throw new Error("Berekening klopt niet. Controleer spelersaantal vs wedstrijden p.p.");
  }

  const totalRounds = Math.ceil(totalMatches / hallNames.length);
  let attempt = 0;

  while (attempt < 500) {
    attempt++;
    // Start met 0.3, pas na veel pogingen heel langzaam versoepelen
    const currentMaxDiff = attempt < 150 ? 0.3 : 0.3 + (attempt - 150) * 0.002;
    
    onProgress(`Poging ${attempt} (Marge: ${currentMaxDiff.toFixed(2)})...`);
    if (attempt % 10 === 0) await delay(1);

    try {
      const playedCount = new Map(players.map(p => [p.id, 0]));
      const allRounds: NKRound[] = [];

      for (let r = 1; r <= totalRounds; r++) {
        const roundMatches: NKMatch[] = [];
        const usedThisRound = new Set<number>();
        
        const pool = [...players]
          .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
          .sort((a, b) => (playedCount.get(a.id)! - playedCount.get(b.id)!) || (Math.random() - 0.5));

        const matchesInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
        if (matchesInRound === 0) break;

        // Eerst alle spelende teams bepalen
        for (let h = 0; h < matchesInRound; h++) {
          const matchPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
          const bestSplit = getBestTeamSplit(matchPlayers, playersPerTeam, currentMaxDiff);
          if (!bestSplit) throw new Error("Balans niet mogelijk");

          matchPlayers.forEach(p => usedThisRound.add(p.id));
          roundMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h],
            team1: bestSplit.t1, team2: bestSplit.t2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        // Nu de verplichte officials toewijzen uit de rustende spelers
        const restingPool = players
            .filter(p => !usedThisRound.has(p.id))
            .sort((a, b) => a.rating - b.rating);

        if (restingPool.length < roundMatches.length * 3) {
            throw new Error("Te weinig rustende spelers voor verplichte officials.");
        }

        roundMatches.forEach((match, idx) => {
            // Pak 3 specifieke mensen uit de rust-pool voor deze match
            const offset = idx * 3;
            match.subLow = restingPool[offset];
            match.subHigh = restingPool[restingPool.length - 1 - offset];
            match.referee = restingPool[offset + 1];
        });

        roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
        allRounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: players.filter(p => !usedThisRound.has(p.id)) });
      }

      if (Array.from(playedCount.values()).every(v => v === matchesPerPlayer)) {
        return {
          competitionName, hallNames, playersPerTeam, totalRounds: allRounds.length,
          rounds: allRounds, standings: players.map(p => ({ playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 })),
          isCompleted: false
        };
      }
    } catch (e) { /* retry */ }
  }
  throw new Error("Geen schema gevonden met marge 0.3. Verlaag het aantal wedstrijden p.p. of voeg spelers toe.");
}
