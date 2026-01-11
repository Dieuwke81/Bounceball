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
  const totalMatchesNeeded = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  // We proberen het hele toernooi maximaal 20 keer opnieuw als het vastloopt
  for (let tournamentAttempt = 1; tournamentAttempt <= 20; tournamentAttempt++) {
    const togetherHistory = new Map<string, number>(); 
    const againstHistory = new Map<string, number>();  
    const restTokens = new Map<number, number>(); 
    const restCounts = new Map<number, number>();
    const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

    players.forEach(p => {
      restTokens.set(p.id, totalRounds - matchesPerPlayer);
      restCounts.set(p.id, 0);
    });

    const rounds: NKRound[] = [];
    let matchesRemaining = totalMatchesNeeded;
    let tournamentFailed = false;

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
        
        // Browser feedback en ademruimte
        if (attemptCounter % 1000 === 0) {
            onProgress(`Poging ${tournamentAttempt} | Ronde ${r}: Balans zoeken...`);
            await sleep(0);
        }

        // Als we écht te lang zoeken in één ronde (>10.000 keer), versoepelen we
        if (attemptCounter > 3000) currentBalanceLimit = 0.40;
        if (attemptCounter > 7000) currentBalanceLimit = 0.60;

        // Als we na 10.000 keer nog steeds niets hebben, is dit toernooi-pad waarschijnlijk doodlopend
        if (attemptCounter > 10000) {
            tournamentFailed = true;
            break;
        }

        // 1. Kies ruster groep
        const resting = [...players].sort((a, b) => 
          (restTokens.get(b.id)! - restTokens.get(a.id)!) || Math.random() - 0.5
        ).slice(0, numPeopleToRest);

        // Check High/Low mix voor rollen
        const highRusters = resting.filter(p => p.rating >= 5).length;
        const lowRusters = resting.filter(p => p.rating < 5).length;
        if (attemptCounter < 5000 && (highRusters < hallsInRoundCount || lowRusters < hallsInRoundCount)) continue;

        const active = players.filter(p => !resting.find(res => res.id === p.id));
        
        // --- NIEUW: GLOBAL TALENT SPREAD ---
        // We sorteren de actieve spelers en verdelen ze via Snake over de zalen
        // Dit voorkomt te sterke en te zwakke wedstrijden.
        const sortedActive = active.sort((a, b) => b.rating - a.rating);
        const hallPools: Player[][] = Array.from({ length: hallsInRoundCount }, () => []);
        let hIdx = 0;
        let dir = 1;
        sortedActive.forEach(p => {
            hallPools[hIdx].push(p);
            hIdx += dir;
            if (hIdx >= hallsInRoundCount) { hIdx = hallsInRoundCount - 1; dir = -1; }
            else if (hIdx < 0) { hIdx = 0; dir = 1; }
        });

        let tempMatches: NKMatch[] = [];
        let validRound = true;

        for (let h = 0; h < hallsInRoundCount; h++) {
          const matchPool = hallPools[h];
          const t1: Player[] = [];
          const t2: Player[] = [];

          // Mirror pairing binnen de zaal voor de 0.3 balans
          const poolSorted = [...matchPool].sort((a, b) => b.rating - a.rating);
          const pairs = [];
          for (let i = 0; i < poolSorted.length; i += 2) {
              pairs.push({p1: poolSorted[i], p2: poolSorted[i+1]});
          }

          pairs.forEach((pair, idx) => {
              if (idx % 2 === 0) { t1.push(pair.p1); t2.push(pair.p2); }
              else { t1.push(pair.p2); t2.push(pair.p1); }
          });

          // Checks
          const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
          const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
          if (Math.abs(avg1 - avg2) > currentBalanceLimit) { validRound = false; break; }

          const k1 = t1.filter(p => p.isKeeper).length;
          const k2 = t2.filter(p => p.isKeeper).length;
          if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { validRound = false; break; }

          // Historie check (Samen & Tegen)
          let conflict = false;
          const checkTeam = (team: Player[]) => {
              for (let x = 0; x < team.length; x++) {
                  for (let y = x + 1; y < team.length; y++) {
                      if ((togetherHistory.get(getPairKey(team[x].id, team[y].id)) || 0) >= currentHistoryLimit) return true;
                  }
              }
              return false;
          };
          if (checkTeam(t1) || checkTeam(t2)) conflict = true;
          t1.forEach(p1 => t2.forEach(p2 => {
              if ((againstHistory.get(getPairKey(p1.id, p2.id)) || 0) >= currentHistoryLimit) conflict = true;
          }));

          if (conflict && attemptCounter < 8000) { validRound = false; break; }

          tempMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            referee: players[0], subHigh: players[0], subLow: players[0]
          });
        }

        if (validRound && tempMatches.length === hallsInRoundCount) {
          bestRoundMatches = tempMatches;
          bestResting = resting;
          roundFound = true;
        }
      }

      if (tournamentFailed) break;

      // --- ROLLEN TOEWIJZEN ---
      bestResting.forEach(p => restTokens.set(p.id, restTokens.get(p.id)! - 1));
      const rolePool = [...bestResting];
      const highReserves = rolePool.filter(p => p.rating >= 5);
      const lowReserves = rolePool.filter(p => p.rating < 5);
      
      bestRoundMatches.forEach(match => {
        match.subHigh = highReserves.length > 0 ? highReserves.shift()! : rolePool.shift()!;
        if (match.subHigh) rolePool.splice(rolePool.findIndex(p => p.id === match.subHigh.id), 1);
        
        match.subLow = lowReserves.length > 0 ? lowReserves.shift()! : rolePool.shift()!;
        if (match.subLow) rolePool.splice(rolePool.findIndex(p => p.id === match.subLow.id), 1);
        
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

    if (!tournamentFailed && rounds.length === totalRounds) {
        onProgress("Toernooi succesvol gegenereerd!");
        return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings: players.map(p => ({
            playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
        })), isCompleted: false };
    }
    
    onProgress(`Poging ${tournamentAttempt} mislukt. Herstarten...`);
    await sleep(100);
  }

  throw new Error("Het is niet gelukt om een schema te maken. Probeer de eisen iets te versoepelen.");
};
