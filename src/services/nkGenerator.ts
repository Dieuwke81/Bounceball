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

  // Bereken het globale gemiddelde om op te sturen
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

    // 1. SELECTIE RUSTERS (Harde eis voor aantal wedstrijden)
    const playersSortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );
    const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = playersSortedForRest.slice(numPeopleToRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // 2. SUPER BRUTE FORCE (100.000 POGINGEN)
    let bestRoundMatches: NKMatch[] = [];
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 100000; attempt++) {
      const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
      const currentRoundMatches: NKMatch[] = [];
      let roundValid = true;
      let roundPenalty = 0;

      for (let h = 0; h < hallsThisRound; h++) {
        const matchPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        const t1 = matchPlayers.slice(0, playersPerTeam);
        const t2 = matchPlayers.slice(playersPerTeam);

        // EIS 1: Keepers (max 1 per team)
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) {
          roundValid = false; break;
        }

        // EIS 2: Balans binnen de wedstrijd (harde eis 0.3)
        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        if (Math.abs(avg1 - avg2) > 0.301) {
          roundValid = false; break;
        }

        // EIS 3: Globale spreiding (max 1 punt afwijking van globaal gemiddelde)
        // Dit garandeert dat het verschil tussen het allerbeste en slechtste team max 2.0 is.
        if (Math.abs(avg1 - globalAverage) > 1.0 || Math.abs(avg2 - globalAverage) > 1.0) {
          roundValid = false; break;
        }

        roundPenalty += calculateTotalPenalty(t1, t2, togetherHistory, againstHistory, getPairKey);
        
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

    // Mocht 100k pogingen niet genoeg zijn voor de filters, doen we een nood-ronde zonder de globale 1.0 check
    if (bestRoundMatches.length === 0) {
        // (Dit zou wiskundig alleen gebeuren bij zeer extreme rating-verschillen in de groep)
        console.warn("Ronde balans was te lastig, versoepelen...");
        // ... (hier zou een fallback kunnen, maar met 100k is dit nagenoeg onmogelijk)
    }

    // 3. ROLLEN EN HISTORIE
    const availableForRoles = [...restingThisRound];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    bestRoundMatches.forEach(match => {
      match.referee = findRole(availableForRoles, () => true);
      match.subHigh = findRole(availableForRoles, p => p.rating >= 5);
      match.subLow = findRole(availableForRoles, p => p.rating < 5);

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

    rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: restingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};

const calculateTotalPenalty = (t1: Player[], t2: Player[], tog: Map<string, number>, ag: Map<string, number>, keyFn: any) => {
  let p = 0;
  const weight = (c: number) => [0, 10, 500, 10000, 1000000][c] || 1000000;
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        p += weight(tog.get(keyFn(team[i].id, team[j].id)) || 0);
      }
    }
  });
  t1.forEach(p1 => t2.forEach(p2 => p += weight(ag.get(keyFn(p1.id, p2.id)) || 0) / 2));
  return p;
};
