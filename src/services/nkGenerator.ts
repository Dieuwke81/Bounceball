import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsCount: number,
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

  players.forEach(p => {
    matchTokens.set(p.id, matchesPerPlayer);
  });

  const allGeneratedMatches: NKMatch[] = [];

  for (let mIdx = 0; mIdx < totalMatchesToGenerate; mIdx++) {
    const candidates = [...players].sort((a, b) => {
      const tokensA = matchTokens.get(a.id)!;
      const tokensB = matchTokens.get(b.id)!;
      return tokensB - tokensA || Math.random() - 0.5;
    });

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
      checkTeam(t1);
      checkTeam(t2);

      const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
      const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
      currentPenalty += Math.abs(avg1 - avg2) * 50;

      if (currentPenalty < lowestPenalty) {
        lowestPenalty = currentPenalty;
        bestT1 = t1;
        bestT2 = t2;
      }
      if (lowestPenalty === 0) break;
    }

    const updateHistory = (team: Player[]) => {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = getPairKey(team[i].id, team[j].id);
          pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
        }
      }
    };
    updateHistory(bestT1);
    updateHistory(bestT2);

    allGeneratedMatches.push({
      id: `m${mIdx}`,
      hallIndex: 0,
      team1: bestT1,
      team2: bestT2,
      team1Score: 0,
      team2Score: 0,
      referee: players[0],
      subHigh: players[0],
      subLow: players[0],
      isPlayed: false // Wedstrijd is nog niet begonnen
    });
  }

  const rounds: NKRound[] = [];
  const matchesToProcess = [...allGeneratedMatches];
  let roundNum = 1;

  while (matchesToProcess.length > 0) {
    const roundMatches: NKMatch[] = [];
    const playersInRound = new Set<number>();

    for (let h = 0; h < hallsCount; h++) {
      const matchIdx = matchesToProcess.findIndex(m => {
        const matchPlayers = [...m.team1, ...m.team2];
        return !matchPlayers.some(p => playersInRound.has(p.id));
      });

      if (matchIdx !== -1) {
        const match = matchesToProcess.splice(matchIdx, 1)[0];
        match.hallIndex = h + 1;
        
        const currentInRoundIds = new Set([...playersInRound]);
        [...match.team1, ...match.team2].forEach(p => currentInRoundIds.add(p.id));
        roundMatches.forEach(rm => [...rm.team1, ...rm.team2].forEach(p => currentInRoundIds.add(p.id)));

        const restPool = players.filter(p => !currentInRoundIds.has(p.id));
        const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
            const idx = pool.findIndex(cond);
            const p = idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
            if (p) playersInRound.add(p.id);
            return p;
        };

        match.referee = findRole(restPool, () => true) as Player;
        match.subHigh = findRole(restPool, p => p.rating >= 5) as Player;
        match.subLow = findRole(restPool, p => p.rating < 5) as Player;

        roundMatches.push(match);
        [...match.team1, ...match.team2].forEach(p => playersInRound.add(p.id));
      }
    }

    rounds.push({
      roundNumber: roundNum,
      matches: roundMatches,
      restingPlayers: players.filter(p => !playersInRound.has(p.id))
    });
    roundNum++;
    if (roundNum > 200) break;
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount, playersPerTeam, rounds, standings, isCompleted: false };
};
