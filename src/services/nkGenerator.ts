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

  // Splits spelers in High en Low voor gegarandeerde reserves
  const highPool = players.filter(p => p.rating >= 5);
  const lowPool = players.filter(p => p.rating < 5);

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;
  let roundNum = 1;

  while (matchesRemaining > 0) {
    await sleep(10); 

    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const totalToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let roundFound = false;

    // 1. KIES RUSTERS (Harde High/Low mix garantie)
    for (let rAttempt = 0; rAttempt < 500; rAttempt++) {
        // We moeten per zaal 1 High en 1 Low reserve hebben.
        // Dus we dwingen dat er in de rustgroep minimaal 'hallsThisRound' van elk zit.
        const shuffledHigh = [...highPool].sort((a, b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);
        const shuffledLow = [...lowPool].sort((a, b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);

        // Pak de mensen die het hardst rust nodig hebben
        const highResters = shuffledHigh.slice(0, hallsThisRound);
        const lowResters = shuffledLow.slice(0, hallsThisRound);
        
        // De rest van de rustplekken vullen we aan met de overgebleven mensen die de meeste rust nodig hebben
        const remainingPossibleResters = [
            ...shuffledHigh.slice(hallsThisRound),
            ...shuffledLow.slice(hallsThisRound)
        ].sort((a, b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);

        const extraRestersNeeded = totalToRest - (highResters.length + lowResters.length);
        const restingThisRoundCandidate = [...highResters, ...lowResters, ...remainingPossibleResters.slice(0, extraRestersNeeded)];

        if (restingThisRoundCandidate.length !== totalToRest) continue;

        const activeThisRound = players.filter(p => !restingThisRoundCandidate.find(r => r.id === p.id));
        
        // 2. MAAK TEAMS (Met glijdende balans)
        let balanceThreshold = 0.301;
        let foundMatches = false;

        for (let attempt = 0; attempt < 2000; attempt++) {
            if (attempt > 800) balanceThreshold = 0.401;
            if (attempt > 1500) balanceThreshold = 0.601;

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
                bestRestingThisRound = restingThisRoundCandidate;
                foundMatches = true;
                roundFound = true;
                break;
            }
        }
        if (roundFound) break;
    }

    if (roundFound) {
        bestRestingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
        const rolePool = [...bestRestingThisRound];
        
        const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
            const idx = pool.findIndex(cond);
            return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
        };

        bestRoundMatches.forEach(match => {
            // ✅ HIER WORDEN ZE STRIKT TOEGEWEZEN
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
        break; 
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
