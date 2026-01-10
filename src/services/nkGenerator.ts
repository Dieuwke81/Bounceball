import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper voor de penalty-berekening
const calculateEnhancedPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: (id1: number, id2: number) => string) => {
  let p = 0;
  const getWeight = (count: number) => [0, 10, 500, 10000, 2000000][Math.floor(count)] || 2000000;
  
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
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
    if (tC + agC >= 6) p += 5000000;
  }));
  return p;
};

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

  const togetherHistory = new Map<string, number>();
  const againstHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  const restTokens = new Map<number, number>();
  players.forEach(p => restTokens.set(p.id, totalRounds - matchesPerPlayer));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;
  let roundNum = 1;

  while (matchesRemaining > 0) {
    await sleep(5);

    const hallsThisRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRoundCount * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let foundRound = false;

    // We proberen 100 verschillende groepen rusters
    for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
      const sortedByRest = [...players].sort((a, b) => 
        (restTokens.get(b.id)! - restTokens.get(a.id)!) || Math.random() - 0.5
      );
      const resting = sortedByRest.slice(0, numPeopleToRest);
      const active = players.filter(p => !resting.find(r => r.id === p.id));

      let balanceThreshold = 0.301;
      // Doe per ruster-groep 1000 pogingen om teams te maken
      for (let attempt = 0; attempt < 1000; attempt++) {
        if (attempt > 400) balanceThreshold = 0.401;
        if (attempt > 800) balanceThreshold = 0.601;

        const shuffledActive = [...active].sort(() => Math.random() - 0.5);
        let tempMatches: NKMatch[] = [];
        let valid = true;

        for (let h = 0; h < hallsThisRoundCount; h++) {
          const mPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
          const t1 = mPlayers.slice(0, playersPerTeam);
          const t2 = mPlayers.slice(playersPerTeam);

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
          bestRestingThisRound = resting;
          foundRound = true;
          break;
        }
      }
      if (foundRound) break;
    }

    if (foundRound) {
      bestRestingThisRound.forEach(p => restTokens.set(p.id, restTokens.get(p.id)! - 1));
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
        matchesRemaining = 0; // Noodstop
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
