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

  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const restTokens = new Map<number, number>(); 
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => {
    restTokens.set(p.id, totalRounds - matchesPerPlayer);
  });

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const hallsInRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsInRoundCount * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestResting: Player[] = [];
    let roundFound = false;

    let currentBalanceLimit = 0.30;
    let currentHistoryLimit = 3;
    let attemptCounter = 0;

    while (!roundFound) {
      attemptCounter++;
      if (attemptCounter % 1000 === 0) {
          currentBalanceLimit += 0.05;
          if (attemptCounter % 3000 === 0) currentHistoryLimit++;
          onProgress(`Ronde ${r}: Balans naar ${currentBalanceLimit.toFixed(2)}...`);
          await sleep(0);
      }

      // 1. Kies ruster groep op basis van tokens
      const resting = [...players].sort((a, b) => 
        (restTokens.get(b.id)! - restTokens.get(a.id)!) || Math.random() - 0.5
      ).slice(0, numPeopleToRest);

      // Check of de rustgroep wiskundig de mix KAN leveren
      const highRusters = resting.filter(p => p.rating >= 5).length;
      const lowRusters = resting.filter(p => p.rating < 5).length;
      
      // We hebben per zaal 1 High en 1 Low reserve nodig
      if (attemptCounter < 5000 && (highRusters < hallsInRoundCount || lowRusters < hallsInRoundCount)) continue;

      const active = players.filter(p => !resting.find(res => res.id === p.id));
      const shuffledActive = [...active].sort(() => Math.random() - 0.5);
      
      let tempMatches: NKMatch[] = [];
      let valid = true;

      for (let h = 0; h < hallsInRoundCount; h++) {
        const mPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        if (mPlayers.length < playersPerMatch) { valid = false; break; }

        const t1 = mPlayers.slice(0, playersPerTeam);
        const t2 = mPlayers.slice(playersPerTeam);

        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        if (Math.abs(avg1 - avg2) > currentBalanceLimit) { valid = false; break; }

        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

        let historyConflict = false;
        const checkHistory = (team: Player[]) => {
            for (let x = 0; x < team.length; x++) {
                for (let y = x + 1; y < team.length; y++) {
                    if ((togetherHistory.get(getPairKey(team[x].id, team[y].id)) || 0) >= currentHistoryLimit) return true;
                }
            }
            return false;
        };
        if (checkHistory(t1) || checkHistory(t2)) historyConflict = true;
        if (historyConflict && attemptCounter < 4000) { valid = false; break; }

        tempMatches.push({
          id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
          team1Score: 0, team2Score: 0, isPlayed: false,
          referee: players[0], subHigh: players[0], subLow: players[0]
        });
      }

      if (valid && tempMatches.length === hallsInRoundCount) {
        bestRoundMatches = tempMatches;
        bestResting = resting;
        roundFound = true;
      }
      
      if (attemptCounter > 15000) break; // Harde stop voor stabiliteit
    }

    // --- STAP 3: ROLLEN TOEWIJZEN (DE "UITWEG" LOGICA) ---
    if (roundFound) {
      bestResting.forEach(p => restTokens.set(p.id, restTokens.get(p.id)! - 1));
      
      const rolePool = [...bestResting];
      
      // ✅ We wijzen nu eerst de kritieke rollen toe uit de hele rust-pool
      const highReserves = rolePool.filter(p => p.rating >= 5);
      const lowReserves = rolePool.filter(p => p.rating < 5);
      const chosenSubHigh: Player[] = [];
      const chosenSubLow: Player[] = [];

      for (let i = 0; i < hallsInRoundCount; i++) {
          // Pak een High player voor reserve
          const hIdx = highReserves.length > 0 ? 0 : -1;
          if (hIdx !== -1) {
              const p = highReserves.shift()!;
              chosenSubHigh.push(p);
              rolePool.splice(rolePool.findIndex(rp => rp.id === p.id), 1);
          } else {
              chosenSubHigh.push(rolePool.shift() || players[0]);
          }

          // Pak een Low player voor reserve
          const lIdx = lowReserves.length > 0 ? 0 : -1;
          if (lIdx !== -1) {
              const p = lowReserves.shift()!;
              chosenSubLow.push(p);
              rolePool.splice(rolePool.findIndex(rp => rp.id === p.id), 1);
          } else {
              chosenSubLow.push(rolePool.shift() || players[0]);
          }
      }

      // De overgebleven mensen in rolePool zijn nu beschikbaar als scheidsrechter
      bestRoundMatches.forEach((match, idx) => {
        match.subHigh = chosenSubHigh[idx];
        match.subLow = chosenSubLow[idx];
        match.referee = rolePool.shift() || players[0];

        // Update historie
        const updateP = (p1: number, p2: number, map: Map<string, number>) => {
          const key = getPairKey(p1, p2);
          map.set(key, (map.get(key) || 0) + 1);
        };
        match.team1.forEach(p1 => {
          match.team1.forEach(p2 => { if(p1.id !== p2.id) updateP(p1.id, p2.id, togetherHistory); });
          match.team2.forEach(p2 => { updateP(p1.id, p2.id, againstHistory); });
        });
        match.team2.forEach(p1 => {
          match.team2.forEach(p2 => { if(p1.id !== p2.id) updateP(p1.id, p2.id, togetherHistory); });
        });
        matchesRemaining--;
      });

      rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: bestResting });
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
