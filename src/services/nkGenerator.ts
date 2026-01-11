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
  const restCounts = new Map<number, number>(); 
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    await sleep(5);
    const hallsThisRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // --- STAP 1: KIES DE RUSTERS (GEGARANDEERDE MIX) ---
    // Sorteer op wie het minst gerust heeft
    const highRated = players.filter(p => p.rating >= 5).sort((a,b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);
    const lowRated = players.filter(p => p.rating < 5).sort((a,b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);

    const restingThisRound: Player[] = [];
    
    // Dwing 1 high en 1 low ruster per zaal af voor de reserves
    for(let i=0; i<hallsThisRound; i++) {
        if(highRated.length > 0) restingThisRound.push(highRated.shift()!);
        if(lowRated.length > 0) restingThisRound.push(lowRated.shift()!);
    }

    // Vul de rest van de rust-plekken aan met wie er over is en rust nodig heeft
    const remainder = [...highRated, ...lowRated].sort((a,b) => restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5);
    while(restingThisRound.length < numPeopleToRest && remainder.length > 0) {
        restingThisRound.push(remainder.shift()!);
    }

    // Update administratie
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));
    const activeThisRound = players.filter(p => !restingThisRound.find(res => res.id === p.id));

    // --- STAP 2: MAAK DE MATCHES (BRUTE FORCE) ---
    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;
    let roundFound = false;
    let balanceThreshold = 0.301;

    onProgress(`Ronde ${r}: Teams berekenen...`);

    // We doen 100.000 pogingen per ronde voor de beste variatie
    for (let attempt = 0; attempt < 100000; attempt++) {
        if (attempt > 0 && attempt % 20000 === 0) {
            balanceThreshold += 0.05; // Versoepel heel langzaam
            await sleep(0);
        }

        const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
        let tempMatches: NKMatch[] = [];
        let valid = true;
        let tempPenalty = 0;

        for (let h = 0; h < hallsThisRound; h++) {
            const mPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
            const t1 = mPlayers.slice(0, playersPerTeam);
            const t2 = mPlayers.slice(playersPerTeam);

            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            
            // Harde eisen
            if (Math.abs(avg1 - avg2) > balanceThreshold) { valid = false; break; }
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

            tempPenalty += calculateEnhancedPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
            
            tempMatches.push({
                id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
                team1Score: 0, team2Score: 0, isPlayed: false,
                referee: players[0], subHigh: players[0], subLow: players[0]
            });
        }

        if (valid) {
            if (tempPenalty < lowestPenalty) {
                lowestPenalty = tempPenalty;
                bestRoundMatches = JSON.parse(JSON.stringify(tempMatches));
                roundFound = true;
            }
            if (lowestPenalty === 0) break;
        }
    }

    // --- STAP 3: ROLLEN EN HISTORIE ---
    if (roundFound) {
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

        rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: restingThisRound });
    } else {
        throw new Error(`Kan geen eerlijke verdeling vinden voor ronde ${r}.`);
    }
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
        const togC = tog.get(key) || 0;
        const agC = ag.get(key) || 0;
        p += getWeight(togC);
        if (togC + agC >= 6) p += 5000000;
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => {
    const key = keyFn(p1.id, p2.id);
    const togC = tog.get(key) || 0;
    const agC = ag.get(key) || 0;
    p += getWeight(agC) / 2;
    if (togC + agC >= 6) p += 5000000;
  }));
  return p;
};
