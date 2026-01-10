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

    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let roundFound = false;

    // 1. KIES RUSTERS (Harde garantie voor aantal wedstrijden)
    for (let rAttempt = 0; rAttempt < 300; rAttempt++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        // Eis: High/Low mix voor de 3 rollen per zaal
        const highRes = candidateRest.filter(p => p.rating >= 5).length;
        const lowRes = candidateRest.filter(p => p.rating < 5).length;
        
        // We proberen 1 High en 1 Low per zaal te vinden in de rustgroep.
        // Na 150 pogingen versoepelen we deze eis om blokkades te voorkomen.
        const requiredHigh = Math.max(0, hallsThisRound - Math.floor(rAttempt / 50));
        const requiredLow = Math.max(0, hallsThisRound - Math.floor(rAttempt / 50));

        if (highRes >= requiredHigh && lowRes >= requiredLow) {
            bestRestingThisRound = candidateRest;
            break;
        }
        if (rAttempt === 299) bestRestingThisRound = candidateRest;
    }

    const activeThisRound = players.filter(p => !bestRestingThisRound.find(r => r.id === p.id));

    // 2. MAAK TEAMS (Met glijdende balans-eis)
    let balanceThreshold = 0.301;

    for (let attempt = 0; attempt < 5000; attempt++) {
        if (attempt > 1000) balanceThreshold = 0.401;
        if (attempt > 3000) balanceThreshold = 0.601;

        const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
        let tempMatches: NKMatch[] = [];
        let valid = true;

        for (let h = 0; h < hallsThisRound; h++) {
            const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
            const t1 = matchPlayers.slice(0, playersPerTeam);
            const t2 = matchPlayers.slice(playersPerTeam);

            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            
            if (Math.abs(avg1 - avg2) > balanceThreshold) { valid = false; break; }
            
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

            tempMatches.push({
                id: `r${roundNum}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
                team1Score: 0, team2Score: 0, isPlayed: false,
                referee: players[0], subHigh: players[0], subLow: players[0] 
            });
        }

        if (valid) {
            bestRoundMatches = tempMatches;
            roundFound = true;
            break;
        }
    }

    // 3. AFRONDEN EN ROLLEN
    if (roundFound) {
        bestRestingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
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
                match.team1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
                match.team2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
            });
            match.team2.forEach(p1 => {
                match.team2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
            });
            matchesRemaining--;
        });

        rounds.push({ roundNumber: roundNum, matches: bestRoundMatches, restingPlayers: bestRestingThisRound });
        roundNum++;
    } else {
        // Forceer afronding als er na 5000 pogingen echt niets is (noodstop)
        matchesRemaining = 0;
    }
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
