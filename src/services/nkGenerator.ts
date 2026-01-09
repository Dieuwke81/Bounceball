import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsCount: number,
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): NKSession => {
  const playersPerMatch = playersPerTeam * 2;
  const matchTokens = new Map<number, number>();
  players.forEach(p => matchTokens.set(p.id, matchesPerPlayer));

  const rounds: NKRound[] = [];
  let roundNum = 1;

  while (Array.from(matchTokens.values()).some(count => count > 0)) {
    const roundMatches: NKMatch[] = [];
    const playersPlayingThisRound = new Set<number>();

    // We vullen zalen zolang er genoeg mensen zijn die nog MOETEN spelen
    const playersWithTokens = players.filter(p => matchTokens.get(p.id)! > 0);
    let hallsToFill = Math.min(hallsCount, Math.floor(playersWithTokens.length / playersPerMatch));

    for (let h = 0; h < hallsToFill; h++) {
      const candidates = players
        .filter(p => !playersPlayingThisRound.has(p.id) && matchTokens.get(p.id)! > 0)
        .sort((a, b) => matchTokens.get(b.id)! - matchTokens.get(a.id)! || Math.random() - 0.5);

      if (candidates.length < playersPerMatch) break;

      const matchPlayers = candidates.slice(0, playersPerMatch);
      matchPlayers.forEach(p => playersPlayingThisRound.add(p.id));

      const keepers = matchPlayers.filter(p => p.isKeeper);
      const fieldPlayers = matchPlayers.filter(p => !p.isKeeper);
      const team1: Player[] = [];
      const team2: Player[] = [];

      if (keepers.length >= 2) {
        team1.push(keepers.shift()!); team2.push(keepers.shift()!);
      } else if (keepers.length === 1) {
        team1.push(keepers.shift()!);
      }

      fieldPlayers.forEach(p => {
        if (team1.length < playersPerTeam) team1.push(p); else team2.push(p);
      });
      keepers.forEach(p => {
        if (team1.length < playersPerTeam) team1.push(p); else team2.push(p);
      });

      const restPool = players.filter(p => !playersPlayingThisRound.has(p.id));
      const findRole = (pool: Player[], condition: (p: Player) => boolean) => {
        const idx = pool.findIndex(condition);
        if (idx !== -1) {
          const p = pool[idx];
          playersPlayingThisRound.add(p.id);
          return p;
        }
        return pool.length > 0 ? pool[0] : players[0]; 
      };

      const referee = findRole(restPool, () => true);
      const subHigh = findRole(restPool.filter(p => p.id !== referee.id), p => p.rating >= 5);
      const subLow = findRole(restPool.filter(p => p.id !== referee.id && p.id !== subHigh.id), p => p.rating < 5);

      matchPlayers.forEach(p => matchTokens.set(p.id, matchTokens.get(p.id)! - 1));

      roundMatches.push({
        id: `r${roundNum}h${h}`,
        hallIndex: h + 1,
        team1, team2,
        team1Score: 0, team2Score: 0,
        referee, subHigh, subLow
      });
    }

    if (roundMatches.length > 0) {
      rounds.push({
        roundNumber: roundNum,
        matches: roundMatches,
        restingPlayers: players.filter(p => !playersPlayingThisRound.has(p.id))
      });
      roundNum++;
    } else break;
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount, playersPerTeam, rounds, standings, isCompleted: false };
};
