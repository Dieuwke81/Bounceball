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

  const restCounts = new Map<number, number>();
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // 1. Wie rusten er?
    const playersSortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );
    const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = playersSortedForRest.slice(numPeopleToRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. DYNAMISCHE PAIRING (Variatie in tegenstanders)
    const availableActive = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    const pairs: {p1: Player, p2: Player}[] = [];

    while (availableActive.length > 0) {
      const p1 = availableActive.shift()!;
      // Zoek een partner uit de top 4 van de resterende lijst die de laagste 'tegen' historie heeft
      // Dit zorgt dat 1 niet altijd tegen 2 speelt, maar soms tegen 3 of 4.
      const searchWindow = availableActive.slice(0, 4);
      let bestPartnerIdx = 0;
      let lowestAgainstScore = Infinity;

      searchWindow.forEach((cand, idx) => {
        const againstCount = againstHistory.get(getPairKey(p1.id, cand.id)) || 0;
        const ratingDiff = Math.abs(p1.rating - cand.rating);
        // Score is combi van historie (zwaar) en rating (licht)
        const score = (againstCount * 1000) + (ratingDiff * 10);
        
        if (score < lowestAgainstScore) {
          lowestAgainstScore = score;
          bestPartnerIdx = idx;
        }
      });

      const p2 = availableActive.splice(bestPartnerIdx, 1)[0];
      pairs.push({ p1, p2 });
    }

    // 3. Verdeel duo's over de zalen
    const hallMatchesPools: {p1: Player, p2: Player}[][] = Array.from({ length: hallsThisRound }, () => []);
    const shuffledPairs = pairs.sort(() => Math.random() - 0.5);
    shuffledPairs.forEach((pair, idx) => {
      hallMatchesPools[idx % hallsThisRound].push(pair);
    });

    const availableForRoles = [...restingThisRound];

    // 4. Optimaliseer de teams binnen de zaal (0.3 grens + Samen historie)
    hallMatchesPools.forEach((matchPairs, hIdx) => {
      let team1: Player[] = [];
      let team2: Player[] = [];

      matchPairs.forEach((pair, pIdx) => {
        if (pIdx % 2 === 0) { team1.push(pair.p1); team2.push(pair.p2); } 
        else { team1.push(pair.p2); team2.push(pair.p1); }
      });

      // Keeper Fix
      const fixKeepers = () => {
        const k1 = team1.filter(p => p.isKeeper);
        const k2 = team2.filter(p => p.isKeeper);
        if (k1.length > 1 || k2.length > 1) {
            const over = k1.length > 1 ? team1 : team2;
            const under = k1.length > 1 ? team2 : team1;
            const idx = over.findIndex(p => p.isKeeper);
            const pOver = over[idx]; const pUnder = under[idx];
            over[idx] = pUnder; under[idx] = pOver;
        }
      };
      fixKeepers();

      // OPTIMALISATIE: Probeer 500 keer paartjes te flippen voor de beste historie
      for (let attempt = 0; attempt < 500; attempt++) {
        const pIdx = Math.floor(Math.random() * matchPairs.length);
        const p1 = team1[pIdx]; const p2 = team2[pIdx];

        const curPenalty = calculateTotalPenalty(team1, team2, togetherHistory, againstHistory, getPairKey);
        
        // Flip
        team1[pIdx] = p2; team2[pIdx] = p1;
        const newPenalty = calculateTotalPenalty(team1, team2, togetherHistory, againstHistory, getPairKey);
        
        const avg1 = team1.reduce((s,x)=>s+x.rating,0)/team1.length;
        const avg2 = team2.reduce((s,x)=>s+x.rating,0)/team2.length;
        const balanceOk = Math.abs(avg1 - avg2) <= 0.35; // Iets ruimer voor variatie
        const keeperOk = team1.filter(x=>x.isKeeper).length <= 1 && team2.filter(x=>x.isKeeper).length <= 1;

        if (newPenalty < curPenalty && balanceOk && keeperOk) {
          // Houden
        } else {
          team1[pIdx] = p1; team2[pIdx] = p2; // Terug
        }
      }

      // 5. Update alle historie
      // Samen
      [team1, team2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            togetherHistory.set(key, (togetherHistory.get(key) || 0) + 1);
          }
        }
      });
      // Tegen
      team1.forEach(tp1 => {
        team2.forEach(tp2 => {
          const key = getPairKey(tp1.id, tp2.id);
          againstHistory.set(key, (againstHistory.get(key) || 0) + 1);
        });
      });

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
      };

      roundMatches.push({
        id: `r${r}h${hIdx}`, hallIndex: hIdx + 1, team1: [...team1], team2: [...team2],
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

// EXTREME PENALTY LOGICA
const calculateTotalPenalty = (t1: Player[], t2: Player[], togHist: Map<string, number>, agHist: Map<string, number>, keyFn: any) => {
  let penalty = 0;

  const getWeight = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 10;
    if (count === 2) return 500;
    if (count === 3) return 10000;
    return 1000000; // Harde muur voor 4 of meer
  };

  // Samen straf
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        penalty += getWeight(togHist.get(keyFn(team[i].id, team[j].id)) || 0);
      }
    }
  });

  // Tegen straf
  t1.forEach(p1 => {
    t2.forEach(p2 => {
      penalty += getWeight(agHist.get(keyFn(p1.id, p2.id)) || 0);
    });
  });

  return penalty;
};
