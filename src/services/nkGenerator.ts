import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
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
    // Browser ademruimte om bevriezen te voorkomen
    await sleep(5);

    const hallsThisRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRoundCount * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let roundFound = false;

    // 1. KIES RUSTERS (Harde garantie voor aantal wedstrijden)
    // We sorteren op wie het minst gerust heeft
    const sortedForRest = [...players].sort((a, b) => 
        restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );
    const restingThisRound = sortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = players.filter(p => !restingThisRound.find(res => res.id === p.id));

    // 2. VERDEEL ACTIEVE SPELERS OVER DE ZALEN
    // Sorteer even op rating voor een eerste ruwe verdeling (Snake-achtig)
    const activeSorted = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    const hallPools: Player[][] = Array.from({ length: hallsThisRoundCount }, () => []);
    
    let hIdx = 0;
    let dir = 1;
    activeSorted.forEach(p => {
        hallPools[hIdx].push(p);
        hIdx += dir;
        if (hIdx >= hallsThisRoundCount) { hIdx = hallsThisRoundCount - 1; dir = -1; }
        else if (hIdx < 0) { hIdx = 0; dir = 1; }
    });

    const roundMatches: NKMatch[] = [];

    // 3. PER ZAAL: VIND DE BESTE VERDELING
    for (let h = 0; h < hallsThisRoundCount; h++) {
      const matchPool = hallPools[h];
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;
      
      // Glijdende schaal voor balans: we beginnen heel streng (0.3)
      let balanceThreshold = 0.301;

      onProgress(`Ronde ${r}: Optimaliseren Zaal ${hallNames[h]}...`);
      
      // We doen maximaal 50.000 pogingen per zaal
      for (let attempt = 0; attempt < 50000; attempt++) {
        if (attempt === 10000) { balanceThreshold = 0.351; await sleep(0); }
        if (attempt === 25000) { balanceThreshold = 0.451; await sleep(0); }
        if (attempt === 40000) { balanceThreshold = 0.701; await sleep(0); }

        const shuffled = [...matchPool].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        // Keeper check
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) continue;

        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        const diff = Math.abs(avg1 - avg2);

        if (diff > balanceThreshold) continue;

        const penalty = calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
        if (penalty < lowestPenalty) {
          lowestPenalty = penalty;
          bestT1 = [...t1];
          bestT2 = [...t2];
        }
        if (lowestPenalty === 0) break;
      }

      // Update historie
      const updateHist = (team: Player[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            togetherHistory.set(key, (togetherHistory.get(key) || 0) + 1);
          }
        }
      };
      updateHist(bestT1); updateHist(bestT2);
      bestT1.forEach(p1 => bestT2.forEach(p2 => {
        const key = getPairKey(p1.id, p2.id);
        againstHistory.set(key, (againstHistory.get(key) || 0) + 1);
      }));

      roundMatches.push({
        id: `r${r}h${h}`, hallName: hallNames[h], team1: bestT1, team2: bestT2,
        team1Score: 0, team2Score: 0, isPlayed: false,
        referee: players[0], subHigh: players[0], subLow: players[0] 
      });
      matchesRemaining--;
    }

    // 4. ROLLEN TOEWIJZEN (Scheids/Reserves)
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
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
        const tC = tog.get(key) || 0;
        const agC = ag.get(key) || 0;
        p += getWeight(tC);
        if (tC + agC >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const tC = tog.get(key) || 0;
    const agC = ag.get(key) || 0;
    p += getWeight(agC) / 2;
    if (tog + agC >= 6) p += 5000000;
  }));
  return p;
};
