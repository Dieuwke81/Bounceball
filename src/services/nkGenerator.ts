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

  // Houd bij hoe vaak iemand gerust heeft en met wie hij gespeeld heeft
  const restCounts = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  // 1. Loop door het exact aantal rondes dat de calculator aangaf
  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    
    // Hoeveel zalen vullen we deze ronde? (Meestal hallsToUse, behalve laatste ronde)
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // A. Kies de mensen die deze ronde moeten RUSTEN
    // Prioriteit aan mensen die het MINST gerust hebben tot nu toe
    const sortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = sortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = sortedForRest.slice(numPeopleToRest);

    // Update rest-administratie
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // B. Verdeel de actieve spelers over de zalen (Variatie optimalisatie)
    // We gebruiken een simpele 'Greedy' verdeling om spelers die vaak samen waren te scheiden
    const matchesForRoundPool = [...activeThisRound];
    
    for (let h = 0; h < hallsThisRound; h++) {
      const matchPool: Player[] = [];
      
      // Pak een 'seed' speler
      if (matchesForRoundPool.length > 0) {
        matchPool.push(matchesForRoundPool.shift()!);
      }

      // Zoek de rest van de 8 of 10 mensen voor deze specifieke match
      while (matchPool.length < playersPerMatch && matchesForRoundPool.length > 0) {
        const bestNext = matchesForRoundPool.map((cand, idx) => {
          let penalty = 0;
          matchPool.forEach(m => {
            const count = pairHistory.get(getPairKey(cand.id, m.id)) || 0;
            penalty += (count * count * 100);
          });
          return { cand, idx, penalty };
        }).sort((a, b) => a.penalty - b.penalty)[0];

        matchPool.push(matchesForRoundPool.splice(bestNext.idx, 1)[0]);
      }

      // C. Verdeel de matchPool in Team 1 en Team 2 (Balans & Keepers)
      let bestT1: Player[] = [];
      let bestT2: Player[] = [];
      let lowestPenalty = Infinity;

      for (let attempt = 0; attempt < 300; attempt++) {
        const shuffled = [...matchPool].sort(() => Math.random() - 0.5);
        const t1 = shuffled.slice(0, playersPerTeam);
        const t2 = shuffled.slice(playersPerTeam);

        const k1 = t1.filter(p => p.isKeeper).length;
        const k2 = t2.filter(p => p.isKeeper).length;
        if (Math.abs(k1 - k2) > 1) continue;

        let p = 0;
        const check = (t: Player[]) => {
          for (let i = 0; i < t.length; i++) {
            for (let j = i+1; j < t.length; j++) {
              p += (pairHistory.get(getPairKey(t[i].id, t[j].id)) || 0) * 500;
            }
          }
        };
        check(t1); check(t2);

        const diff = Math.abs((t1.reduce((s,x)=>s+x.rating,0)/t1.length) - (t2.reduce((s,x)=>s+x.rating,0)/t2.length));
        p += diff * 50;

        if (p < lowestPenalty) { lowestPenalty = p; bestT1 = t1; bestT2 = t2; }
        if (p === 0) break;
      }

      // Update pair history
      [bestT1, bestT2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
          }
        }
      });

      // D. Rollen toewijzen uit de rustpool van deze ronde
      const availableForRoles = [...restingThisRound];
      const findRole = (cond: (p: Player) => boolean) => {
        const idx = availableForRoles.findIndex(cond);
        return idx !== -1 ? availableForRoles.splice(idx, 1)[0] : availableForRoles.shift() || players[0];
      };

      roundMatches.push({
        id: `r${r}h${h}`, hallIndex: h + 1, team1: bestT1, team2: bestT2,
        team1Score: 0, team2Score: 0, isPlayed: false,
        referee: findRole(() => true),
        subHigh: findRole(p => p.rating >= 5),
        subLow: findRole(p => p.rating < 5)
      });
      
      matchesRemaining--;
    }

    rounds.push({
      roundNumber: r,
      matches: roundMatches,
      restingPlayers: restingThisRound
    });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { 
    competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, 
    playersPerTeam, rounds, standings, isCompleted: false 
  };
};
