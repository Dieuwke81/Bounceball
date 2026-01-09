import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsToUse: number, // Het aantal zalen dat uit de calculator kwam
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): NKSession => {
  const playersPerMatch = playersPerTeam * 2;
  const totalSpotsNeeded = players.length * matchesPerPlayer;
  const totalMatchesToGenerate = totalSpotsNeeded / playersPerMatch;

  const matchTokens = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => matchTokens.set(p.id, matchesPerPlayer));

  // 1. Genereer eerst alle unieke matches
  const allGeneratedMatches: NKMatch[] = [];
  for (let mIdx = 0; mIdx < totalMatchesToGenerate; mIdx++) {
    const candidates = [...players].sort((a, b) => 
      matchTokens.get(b.id)! - matchTokens.get(a.id)! || Math.random() - 0.5
    );

    const selectedForMatch = candidates.slice(0, playersPerMatch);
    selectedForMatch.forEach(p => matchTokens.set(p.id, matchTokens.get(p.id)! - 1));

    let bestT1: Player[] = [];
    let bestT2: Player[] = [];
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 400; attempt++) {
      const shuffled = [...selectedForMatch].sort(() => Math.random() - 0.5);
      const t1 = shuffled.slice(0, playersPerTeam);
      const t2 = shuffled.slice(playersPerTeam);
      const k1 = t1.filter(p => p.isKeeper).length;
      const k2 = t2.filter(p => p.isKeeper).length;
      if (Math.abs(k1 - k2) > 1) continue;

      let currentPenalty = 0;
      const checkTeam = (team: Player[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const count = pairHistory.get(getPairKey(team[i].id, team[j].id)) || 0;
            currentPenalty += (count * count * 1000);
          }
        }
      };
      checkTeam(t1); checkTeam(t2);
      const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
      const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
      currentPenalty += Math.abs(avg1 - avg2) * 50;

      if (currentPenalty < lowestPenalty) { lowestPenalty = currentPenalty; bestT1 = t1; bestT2 = t2; }
      if (lowestPenalty === 0) break;
    }

    [bestT1, bestT2].forEach(team => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = getPairKey(team[i].id, team[j].id);
          pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
        }
      }
    });

    allGeneratedMatches.push({
      id: `m${mIdx}`, hallIndex: 0, team1: bestT1, team2: bestT2,
      team1Score: 0, team2Score: 0, referee: players[0], subHigh: players[0], subLow: players[0], isPlayed: false
    });
  }

  // 2. Verdeel de matches over de rondes
  const rounds: NKRound[] = [];
  const matchesToProcess = [...allGeneratedMatches];
  let roundNum = 1;

  while (matchesToProcess.length > 0) {
    const roundMatches: NKMatch[] = [];
    const playersInRound = new Set<number>();

    // Probeer de zalen VOL te maken (hallsToUse)
    for (let h = 0; h < hallsToUse; h++) {
      const matchIdx = matchesToProcess.findIndex(m => ![...m.team1, ...m.team2].some(p => playersInRound.has(p.id)));

      if (matchIdx !== -1) {
        const match = matchesToProcess.splice(matchIdx, 1)[0];
        match.hallIndex = h + 1;
        [...match.team1, ...match.team2].forEach(p => playersInRound.add(p.id));
        roundMatches.push(match);
      }
    }

    // Rollen toewijzen uit de rustende spelers
    roundMatches.forEach(match => {
      const busyInMatch = new Set([...match.team1, ...match.team2].map(p => p.id));
      const restPool = players.filter(p => !playersInRound.has(p.id) || busyInMatch.has(p.id)); 
      // We pakken mensen die NIET spelen in deze ronde
      const availableForRoles = players.filter(p => !playersInRound.has(p.id));

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        if (idx !== -1) return pool.splice(idx, 1)[0];
        return pool.shift() || players[0];
      };

      match.referee = findRole(availableForRoles, () => true);
      match.subHigh = findRole(availableForRoles, p => p.rating >= 5);
      match.subLow = findRole(availableForRoles, p => p.rating < 5);
    });

    rounds.push({ roundNumber: roundNum, matches: roundMatches, restingPlayers: players.filter(p => !playersInRound.has(p.id)) });
    roundNum++;
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};
