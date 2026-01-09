import { Player, Constraint, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const MAX_ATTEMPTS = 500;

/**
 * De Master Planner voor het NK.
 * Genereert een compleet toernooischema op basis van alle gestelde eisen.
 */
export const generateNKSchedule = (
  players: Player[],
  hallsCount: number,
  totalRounds: number,
  competitionName: string
): NKSession => {
  
  // 1. Initialiseer statistieken om eerlijkheid te bewaken
  const playerStats = new Map<number, { 
    played: number, 
    ref: number, 
    sub: number, 
    partners: Set<number> 
  }>();

  players.forEach(p => {
    playerStats.set(p.id, { played: 0, ref: 0, sub: 0, partners: new Set() });
  });

  const rounds: NKRound[] = [];

  // 2. Loop door alle rondes en vul het schema
  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const availablePlayers = [...players].sort((a, b) => {
        // Prioriteit aan spelers die het minst gespeeld hebben
        return playerStats.get(a.id)!.played - playerStats.get(b.id)!.played || Math.random() - 0.5;
    });

    // Bereken hoeveel zalen we deze ronde echt nodig hebben
    // Op een NK speelt iedereen idealiter evenveel. 
    // We vullen zalen zolang er mensen zijn die 'achterlopen' op het gemiddelde.
    let hallsThisRound = hallsCount;
    const playersNeeded = hallsThisRound * 10;
    
    // Als we in de laatste ronde zitten, kijken we of we minder zalen nodig hebben
    if (r === totalRounds) {
        const totalMatchesPossible = totalRounds * hallsCount * 10;
        const targetMatchesPerPlayer = Math.floor(totalMatchesPossible / players.length);
        const playersWhoStillNeedToPlay = players.filter(p => playerStats.get(p.id)!.played < targetMatchesPerPlayer);
        hallsThisRound = Math.max(1, Math.ceil(playersWhoStillNeedToPlay.length / 10));
    }

    const roundActivePlayers: Player[] = [];
    const playersToAssign = [...availablePlayers];

    // Selecteer spelers voor deze ronde
    for (let i = 0; i < hallsThisRound * 10; i++) {
        if (playersToAssign.length > 0) {
            roundActivePlayers.push(playersToAssign.shift()!);
        }
    }

    const restPool = [...playersToAssign];

    // Maak matches voor de actieve zalen
    for (let h = 0; h < hallsThisRound; h++) {
      const matchPlayers = roundActivePlayers.splice(0, 10);
      if (matchPlayers.length < 10) break;

      // Verdeel matchPlayers in Team 1 en Team 2 (met keeper logica)
      const keepers = matchPlayers.filter(p => p.isKeeper);
      const fieldPlayers = matchPlayers.filter(p => !p.isKeeper);
      
      const team1: Player[] = [];
      const team2: Player[] = [];

      // Keepers tegenover elkaar
      if (keepers.length >= 2) {
        team1.push(keepers[0]);
        team2.push(keepers[1]);
      } else if (keepers.length === 1) {
        team1.push(keepers[0]);
      }

      // Vul aan met veldspelers (probeer balans en variatie)
      // (Voor de generator in deze fase doen we een simpele verdeling, 
      // de echte verfijning gebeurt in de definitieve component)
      fieldPlayers.forEach(p => {
        if (team1.length < 5) team1.push(p);
        else team2.push(p);
      });

      // Assign rollen uit de rustpool
      // We hebben nodig: 1 Ref, 1 SubHigh (>=5), 1 SubLow (<5)
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

      // Update gespeeld statistieken
      [...team1, ...team2].forEach(p => {
        playerStats.get(p.id)!.played++;
      });

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

  // 3. Initialiseer de stand
  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id,
    playerName: p.name,
    points: 0,
    goalDifference: 0,
    goalsFor: 0,
    matchesPlayed: 0
  }));

  return {
    competitionName,
    totalRounds,
    hallsCount,
    rounds,
    standings,
    isCompleted: false
  };
};
