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
    const numActive = hallsThisRound * playersPerMatch;
    const numRest = players.length - numActive;

    // 1. KIES RUSTERS (Harde eis voor aantal wedstrijden)
    const sortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = sortedForRest.slice(0, numRest);
    const activeThisRound = players.filter(p => !restingThisRound.find(res => res.id === p.id));
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. VERDEEL KEEPERS OVER DE ZALEN
    const activeKeepers = activeThisRound.filter(p => p.isKeeper).sort(() => Math.random() - 0.5);
    const activeField = activeThisRound.filter(p => !p.isKeeper).sort(() => Math.random() - 0.5);
    
    // Maak lege zaal-pools
    const hallPools: { keepers: Player[], field: Player[] }[] = Array.from({ length: hallsThisRound }, () => ({
      keepers: [],
      field: []
    }));

    // Verdeel keepers eerst eerlijk over de zalen
    activeKeepers.forEach((keeper, idx) => {
      hallPools[idx % hallsThisRound].keepers.push(keeper);
    });

    // Vul aan met veldspelers
    let fieldIdx = 0;
    hallPools.forEach(pool => {
      while (pool.keepers.length + pool.field.length < playersPerMatch && fieldIdx < activeField.length) {
        pool.field.push(activeField[fieldIdx++]);
      }
    });

    const availableForRoles = [...restingThisRound];

    // 3. OPTIMALISEER PER ZAAL
    hallPools.forEach((pool, hIdx) => {
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;
      let balanceThreshold = 0.301;

      // Verzamel alle spelers van deze zaal
      const matchPool = [...pool.keepers, ...pool.field];

      // Optimalisatie loop: probeer 500 verdelingen
      for (let attempt = 0; attempt < 500; attempt++) {
        // Versoepel balans heel langzaam bij nood
        if (attempt > 300) balanceThreshold = 0.401;

        const shuffled = [...matchPool].sort(() => Math.random() - 0.5);
        const t1: Player[] = [];
        const t2: Player[] = [];

        // ✅ KEEPER LOGICA: Verdeel keepers strikt over teams
        const matchKeepers = shuffled.filter(p => p.isKeeper);
        const matchField = shuffled.filter(p => !p.isKeeper);

        matchKeepers.forEach((k, idx) => {
          if (t1.filter(p => p.isKeeper).length <= t2.filter(p => p.isKeeper).length) {
            t1.push(k);
          } else {
            t2.push(k);
          }
        });

        // Vul aan met veldspelers
        matchField.forEach(f => {
          if (t1.length < playersPerTeam) t1.push(f);
          else t2.push(f);
        });

        // Check Balans (0.3 grens)
        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        const diff = Math.abs(avg1 - avg2);

        if (diff > balanceThreshold) continue;

        // Check Keeper limit (Max 1 tenzij noodzakelijk)
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        // Als er 2 keepers zijn, moet het 1-1 zijn. Als er 3 zijn, 1-2.
        if (matchKeepers.length === 2 && (k1 !== 1 || k2 !== 1)) continue;
        if (matchKeepers.length <= 2 && (k1 > 1 || k2 > 1)) continue;

        const penalty = calculateTotalPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
        
        if (penalty < lowestPenalty) {
          lowestPenalty = penalty;
          bestT1 = [...t1];
          bestT2 = [...t2];
        }
        if (lowestPenalty === 0) break;
      }

      // Update de geschiedenis voor de volgende rondes/zalen
      [bestT1, bestT2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            togetherHistory.set(key, (togetherHistory.get(key) || 0) + 1);
          }
        }
      });
      bestT1.forEach(tp1 => {
        bestT2.forEach(tp2 => {
          const key = getPairKey(tp1.id, tp2.id);
          againstHistory.set(key, (againstHistory.get(key) || 0) + 1);
        });
      });

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
      };

      roundMatches.push({
        id: `r${r}h${hIdx}`, hallIndex: hIdx + 1, team1: [...bestT1], team2: [...bestT2],
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

const calculateTotalPenalty = (
  t1: Player[], 
  t2: Player[], 
  togHist: Map<string, number>, 
  agHist: Map<string, number>, 
  keyFn: (id1: number, id2: number) => string
) => {
  let penalty = 0;
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const count = togHist.get(keyFn(team[i].id, team[j].id)) || 0;
        penalty += (count * count * 1000);
      }
    }
  });
  t1.forEach(p1 => {
    t2.forEach(p2 => {
      const count = agHist.get(keyFn(p1.id, p2.id)) || 0;
      penalty += (count * count * 500);
    });
  });
  return penalty;
};
