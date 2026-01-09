import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsCount: number,
  totalRounds: number,
  playersPerTeam: number, // Nieuwe parameter
  competitionName: string
): NKSession => {
  
  const playerStats = new Map<number, { played: number, ref: number, sub: number }>();
  players.forEach(p => playerStats.set(p.id, { played: 0, ref: 0, sub: 0 }));

  const rounds: NKRound[] = [];
  const playersPerMatch = playersPerTeam * 2;

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const availablePlayers = [...players].sort((a, b) => {
        return playerStats.get(a.id)!.played - playerStats.get(b.id)!.played || Math.random() - 0.5;
    });

    let hallsThisRound = hallsCount;
    
    if (r === totalRounds) {
        const totalSpots = totalRounds * hallsCount * playersPerMatch;
        const target = Math.floor(totalSpots / players.length);
        const needToPlay = players.filter(p => playerStats.get(p.id)!.played < target);
        hallsThisRound = Math.max(1, Math.ceil(needToPlay.length / playersPerMatch));
    }

    const roundActivePlayers = availablePlayers.splice(0, hallsThisRound * playersPerMatch);
    const restPool = [...availablePlayers];

    for (let h = 0; h < hallsThisRound; h++) {
      const matchPlayers = roundActivePlayers.splice(0, playersPerMatch);
      if (matchPlayers.length < playersPerMatch) break;

      const keepers = matchPlayers.filter(p => p.isKeeper);
      const fieldPlayers = matchPlayers.filter(p => !p.isKeeper);
      
      const team1: Player[] = [];
      const team2: Player[] = [];

      if (keepers.length >= 2) {
        team1.push(keepers.shift()!);
        team2.push(keepers.shift()!);
      } else if (keepers.length === 1) {
        team1.push(keepers.shift()!);
      }

      fieldPlayers.forEach(p => {
        if (team1.length < playersPerTeam) team1.push(p);
        else team2.push(p);
      });

      // Mocht er nog een keeper over zijn (bijv. 3 keepers in 1 match pool)
      keepers.forEach(k => {
        if (team1.length < playersPerTeam) team1.push(k);
        else team2.push(k);
      });

      const findRolePlayer = (pool: Player[], criteria: (p: Player) => boolean): Player | null => {
          const idx = pool.findIndex(criteria);
          if (idx !== -1) return pool.splice(idx, 1)[0];
          return pool.length > 0 ? pool.splice(0, 1)[0] : null;
      };

      const referee = findRolePlayer(restPool, (p) => true); 
      const subHigh = findRolePlayer(restPool, (p) => p.rating >= 5);
      const subLow = findRolePlayer(restPool, (p) => p.rating < 5);

      if (referee) playerStats.get(referee.id)!.ref++;
      if (subHigh) playerStats.get(subHigh.id)!.sub++;
      if (subLow) playerStats.get(subLow.id)!.sub++;

      [...team1, ...team2].forEach(p => playerStats.get(p.id)!.played++);

      roundMatches.push({
        id: `r${r}h${h}`,
        hallIndex: h + 1,
        team1,
        team2,
        team1Score: 0,
        team2Score: 0,
        referee: referee!,
        subHigh: subHigh!,
        subLow: subLow!
      });
    }

    rounds.push({
      roundNumber: r,
      matches: roundMatches,
      restingPlayers: restPool
    });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds, hallsCount, playersPerTeam, rounds, standings, isCompleted: false };
};
