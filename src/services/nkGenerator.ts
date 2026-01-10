import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallsToUse: number,
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
    // GEEF DE BROWSER RUIMTE OM TE ADEMEN
    await sleep(10);

    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;
    
    // 1. KIES RUSTERS (Dwing High/Low mix voor reserves)
    let activeThisRound: Player[] = [];
    let restingThisRound: Player[] = [];

    for (let rAttempt = 0; rAttempt < 500; rAttempt++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        const highRes = candidateRest.filter(p => p.rating >= 5).length;
        const lowRes = candidateRest.filter(p => p.rating < 5).length;
        
        if (highRes >= hallsThisRound && lowRes >= hallsThisRound) {
            restingThisRound = candidateRest;
            activeThisRound = players.filter(p => !candidateRest.find(r => r.id === p.id));
            break;
        }
    }

    // 2. VERDEEL TEAMS (Brute Force met Snake-start)
    for (let attempt = 0; attempt < 20000; attempt++) {
      // Om de paar duizend pogingen geven we de browser weer even ruimte
      if (attempt % 5000 === 0) await sleep(0);

      const currentRoundMatches: NKMatch[] = [];
      let roundValid = true;
      let roundPenalty = 0;

      // Start met een gesorteerde lijst voor betere basis-balans
      const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);

      for (let h = 0; h < hallsThisRound; h++) {
        const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        // Sorteer deze 8/10 mensen even op rating voor een eerlijke verdeling
        const pool = [...matchPlayers].sort((a,b) => b.rating - a.rating);
        const t1: Player[] = [];
        const t2: Player[] = [];

        // Eerlijke verdeling (1-4-5-8 vs 2-3-6-7 patroon)
        pool.forEach((p, idx) => {
            if ([0, 3, 4, 7, 8].includes(idx)) t1.push(p); else t2.push(p);
        });

        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        
        // HARDE EIS: 0.3 BALANS
        if (Math.abs(avg1 - avg2) > 0.31) { roundValid = false; break; }
        
        // KEEPER EIS
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

        roundPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
        
        currentRoundMatches.push({
          id: `r${roundNum}h${h}`, hallIndex: h + 1, team1: t1, team2: t2,
          team1Score: 0, team2Score: 0, isPlayed: false,
          referee: players[0], subHigh: players[0], subLow: players[0] 
        });
      }

      if (roundValid && roundPenalty < lowestPenalty) {
        lowestPenalty = roundPenalty;
        bestRoundMatches = [...currentRoundMatches];
        if (lowestPenalty === 0) break;
      }
    }

    // 3. AFRONDEN RONDE
    if (bestRoundMatches.length > 0) {
        restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
        const rolePool = [...restingThisRound];
        const findRole = (cond: (p: Player) => boolean) => {
            const idx = rolePool.findIndex(cond);
            return idx !== -1 ? rolePool.splice(idx, 1)[0] : rolePool.shift() || players[0];
        };

        bestRoundMatches.forEach(match => {
            match.subHigh = findRole(p => p.rating >= 5);
            match.subLow = findRole(p => p.rating < 5);
            match.referee = findRole(() => true);

            match.team1.forEach(p1 => {
                match.team1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
                match.team2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
            });
            match.team2.forEach(p1 => {
                match.team2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
            });
            matchesRemaining--;
        });

        rounds.push({ roundNumber: roundNum, matches: bestRoundMatches, restingPlayers: restingThisRound });
        roundNum++;
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};

const calculateEnhancedPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: any) => {
  let p = 0;
  const getWeight = (count: number) => [0, 10, 500, 10000, 2000000][Math.floor(count)] || 2000000;
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const key = keyFn(team[i].id, team[j].id);
        const together = tog.get(key) || 0;
        const against = ag.get(key) || 0;
        p += getWeight(together);
        if (together + against >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const together = tog.get(key) || 0;
    const against = ag.get(key) || 0;
    p += getWeight(against) / 2;
    if (together + against >= 6) p += 5000000;
  }));
  return p;
};
