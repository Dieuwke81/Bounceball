import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallNames: string[], // Nu een lijst met namen
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): NKSession => {
  const playersPerMatch = playersPerTeam * 2;
  const totalPlayerSpots = players.length * matchesPerPlayer;
  const totalMatchesNeeded = totalPlayerSpots / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const globalAverage = players.reduce((s, p) => s + p.rating, 0) / players.length;
  const restCounts = new Map<number, number>();
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestActiveThisRound: Player[] = [];
    let bestRestingThisRound: Player[] = [];
    let lowestInitialConflict = Infinity;

    for (let i = 0; i < 100; i++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        const highResAvailable = candidateRest.filter(p => p.rating >= 5).length;
        const lowResAvailable = candidateRest.filter(p => p.rating < 5).length;
        
        if (highResAvailable < hallsThisRound || lowResAvailable < hallsThisRound) continue;

        const candidateActive = players.filter(p => !candidateRest.find(r => r.id === p.id));
        let conflictScore = 0;
        for (let x = 0; x < candidateActive.length; x++) {
            for (let y = x + 1; y < candidateActive.length; y++) {
                const key = getPairKey(candidateActive[x].id, candidateActive[y].id);
                conflictScore += Math.pow((togetherHistory.get(key) || 0) + (againstHistory.get(key) || 0), 3);
            }
        }
        if (conflictScore < lowestInitialConflict) {
            lowestInitialConflict = conflictScore;
            bestActiveThisRound = candidateActive;
            bestRestingThisRound = candidateRest;
        }
        if (i > 50 && bestActiveThisRound.length > 0) break;
    }

    bestRestingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 5000; attempt++) {
      const shuffledActive = [...bestActiveThisRound].sort(() => Math.random() - 0.5);
      const currentRoundMatches: NKMatch[] = [];
      let roundValid = true;
      let roundPenalty = 0;

      for (let h = 0; h < hallsThisRound; h++) {
        const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        const t1 = matchPlayers.slice(0, playersPerTeam);
        const t2 = matchPlayers.slice(playersPerTeam);

        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        if (Math.abs(avg1 - avg2) > 0.35) { roundValid = false; break; }
        
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

        roundPenalty += 0; // Hier zou eventueel penalty berekening kunnen

        currentRoundMatches.push({
          id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
          team1Score: 0, team2Score: 0, isPlayed: false,
          referee: players[0], subHigh: players[0], subLow: players[0] 
        });
      }

      if (roundValid) {
        bestRoundMatches = [...currentRoundMatches];
        break; 
      }
    }

    const rolePool = [...bestRestingThisRound];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    bestRoundMatches.forEach(match => {
      match.subHigh = findRole(rolePool, p => p.rating >= 5);
      match.subLow = findRole(rolePool, p => p.rating < 5);
      match.referee = findRole(rolePool, () => true);

      match.team1.forEach(p1 => {
        match.team1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 0.5); });
        match.team2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
      });
      match.team2.forEach(p1 => {
        match.team2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 0.5); });
      });
      matchesRemaining--;
    });

    rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: bestRestingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
