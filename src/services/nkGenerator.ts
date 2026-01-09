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

  // 1. Bijhouden van tegoeden en historie
  const matchTokens = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => {
    matchTokens.set(p.id, matchesPerPlayer);
  });

  const allGeneratedMatches: NKMatch[] = [];

  // 2. Genereer alle wedstrijden die nodig zijn voor het hele toernooi
  for (let mIdx = 0; mIdx < totalMatchesToGenerate; mIdx++) {
    const matchPlayers: Player[] = [];
    
    // Selecteer 8 of 10 spelers die de meeste wedstrijden tegoed hebben
    // We sorteren op tokens (DESC) en voegen een beetje random toe voor variatie
    const candidates = [...players].sort((a, b) => {
      const tokensA = matchTokens.get(a.id)!;
      const tokensB = matchTokens.get(b.id)!;
      return tokensB - tokensA || Math.random() - 0.5;
    });

    const selectedForMatch = candidates.slice(0, playersPerMatch);

    // Update tokens direct
    selectedForMatch.forEach(p => matchTokens.set(p.id, matchTokens.get(p.id)! - 1));

    // 3. Verfijn de verdeling (Team 1 vs Team 2) voor deze specifieate groep
    let bestT1: Player[] = [];
    let bestT2: Player[] = [];
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 400; attempt++) {
      const shuffled = [...selectedForMatch].sort(() => Math.random() - 0.5);
      const t1 = shuffled.slice(0, playersPerTeam);
      const t2 = shuffled.slice(playersPerTeam);

      // Keeper check
      const k1 = t1.filter(p => p.isKeeper).length;
      const k2 = t2.filter(p => p.isKeeper).length;
      if (Math.abs(k1 - k2) > 1) continue;

      let currentPenalty = 0;
      const checkTeam = (team: Player[]) => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const count = pairHistory.get(getPairKey(team[i].id, team[j].id)) || 0;
            currentPenalty += (count * count * 1000); // Zware straf voor herhaling
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

    // Update pair history voor de gekozen teams
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
      hallIndex: 0, // Wordt later ingevuld
      team1: bestT1,
      team2: bestT2,
      team1Score: 0,
      team2Score: 0,
      referee: players[0], // Dummy, wordt later ingevuld
      subHigh: players[0], // Dummy
      subLow: players[0],  // Dummy
    });
  }

  // 4. Verdeel alle gegenereerde wedstrijden over rondes en zalen
  const rounds: NKRound[] = [];
  const matchesToProcess = [...allGeneratedMatches];
  let roundNum = 1;

  while (matchesToProcess.length > 0) {
    const roundMatches: NKMatch[] = [];
    const playersInRound = new Set<number>();

    for (let h = 0; h < hallsCount; h++) {
      // Zoek een wedstrijd uit de lijst waarvan GEEN enkele speler al in deze ronde zit
      const matchIdx = matchesToProcess.findIndex(m => {
        const matchPlayers = [...m.team1, ...m.team2];
        return !matchPlayers.some(p => playersInRound.has(p.id));
      });

      if (matchIdx !== -1) {
        const match = matchesToProcess.splice(matchIdx, 1)[0];
        match.hallIndex = h + 1;
        
        // Nu we de zaal weten, wijzen we de rollen toe uit de rustende spelers
        const playingIds = new Set([...playersInRound]);
        [...match.team1, ...match.team2].forEach(p => playingIds.add(p.id));
        
        // We moeten ook de spelers uit de andere (al gekozen) matches van deze ronde meetellen
        roundMatches.forEach(rm => {
            [...rm.team1, ...rm.team2].forEach(p => playingIds.add(p.id));
        });

        const restPool = players.filter(p => !playingIds.has(p.id));
        
        const findRole = (pool: Player[], condition: (p: Player) => boolean) => {
            const idx = pool.findIndex(condition);
            return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
        };

        match.referee = findRole(restPool, () => true);
        match.subHigh = findRole(restPool, p => p.rating >= 5);
        match.subLow = findRole(restPool, p => p.rating < 5);

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
