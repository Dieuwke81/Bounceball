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
  
  const globalAverage = players.reduce((s, p) => s + p.rating, 0) / players.length;
  const restCounts = new Map<number, number>();
  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;
  let roundNum = 1;

  // Blijf rondes maken zolang er nog wedstrijden gespeeld moeten worden
  while (matchesRemaining > 0) {
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;
    
    // We verhogen de balans-marge heel langzaam als we echt geen match kunnen vinden
    // Dit voorkomt lege rondes.
    let allowedBalanceMargin = 0.301;

    // We proberen verschillende combinaties van rusters/spelers
    for (let outerAttempt = 0; outerAttempt < 100; outerAttempt++) {
        const playersSortedForRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        );

        const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
        const activeThisRound = playersSortedForRest.slice(numPeopleToRest);
        
        // Check of de rustgroep de juiste reserves kan leveren (High/Low)
        const highReserves = restingThisRound.filter(p => p.rating >= 5).length;
        const lowReserves = restingThisRound.filter(p => p.rating < 5).length;
        
        if (highReserves < hallsThisRound || lowReserves < hallsThisRound) continue;

        // Nu we een geldige pool hebben, probeer de teams te verdelen
        for (let attempt = 0; attempt < 1000; attempt++) {
            const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
            const currentRoundMatches: NKMatch[] = [];
            let roundValid = true;
            let roundPenalty = 0;

            for (let h = 0; h < hallsThisRound; h++) {
                const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
                const t1 = matchPlayers.slice(0, playersPerTeam);
                const t2 = matchPlayers.slice(playersPerTeam);

                const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
                const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
                
                // Balans check met de (eventueel versoepelde) marge
                if (Math.abs(avg1 - avg2) > allowedBalanceMargin) { roundValid = false; break; }
                
                // Keeper check
                const k1 = t1.filter(p => p.isKeeper).length;
                const k2 = t2.filter(p => p.isKeeper).length;
                if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { roundValid = false; break; }

                // Toernooi-breed balans check (spreiding max 2.0)
                if (Math.abs(avg1 - globalAverage) > 1.2 || Math.abs(avg2 - globalAverage) > 1.2) {
                    roundValid = false; break;
                }

                roundPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
                
                currentRoundMatches.push({
                    id: `r${roundNum}h${h}`, hallIndex: h + 1, team1: t1, team2: t2,
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

        // Als we na 50 pogingen met rusters nog niks hebben, verruimen we de balans een heel klein beetje
        if (outerAttempt > 50 && bestRoundMatches.length === 0) {
            allowedBalanceMargin += 0.05;
        }
        
        if (bestRoundMatches.length > 0) {
            // We hebben een ronde gevonden! Sla de rusters op.
            restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
            
            const rolePool = [...restingThisRound];
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

            rounds.push({ roundNumber: roundNum, matches: bestRoundMatches, restingPlayers: restingThisRound });
            roundNum++;
            break; // Stop outerAttempt loop, ga naar volgende ronde
        }
    }
    
    if (roundNum > 100) break; // Veiligheid
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
        p += getWeight(tog.get(key) || 0);
        if ((tog.get(key)||0) + (ag.get(key)||0) >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    p += getWeight(ag.get(key) || 0) / 2;
    if ((tog.get(key)||0) + (ag.get(key)||0) >= 6) p += 5000000;
  }));
  return p;
};
