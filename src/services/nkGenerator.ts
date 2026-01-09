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

  // Bereken het globale gemiddelde van alle deelnemers om op te sturen
  const globalAverage = players.reduce((s, p) => s + p.rating, 0) / players.length;

  const restCounts = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // A. Bepaal wie deze ronde RUSTEN
    const sortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = sortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = sortedForRest.slice(numPeopleToRest);

    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    const availableForRoles = [...restingThisRound];
    const matchesForRoundPool = [...activeThisRound];
    
    for (let h = 0; h < hallsThisRound; h++) {
      let bestMatchPool: Player[] = [];
      let matchPoolPenalty = Infinity;

      // STAP 1: MATCH SELECTIE
      // We proberen uit de beschikbare spelers voor deze ronde een groepje van 10 te vinden
      // waarvan het gemiddelde dicht bij het 'globalAverage' ligt.
      for (let mAttempt = 0; mAttempt < 500; mAttempt++) {
        const candidatePool = [...matchesForRoundPool].sort(() => Math.random() - 0.5).slice(0, playersPerMatch);
        const poolAvg = candidatePool.reduce((s, p) => s + p.rating, 0) / playersPerMatch;
        
        // We willen dat het gemiddelde van de pot maximaal 1.0 afwijkt van het globale gemiddelde
        // (Dit zorgt voor de spreiding over het hele toernooi die je vroeg)
        const diffFromGlobal = Math.abs(poolAvg - globalAverage);
        
        if (diffFromGlobal < matchPoolPenalty) {
          matchPoolPenalty = diffFromGlobal;
          bestMatchPool = candidatePool;
        }
        if (diffFromGlobal < 0.5) break; 
      }

      // Verwijder de gekozen spelers uit de poule voor de volgende zaal in deze ronde
      bestMatchPool.forEach(p => {
        const idx = matchesForRoundPool.findIndex(m => m.id === p.id);
        if (idx !== -1) matchesForRoundPool.splice(idx, 1);
      });

      // STAP 2: TEAM VERDELING
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;

      for (let attempt = 0; attempt < 1000; attempt++) {
        const shuffled = [...bestMatchPool].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        // Keepers verdelen
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (Math.abs(k1 - k2) > 1) continue;

        const avg1 = t1.reduce((s,x)=>s+x.rating,0)/t1.length;
        const avg2 = t2.reduce((s,x)=>s+x.rating,0)/t2.length;
        const matchDiff = Math.abs(avg1 - avg2);

        // EIS 1: Maximaal 0.3 verschil tussen team 1 en team 2
        if (matchDiff > 0.3) continue;

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

        // Balans penalty (hoe kleiner hoe beter)
        p += matchDiff * 100;

        if (p < lowestPenalty) { lowestPenalty = p; bestT1 = t1; bestT2 = t2; }
        if (p === 0) break;
      }

      // Update historie
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
        id: `r${r}h${h}`, hallIndex: h + 1, team1: bestT1, team2: bestT2,
        team1Score: 0, team2Score: 0, isPlayed: false,
        referee: findRole(availableForRoles, () => true) as Player,
        subHigh: findRole(availableForRoles, p => p.rating >= 5) as Player,
        subLow: findRole(availableForRoles, p => p.rating < 5) as Player
      });
      
      matchesRemaining--;
    }

    rounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: restingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};
