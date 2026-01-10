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
  let roundNum = 1;

  while (matchesRemaining > 0) {
    await sleep(10); 

    const hallsThisRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRoundCount * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // 1. KIES RUSTERS (Harde garantie voor aantal wedstrijden)
    const sortedForRest = [...players].sort((a, b) => 
        restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );
    const restingThisRound = sortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = sortedForRest.slice(numPeopleToRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. VERDEEL SPELERS OVER DE ZALEN
    // We verdelen eerst de keepers over de zalen om zeker te weten dat ze apart zitten
    const activeKeepers = activeThisRound.filter(p => p.isKeeper);
    const activeField = activeThisRound.filter(p => !p.isKeeper);
    
    const hallPools: Player[][] = Array.from({ length: hallsThisRoundCount }, () => []);
    
    // Verdeel keepers eerst (max 2 per zaal, 1 per team later)
    activeKeepers.forEach((k, idx) => {
        hallPools[idx % hallsThisRoundCount].push(k);
    });
    // Vul aan met veldspelers
    activeField.forEach((f, idx) => {
        const hallIdx = hallPools.findIndex(h => h.length < playersPerMatch);
        if (hallIdx !== -1) hallPools[hallIdx].push(f);
    });

    const roundMatches: NKMatch[] = [];

    // 3. OPTIMALISEER TEAMS PER ZAAL
    for (let h = 0; h < hallsThisRoundCount; h++) {
        const matchPool = hallPools[h];
        if (matchPool.length < playersPerMatch) continue; // Veiligheid

        let bestT1: Player[] = [];
        let bestT2: Player[] = [];
        let lowestPenalty = Infinity;
        let balanceThreshold = 0.301;

        for (let attempt = 0; attempt < 2000; attempt++) {
            // Langzame versoepeling van balans om blokkades te voorkomen
            if (attempt > 800) balanceThreshold = 0.401;
            if (attempt > 1500) balanceThreshold = 0.601;

            const shuffled = [...matchPool].sort(() => Math.random() - 0.5);
            const t1 = shuffled.slice(0, playersPerTeam);
            const t2 = shuffled.slice(playersPerTeam);

            // Keeper check (Max 1 per team)
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1) continue;

            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            
            if (Math.abs(avg1 - avg2) > balanceThreshold) continue;

            const penalty = calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
            if (penalty < lowestPenalty) {
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
            id: `r${roundNum}h${h}`, hallName: hallNames[h], team1: bestT1, team2: bestT2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            referee: players[0], subHigh: players[0], subLow: players[0] 
        });
        matchesRemaining--;
    }

    // 4. ROLLEN TOEWIJZEN (Scheids/Reserves)
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

    rounds.push({ roundNumber: roundNum, matches: roundMatches, restingPlayers: restingThisRound });
    roundNum++;
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
        const togC = tog.get(key) || 0;
        const agC = ag.get(key) || 0;
        p += getWeight(togC);
        if (togC + agC >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const togC = tog.get(key) || 0;
    const agC = ag.get(key) || 0;
    p += getWeight(agC) / 2;
    if (togC + agC >= 6) p += 5000000;
  }));
  return p;
};
