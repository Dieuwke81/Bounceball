import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsToUse: number,
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): NKSession => {
  const playersPerMatch = playersPerTeam * 2;
  const totalPlayerSpots = players.length * matchesPerPlayer;
  const totalMatchesNeeded = totalPlayerSpots / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallsToUse);

  // Administratie
  const restCounts = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  // 1. Loop door elke ronde
  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    
    // Hoeveel zalen vullen we deze ronde?
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // A. Kies wie er deze ronde MOETEN RUSTEN
    // We kiezen de mensen die tot nu toe het MINST gerust hebben
    const playersSortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = playersSortedForRest.slice(numPeopleToRest);

    // Update rust-administratie
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // B. Verdeel de actieve spelers over de zalen met een Snake-verdeling voor globale balans
    // Sorteer alle spelers die nu gaan spelen op rating
    const activeSortedByRating = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    const hallPools: Player[][] = Array.from({ length: hallsThisRound }, () => []);

    // Verdeel via Snake (1, 2, 3, 3, 2, 1) zodat elke zaal even sterk is
    let hallIdx = 0;
    let direction = 1;
    activeSortedByRating.forEach((p) => {
      hallPools[hallIdx].push(p);
      hallIdx += direction;
      if (hallIdx >= hallsThisRound) { hallIdx = hallsThisRound - 1; direction = -1; }
      else if (hallIdx < 0) { hallIdx = 0; direction = 1; }
    });

    // C. Per zaal: Verdeel de pool in twee teams (0.3 limit & variatie)
    const availableForRoles = [...restingThisRound];

    hallPools.forEach((matchPool, hIdx) => {
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;

      for (let attempt = 0; attempt < 1000; attempt++) {
        const shuffled = [...matchPool].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        // Keepers verdelen
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (Math.abs(k1 - k2) > 1) continue;

        const avg1 = t1.reduce((s,x)=>s+x.rating,0)/t1.length;
        const avg2 = t2.reduce((s,x)=>s+x.rating,0)/t2.length;
        const matchDiff = Math.abs(avg1 - avg2);

        // EIS: Maximaal 0.3 verschil
        if (matchDiff > 0.3 && attempt < 900) continue;

        let p = 0;
        // Variatie penalty
        const check = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i+1; j < team.length; j++) {
              p += (pairHistory.get(getPairKey(team[i].id, team[j].id)) || 0) * 1000;
            }
          }
        };
        check(t1); check(t2);
        p += matchDiff * 100;

        if (p < lowestPenalty) { lowestPenalty = p; bestT1 = t1; bestT2 = t2; }
        if (p === 0) break;
      }

      // Update partner-historie
      [bestT1, bestT2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
          }
        }
      });

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
      };

      roundMatches.push({
        id: `r${r}h${hIdx}`, hallIndex: hIdx + 1, team1: bestT1, team2: bestT2,
        team1Score: 0, team2Score: 0, isPlayed: false,
        referee: findRole(availableForRoles, () => true) as Player,
        subHigh: findRole(availableForRoles, p => p.rating >= 5) as Player,
        subLow: findRole(availableForRoles, p => p.rating < 5) as Player
      });

      matchesRemaining--;
    });

    rounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: restingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};
