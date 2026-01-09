import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

export const generateNKSchedule = (
  players: Player[],
  hallsCount: number,
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): NKSession => {
  const playersPerMatch = playersPerTeam * 2;
  
  // Tokens bijhouden voor speeltijd
  const matchTokens = new Map<number, number>();
  // Geschiedenis bijhouden van partners (wie heeft met wie gespeeld)
  const teammateHistory = new Map<number, Set<number>>();
  
  players.forEach(p => {
    matchTokens.set(p.id, matchesPerPlayer);
    teammateHistory.set(p.id, new Set());
  });

  const rounds: NKRound[] = [];
  let roundNum = 1;

  // We gaan door tot alle tokens op zijn
  while (Array.from(matchTokens.values()).some(count => count > 0)) {
    const roundMatches: NKMatch[] = [];
    const playersActiveThisRound = new Set<number>();

    const playersWithTokens = players.filter(p => matchTokens.get(p.id)! > 0);
    
    // BELANGRIJK: Bepaal hoeveel zalen we deze ronde ECHT kunnen vullen
    let hallsToFill = Math.min(hallsCount, Math.floor(playersWithTokens.length / playersPerMatch));

    // Als we geen enkele zaal meer kunnen vullen maar er zijn nog wel tokens, 
    // dan is het schema wiskundig niet sluitend. We stoppen dan om een crash te voorkomen.
    if (hallsToFill === 0) break;

    for (let h = 0; h < hallsToFill; h++) {
      const candidates = players
        .filter(p => !playersActiveThisRound.has(p.id) && matchTokens.get(p.id)! > 0)
        .sort((a, b) => matchTokens.get(b.id)! - matchTokens.get(a.id)! || Math.random() - 0.5);

      if (candidates.length < playersPerMatch) break;
      const matchPlayers = candidates.slice(0, playersPerMatch);
      matchPlayers.forEach(p => playersActiveThisRound.add(p.id));

      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;

      for (let attempt = 0; attempt < 200; attempt++) {
        const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        // Verbeterde keeper check: verschil mag niet groter zijn dan 1
        const keepersT1 = t1.filter(p => p.isKeeper).length;
        const keepersT2 = t2.filter(p => p.isKeeper).length;
        if (Math.abs(keepersT1 - keepersT2) > 1) continue; 

        let currentPenalty = 0;
        const checkTeam = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              if (teammateHistory.get(team[i].id)?.has(team[j].id)) {
                currentPenalty += 100; 
              }
            }
          }
        };
        checkTeam(t1);
        checkTeam(t2);

        const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
        const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
        currentPenalty += Math.abs(avg1 - avg2) * 10;

        if (currentPenalty < lowestPenalty) {
          lowestPenalty = currentPenalty;
          bestT1 = t1;
          bestT2 = t2;
        }
        if (lowestPenalty === 0) break; 
      }

      // Rollen toewijzen met extra veiligheidscheck
      const restPool = players.filter(p => !playersActiveThisRound.has(p.id));
      
      const findRole = (condition: (p: Player) => boolean) => {
        const idx = restPool.findIndex(condition);
        const p = idx !== -1 ? restPool.splice(idx, 1)[0] : restPool.shift();
        if (p) {
            playersActiveThisRound.add(p.id);
            return p;
        }
        return null; // Geef null terug als er niemand meer is
      };

      const referee = findRole(() => true);
      const subHigh = findRole(p => p.rating >= 5);
      const subLow = findRole(p => p.rating < 5);

      [...bestT1, ...bestT2].forEach(p => {
        matchTokens.set(p.id, matchTokens.get(p.id)! - 1);
        bestT1.forEach(partner => { if (p.id !== partner.id) teammateHistory.get(p.id)?.add(partner.id); });
        bestT2.forEach(partner => { if (p.id !== partner.id) teammateHistory.get(p.id)?.add(partner.id); });
      });

      roundMatches.push({
        id: `r${roundNum}h${h}`,
        hallIndex: h + 1,
        team1: bestT1,
        team2: bestT2,
        team1Score: 0,
        team2Score: 0,
        referee: referee as Player, // Cast naar Player, UI moet null checken of dummy tonen
        subHigh: subHigh as Player,
        subLow: subLow as Player
      });
    }

    if (roundMatches.length > 0) {
      rounds.push({
        roundNumber: roundNum,
        matches: roundMatches,
        restingPlayers: players.filter(p => !playersActiveThisRound.has(p.id))
      });
      roundNum++;
    } else break;
    
    if (roundNum > 300) break; // Harde fail-safe
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount, playersPerTeam, rounds, standings, isCompleted: false };
};
