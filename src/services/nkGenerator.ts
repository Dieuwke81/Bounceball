import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<NKSession> => {
  const playersPerMatch = playersPerTeam * 2;
  const totalPlayerSpots = players.length * matchesPerPlayer;
  const totalMatchesNeeded = totalPlayerSpots / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const restCounts = new Map<number, number>();
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    await sleep(10);

    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const numActive = hallsThisRound * playersPerMatch;
    const numRest = players.length - numActive;

    // 1. SELECTIE RUSTERS (Garantie aantal wedstrijden)
    const sortedForRest = [...players].sort((a, b) => 
        restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );
    const restingThisRound = sortedForRest.slice(0, numRest);
    const activeThisRound = sortedForRest.slice(numRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. MIRROR-PAIRING VOOR HARDE 0.3 BALANS
    // Sorteer alle actieve spelers op rating
    const sortedActive = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    
    // Maak duo's van spelers die qua rating buren zijn (1-2, 3-4, etc.)
    const pairs: {p1: Player, p2: Player}[] = [];
    for (let i = 0; i < sortedActive.length; i += 2) {
        pairs.push({ p1: sortedActive[i], p2: sortedActive[i+1] });
    }

    // Verdeel de duo's over de zalen (Zaal 1 krijgt pair 1, Zaal 2 krijgt pair 2...)
    const hallMatchPools: {p1: Player, p2: Player}[][] = Array.from({ length: hallsThisRound }, () => []);
    pairs.forEach((pair, idx) => {
        hallMatchPools[idx % hallsThisRound].push(pair);
    });

    const roundMatches: NKMatch[] = [];

    // 3. OPTIMALISEER PER ZAAL
    hallMatchPools.forEach((matchPairs, hIdx) => {
        let bestT1: Player[] = [];
        let bestT2: Player[] = [];
        let lowestPenalty = Infinity;

        // Probeer 5000 keer de paartjes te flippen voor de beste variatie
        for (let attempt = 0; attempt < 5000; attempt++) {
            let t1: Player[] = [];
            let t2: Player[] = [];

            matchPairs.forEach(pair => {
                if (Math.random() > 0.5) { t1.push(pair.p1); t2.push(pair.p2); }
                else { t1.push(pair.p2); t2.push(pair.p1); }
            });

            // Keeper check (Max 1 per team)
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1) continue;

            const penalty = calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
            
            // Check de balans (0.3 eis)
            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            
            if (Math.abs(avg1 - avg2) <= 0.31 && penalty < lowestPenalty) {
                lowestPenalty = penalty;
                bestT1 = [...t1];
                bestT2 = [...t2];
            }
            if (lowestPenalty === 0) break;
        }

        // Update historie
        bestT1.forEach(p1 => {
            bestT1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
            bestT2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
        });
        bestT2.forEach(p1 => {
            bestT2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
        });

        roundMatches.push({
            id: `r${r}h${hIdx}`, hallName: hallNames[hIdx], team1: bestT1, team2: bestT2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            referee: players[0], subHigh: players[0], subLow: players[0] 
        });
        matchesRemaining--;
    });

    // 4. ROLLEN TOEWIJZEN
    const rolePool = [...restingThisRound];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    roundMatches.forEach(match => {
        match.subHigh = findRole(rolePool, p => p.rating >= 5);
        match.subLow = findRole(rolePool, p => p.rating < 5);
        match.referee = findRole(rolePool, () => true);
    });

    rounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: restingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};

const calculateEnhancedPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: any) => {
  let p = 0;
  const getWeight = (count: number) => [0, 10, 500, 10000, 2000000][Math.floor(count)] || 2000000;
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const key = keyFn(team[i].id, team[j].id);
        const tCount = tog.get(key) || 0;
        const aCount = ag.get(key) || 0;
        p += getWeight(tCount);
        if (tCount + aCount >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const tCount = tog.get(key) || 0;
    const aCount = ag.get(key) || 0;
    p += getWeight(aCount) / 2;
    if (tCount + aCount >= 6) p += 5000000;
  }));
  return p;
};
