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
  // We houden nu een exacte teller bij: hoe vaak heeft A met B gespeeld?
  const pairHistory = new Map<string, number>();
  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => {
    matchTokens.set(p.id, matchesPerPlayer);
  });

  const rounds: NKRound[] = [];
  let roundNum = 1;

  // We blijven rondes genereren zolang er tokens zijn
  while (Array.from(matchTokens.values()).some(count => count > 0)) {
    const roundMatches: NKMatch[] = [];
    const playersActiveThisRound = new Set<number>();

    const playersWithTokens = players.filter(p => matchTokens.get(p.id)! > 0);
    let hallsToFill = Math.min(hallsCount, Math.floor(playersWithTokens.length / playersPerMatch));

    if (hallsToFill === 0) break;

    for (let h = 0; h < hallsToFill; h++) {
      // 1. SELECTIE VAN DE 10 SPELERS VOOR DEZE ZAAL
      const matchPlayers: Player[] = [];
      
      // Pak de eerste speler (degene die de meeste wedstrijden nog moet en nog niet speelt)
      const seedPlayer = players
        .filter(p => !playersActiveThisRound.has(p.id) && matchTokens.get(p.id)! > 0)
        .sort((a, b) => matchTokens.get(b.id)! - matchTokens.get(a.id)! || Math.random() - 0.5)[0];

      if (!seedPlayer) break;
      matchPlayers.push(seedPlayer);
      playersActiveThisRound.add(seedPlayer.id);

      // Zoek de overige 7 of 9 spelers die het MINST met de huidige groep in de zaal hebben gezeten
      while (matchPlayers.length < playersPerMatch) {
        const candidates = players.filter(p => !playersActiveThisRound.has(p.id) && matchTokens.get(p.id)! > 0);
        if (candidates.length === 0) break;

        // Bereken voor elke kandidaat hoeveel 'strafpunten' hij krijgt op basis van de mensen al in de zaal
        const bestCandidate = candidates.map(c => {
          let conflictScore = 0;
          matchPlayers.forEach(m => {
            const count = pairHistory.get(getPairKey(c.id, m.id)) || 0;
            // Kwadraat zorgt dat 2x samen spelen veel zwaarder weegt dan 1x
            conflictScore += (count * count * 100); 
          });
          // Neem tokens mee in de score zodat mensen met veel potjes tegoed voorrang houden
          conflictScore -= (matchTokens.get(c.id)! * 10);
          return { player: c, score: conflictScore };
        }).sort((a, b) => a.score - b.score)[0];

        matchPlayers.push(bestCandidate.player);
        playersActiveThisRound.add(bestCandidate.player.id);
      }

      if (matchPlayers.length < playersPerMatch) break;

      // 2. VERDELING VAN DE GROEP IN TEAM 1 EN TEAM 2
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;

      // Probeer 500 verschillende verdelingen van deze geselecteerde groep
      for (let attempt = 0; attempt < 500; attempt++) {
        const shuffled = [...matchPlayers].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        // Keepers verdelen
        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (Math.abs(k1 - k2) > 1) continue; 

        let currentPenalty = 0;
        const checkTeam = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const count = pairHistory.get(getPairKey(team[i].id, team[j].id)) || 0;
              currentPenalty += (count * count * 500); // Extreem zware straf voor team-herhaling
            }
          }
        };
        checkTeam(t1);
        checkTeam(t2);

        // Balans toevoegen
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

      // 3. ROLLEN TOEWIJZEN (Scheids/Reserves)
      const restPool = players.filter(p => !playersActiveThisRound.has(p.id));
      const findRole = (condition: (p: Player) => boolean) => {
        const idx = restPool.findIndex(condition);
        const p = idx !== -1 ? restPool.splice(idx, 1)[0] : restPool.shift();
        if (p) playersActiveThisRound.add(p.id);
        return p;
      };

      const referee = findRole(() => true);
      const subHigh = findRole(p => p.rating >= 5);
      const subLow = findRole(p => p.rating < 5);

      // 4. GESCHIEDENIS BIJWERKEN
      [...bestT1, ...bestT2].forEach(p => matchTokens.set(p.id, matchTokens.get(p.id)! - 1));
      
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

      roundMatches.push({
        id: `r${roundNum}h${h}`,
        hallIndex: h + 1,
        team1: bestT1,
        team2: bestT2,
        team1Score: 0,
        team2Score: 0,
        referee: referee as Player,
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
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount, playersPerTeam, rounds, standings, isCompleted: false };
};
