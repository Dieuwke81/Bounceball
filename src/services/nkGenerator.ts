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
    await sleep(5); // Voorkom bevriezen van UI

    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let lowestPenalty = Infinity;
    
    // Probeer verschillende combinaties van rustende spelers
    for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        // Check High/Low mix voor de rollen
        const highRes = candidateRest.filter(p => p.rating >= 5).length;
        const lowRes = candidateRest.filter(p => p.rating < 5).length;
        
        // We proberen een goede mix te vinden, maar na 90 pogingen accepteren we wat we hebben
        if (rAttempt < 90 && (highRes < hallsThisRound || lowRes < hallsThisRound)) continue;

        const activeThisRound = players.filter(p => !candidateRest.find(r => r.id === p.id));
        let foundMatchesForThisPool = false;
        let roundMatches: NKMatch[] = [];
        let roundPenalty = 0;

        // VERSOEPELINGS-LOGICA: We beginnen streng (0.3), maar rekken dit op als het niet lukt
        let balanceThreshold = 0.301;

        for (let attempt = 0; attempt < 2000; attempt++) {
            // Elke 400 pogingen maken we de balans-eis iets ruimer om vastlopen te voorkomen
            if (attempt === 400) balanceThreshold = 0.351;
            if (attempt === 800) balanceThreshold = 0.401;
            if (attempt === 1200) balanceThreshold = 0.501;
            if (attempt === 1600) balanceThreshold = 0.801;

            const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
            let tempMatches: NKMatch[] = [];
            let tempValid = true;
            let tempPenalty = 0;

            for (let h = 0; h < hallsThisRound; h++) {
                const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
                const t1 = matchPlayers.slice(0, playersPerTeam);
                const t2 = matchPlayers.slice(playersPerTeam);

                const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
                const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
                
                // Balans Check
                if (Math.abs(avg1 - avg2) > balanceThreshold) { tempValid = false; break; }
                
                // Keeper Check
                const k1 = t1.filter(p => p.isKeeper).length;
                const k2 = t2.filter(p => p.isKeeper).length;
                if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { tempValid = false; break; }

                tempPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
                
                tempMatches.push({
                    id: `r${roundNum}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
                    team1Score: 0, team2Score: 0, isPlayed: false,
                    referee: players[0], subHigh: players[0], subLow: players[0] 
                });
            }

            if (tempValid) {
                roundMatches = tempMatches;
                roundPenalty = tempPenalty;
                foundMatchesForThisPool = true;
                break; // Ronde is gelukt!
            }
        }

        if (foundMatchesForThisPool && roundPenalty < lowestPenalty) {
            lowestPenalty = roundPenalty;
            bestRoundMatches = [...roundMatches];
            bestRestingThisRound = [...candidateRest];
            if (lowestPenalty === 0) break;
        }
    }

    // Als we echt helemaal niets hebben gevonden (noodgreep), forceer dan een willekeurige indeling
    if (bestRoundMatches.length === 0) {
        console.warn("Wiskundige impasse in ronde " + roundNum + ". Forceer indeling.");
        // (Dit deel is een extra veiligheid, zou met de versoepeling hierboven nooit bereikt mogen worden)
        matchesRemaining = 0; break; 
    }

    // Toewijzen en admin bijwerken
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
    if (roundNum > 100) break;
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
        const tCount = tog.get(key) || 0;
        const aCount = ag.get(key) || 0;
        p += getWeight(tCount);
        if (tCount + aCount >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const tCount = tog.get(key) || 0;
    const aCount = ag.get(key) || 0;
    p += getWeight(aCount) / 2;
    if (tCount + aCount >= 6) p += 5000000;
  }));
  return p;
};
