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

  const globalAverage = players.reduce((s, p) => s + p.rating, 0) / players.length;
  const restCounts = new Map<number, number>();
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // 1. OPTIMALE SELECTIE VAN RUSTERS (Met Harde Rating-Check)
    let bestActiveThisRound: Player[] = [];
    let bestRestingThisRound: Player[] = [];
    let lowestInitialConflict = Infinity;

    // We proberen net zo lang tot we een rustgroep hebben die genoeg High/Low ratings heeft
    for (let i = 0; i < 200; i++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        // CHECK: Hebben we genoeg High (>=5) en Low (<5) rusters voor de reserves van alle zalen?
        const highReservesAvailable = candidateRest.filter(p => p.rating >= 5).length;
        const lowReservesAvailable = candidateRest.filter(p => p.rating < 5).length;
        
        // Per zaal hebben we 1 High en 1 Low reserve nodig. 
        // De scheidsrechter mag iedereen zijn, dus die tellen we niet mee in de beperking.
        if (highReservesAvailable < hallsThisRound || lowReservesAvailable < hallsThisRound) {
            continue; // Deze rustgroep is niet geschikt, probeer opnieuw
        }

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
        if (i > 100 && bestActiveThisRound.length > 0) break; // We hebben een geldige groep
    }

    bestRestingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. SUPER BRUTE FORCE VOOR TEAMS (100.000 POGINGEN)
    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 100000; attempt++) {
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
        if (Math.abs(avg1 - avg2) > 0.301) { roundValid = false; break; }
        
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

        if (Math.abs(avg1 - globalAverage) > 1.0 || Math.abs(avg2 - globalAverage) > 1.0) {
          roundValid = false; break;
        }

        roundPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
        
        currentRoundMatches.push({
          id: `r${r}h${h}`, hallIndex: h + 1, team1: t1, team2: t2,
          team1Score: 0, team2Score: 0, isPlayed: false,
          referee: players[0], subHigh: players[0], subLow: players[0] 
        });
      }

      if (roundValid && roundPenalty < lowestPenalty) {
        lowestPenalty = roundPenalty;
        bestRoundMatches = JSON.parse(JSON.stringify(currentRoundMatches));
        if (lowestPenalty === 0) break;
      }
    }

    // 3. ROLLEN TOEWIJZEN (Nu met gegarandeerde ratings)
    const rolePool = [...bestRestingThisRound];
    
    bestRoundMatches.forEach(match => {
      // 1. Zoek eerst de SubHigh (>= 5)
      const highIdx = rolePool.findIndex(p => p.rating >= 5);
      match.subHigh = rolePool.splice(highIdx, 1)[0];

      // 2. Zoek dan de SubLow (< 5)
      const lowIdx = rolePool.findIndex(p => p.rating < 5);
      match.subLow = rolePool.splice(lowIdx, 1)[0];

      // 3. De scheidsrechter mag de rest zijn
      match.referee = rolePool.splice(0, 1)[0] || players[0];

      // Update Historie
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

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
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

  t1.forEach(p1 => {
    t2.forEach(p2 => {
      const key = keyFn(p1.id, p2.id);
      const aCount = ag.get(key) || 0;
      const tCount = tog.get(key) || 0;
      p += getWeight(aCount) / 2;
      if (tCount + aCount >= 6) p += 5000000;
    });
  });

  return p;
};
