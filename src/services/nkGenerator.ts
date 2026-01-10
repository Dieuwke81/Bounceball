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

    // 1. OPTIMALE SELECTIE VAN RUSTERS
    // We proberen 50 verschillende groepjes rusters om de 'minst conflicterende' actieve pool te vinden
    let bestActiveThisRound: Player[] = [];
    let bestRestingThisRound: Player[] = [];
    let lowestInitialConflict = Infinity;

    for (let i = 0; i < 50; i++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        const candidateActive = players.filter(p => !candidateRest.find(r => r.id === p.id));
        
        // Bereken hoe zwaar deze groep actieve spelers al met elkaar belast is
        let conflictScore = 0;
        for (let x = 0; x < candidateActive.length; x++) {
            for (let y = x + 1; y < candidateActive.length; y++) {
                const key = getPairKey(candidateActive[x].id, candidateActive[y].id);
                const combined = (togetherHistory.get(key) || 0) + (againstHistory.get(key) || 0);
                conflictScore += Math.pow(combined, 3); // Exponentieel zwaarder
            }
        }

        if (conflictScore < lowestInitialConflict) {
            lowestInitialConflict = conflictScore;
            bestActiveThisRound = candidateActive;
            bestRestingThisRound = candidateRest;
        }
    }

    bestRestingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. SUPER BRUTE FORCE (100.000 POGINGEN)
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

        // BALANS EISEN (0.3 grens)
        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        if (Math.abs(avg1 - avg2) > 0.301) { roundValid = false; break; }
        
        // KEEPER EISEN
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

        // SPREIDING EIS (2.0 max verschil tussen alle teams)
        if (Math.abs(avg1 - globalAverage) > 1.0 || Math.abs(avg2 - globalAverage) > 1.0) {
          roundValid = false; break;
        }

        // BEREKEN PENALTY (Samen, Tegen, en Totaal)
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

    // 3. ROLLEN EN HISTORIE BIJWERKEN
    const rolePool = [...bestRestingThisRound];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    bestRoundMatches.forEach(match => {
      match.referee = findRole(rolePool, () => true);
      match.subHigh = findRole(rolePool, p => p.rating >= 5);
      match.subLow = findRole(rolePool, p => p.rating < 5);

      // Sla op in historie
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

// DE VERBETERDE PENALTY FUNCTIE MET HARDE GRENZEN
const calculateEnhancedPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: any) => {
  let p = 0;

  const getWeight = (count: number) => {
    if (count < 1) return 0;
    if (count < 2) return 10;
    if (count < 3) return 500;
    if (count < 4) return 10000;
    return 2000000; // De "Muur" voor 4 of meer
  };

  // 1. Samen Penalty
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const key = keyFn(team[i].id, team[j].id);
        const tCount = tog.get(key) || 0;
        const aCount = ag.get(key) || 0;
        
        p += getWeight(tCount);
        
        // 2. Totaal confrontaties check (Samen + Tegen mag niet > 6)
        if (tCount + aCount >= 6) p += 5000000;
      }
    }
  });

  // 3. Tegen Penalty
  t1.forEach(p1 => {
    t2.forEach(p2 => {
      const key = keyFn(p1.id, p2.id);
      const aCount = ag.get(key) || 0;
      const tCount = tog.get(key) || 0;

      p += getWeight(aCount) / 2;

      // Totaal confrontaties check
      if (tCount + aCount >= 6) p += 5000000;
    });
  });

  return p;
};
