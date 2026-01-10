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
  const totalSpots = players.length * matchesPerPlayer;
  const totalMatches = totalSpots / playersPerMatch;
  const totalRounds = Math.ceil(totalMatches / hallNames.length);

  // Administratie voor historie en rust
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const restTokens = new Map<number, number>(); // Hoe vaak moet je nog rusten?
  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');
  const totalRestsPerPerson = totalRounds - matchesPerPlayer;

  players.forEach(p => {
    restTokens.set(p.id, totalRestsPerPerson);
  });

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatches;

  for (let r = 1; r <= totalRounds; r++) {
    // Geef de browser tijd om te ademen en het laadscherm te tonen
    await sleep(10);

    const hallsThisRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRoundCount * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let lowestPenalty = Infinity;

    // --- BRUTE FORCE LOOP VOOR DEZE RONDE ---
    // We doen heel veel pogingen om de perfecte verdeling te vinden
    const MAX_ATTEMPTS = 50000; 
    let currentBalanceThreshold = 0.301;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Browser rustmoment om de 5000 pogingen
      if (attempt % 5000 === 0) await sleep(0);

      // 1. Kies wie er rusten
      // We pakken mensen die nog rust-tokens hebben
      const shuffledForRest = [...players].sort((a, b) => 
        (restTokens.get(b.id)! - restTokens.get(a.id)!) || Math.random() - 0.5
      );
      const resting = shuffledForRest.slice(0, numPeopleToRest);
      
      // Check of deze rustgroep genoeg High/Low heeft voor de rollen
      const highRes = resting.filter(p => p.rating >= 5).length;
      const lowRes = resting.filter(p => p.rating < 5).length;
      if (attempt < 40000 && (highRes < hallsThisRoundCount || lowRes < hallsThisRoundCount)) continue;

      const active = players.filter(p => !resting.find(r => r.id === p.id));
      const shuffledActive = [...active].sort(() => Math.random() - 0.5);

      let tempMatches: NKMatch[] = [];
      let roundValid = true;
      let roundPenalty = 0;

      // Versoepel balans-eis heel langzaam naarmate we meer pogingen doen
      if (attempt > 10000) currentBalanceThreshold = 0.351;
      if (attempt > 20000) currentBalanceThreshold = 0.401;
      if (attempt > 30000) currentBalanceThreshold = 0.501;
      if (attempt > 45000) currentBalanceThreshold = 1.001;

      for (let h = 0; h < hallsThisRoundCount; h++) {
        const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        const t1 = matchPlayers.slice(0, playersPerTeam);
        const t2 = matchPlayers.slice(playersPerTeam);

        // Check Keeper (max 1 per team)
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

        // Check Balans (0.3 grens)
        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        if (Math.abs(avg1 - avg2) > currentBalanceThreshold) { roundValid = false; break; }

        // Bereken Penalty
        tempPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);

        tempMatches.push({
          id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
          team1Score: 0, team2Score: 0, isPlayed: false,
          referee: players[0], subHigh: players[0], subLow: players[0]
        });
      }

      if (roundValid && tempPenalty < lowestPenalty) {
        lowestPenalty = tempPenalty;
        bestRoundMatches = [...tempMatches];
        bestRestingThisRound = [...resting];
        if (lowestPenalty === 0) break;
      }
    }

    // --- FINALIZEER RONDE ---
    if (bestRoundMatches.length > 0) {
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

        // Update historie
        match.team1.forEach(p1 => {
          match.team1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
          match.team2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
        });
        match.team2.forEach(p1 => {
          match.team2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
        });
        matchesRemaining--;
      });

      rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: bestRestingThisRound });
    } else {
      console.error("Kon ronde " + r + " niet genereren.");
      break;
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};

const calculateEnhancedPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: any) => {
  let p = 0;
  const weight = (count: number) => [0, 10, 500, 10000, 2000000][Math.floor(count)] || 2000000;
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const key = keyFn(team[i].id, team[j].id);
        const tC = tog.get(key) || 0;
        const aC = ag.get(key) || 0;
        p += weight(tC);
        if (tC + aC >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const tC = tog.get(key) || 0;
    const aC = ag.get(key) || 0;
    p += weight(aC) / 2;
    if (tC + aC >= 6) p += 5000000;
  }));
  return p;
};
