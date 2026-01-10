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

  // We gaan door tot alle wedstrijden gepland zijn
  while (matchesRemaining > 0) {
    await sleep(10); // Pauze voor de UI

    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    
    // 1. KIES RUSTERS (Harde eis voor aantal wedstrijden)
    // We proberen 200 combinaties van rusters om een goede High/Low mix te vinden
    for (let rAttempt = 0; rAttempt < 200; rAttempt++) {
        const candidateRest = [...players].sort((a, b) => 
            restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
        ).slice(0, numPeopleToRest);
        
        const highRes = candidateRest.filter(p => p.rating >= 5).length;
        const lowRes = candidateRest.filter(p => p.rating < 5).length;
        
        // We hebben 1 High en 1 Low nodig PER ZAAL
        if (highRes >= hallsThisRound && lowRes >= hallsThisRound) {
            bestRestingThisRound = candidateRest;
            break;
        }
        // Noodgreep: als we na veel pogingen geen ideale mix vinden, accepteren we de beste ruster-groep
        if (rAttempt === 199) bestRestingThisRound = candidateRest;
    }

    const activeThisRound = players.filter(p => !bestRestingThisRound.find(r => r.id === p.id));

    // 2. MAAK TEAMS (Met glijdende balans-eis om stoppen te voorkomen)
    let roundFound = false;
    let balanceThreshold = 0.301;

    for (let attempt = 0; attempt < 10000; attempt++) {
        // VERSOEPELING: Elke 1000 pogingen maken we de balans 0.1 ruimer
        if (attempt > 0 && attempt % 1000 === 0) {
            balanceThreshold += 0.1;
        }

        const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
        let currentRoundMatches: NKMatch[] = [];
        let valid = true;

        for (let h = 0; h < hallsThisRound; h++) {
            const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
            const t1 = matchPlayers.slice(0, playersPerTeam);
            const t2 = matchPlayers.slice(playersPerTeam);

            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            
            // Balans check
            if (Math.abs(avg1 - avg2) > balanceThreshold) { valid = false; break; }
            
            // Keeper check
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

            currentRoundMatches.push({
                id: `r${roundNum}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
                team1Score: 0, team2Score: 0, isPlayed: false,
                referee: players[0], subHigh: players[0], subLow: players[0] 
            });
        }

        if (valid) {
            bestRoundMatches = currentRoundMatches;
            roundFound = true;
            break;
        }
    }

    // 3. ADMIN & ROLLEN
    if (roundFound) {
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

            // Update historie
            [match.team1, match.team2].forEach(team => {
                for (let i = 0; i < team.length; i++) {
                    for (let j = i+1; j < team.length; j++) {
                        const key = getPairKey(team[i].id, team[j].id);
                        togetherHistory.set(key, (togetherHistory.get(key) || 0) + 1);
                    }
                }
            });
            match.team1.forEach(p1 => match.team2.forEach(p2 => {
                const key = getPairKey(p1.id, p2.id);
                againstHistory.set(key, (againstHistory.get(key) || 0) + 1);
            }));
            matchesRemaining--;
        });

        rounds.push({ roundNumber: roundNum, matches: bestRoundMatches, restingPlayers: bestRestingThisRound });
        roundNum++;
    } else {
        // Dit mag nooit gebeuren met de versoepeling, maar voor de zekerheid:
        console.error("Critical Failure in Round " + roundNum);
        break;
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
