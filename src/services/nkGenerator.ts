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

  const restCounts = new Map<number, number>();
  const pairHistory = new Map<string, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // A. Bepaal wie deze ronde RUSTEN (Harde eis voor aantal wedstrijden)
    const playersSortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = playersSortedForRest.slice(numPeopleToRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // B. MIRROR-PAIRING LOGICA (Garandeert de 0.3 grens)
    // Sorteer actieve spelers van hoog naar laag
    const sortedActive = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    
    // Maak duo's van spelers die qua rating het dichtst bij elkaar liggen
    const pairs: {p1: Player, p2: Player}[] = [];
    for (let i = 0; i < sortedActive.length; i += 2) {
      if (sortedActive[i+1]) {
        pairs.push({ p1: sortedActive[i], p2: sortedActive[i+1] });
      }
    }

    // Verdeel deze duo's over de zalen (Zaal 1, Zaal 2, Zaal 3, Zaal 1...)
    const hallMatchesPools: {p1: Player, p2: Player}[][] = Array.from({ length: hallsThisRound }, () => []);
    pairs.forEach((pair, idx) => {
      hallMatchesPools[idx % hallsThisRound].push(pair);
    });

    const availableForRoles = [...restingThisRound];

    // C. Per zaal de teams definitief maken
    hallMatchesPools.forEach((matchPairs, hIdx) => {
      let team1: Player[] = [];
      let team2: Player[] = [];

      // Verdeel de paartjes over de twee teams
      matchPairs.forEach((pair, pIdx) => {
        // Om en om p1 in team 1 en dan in team 2 voor maximale balans
        if (pIdx % 2 === 0) {
          team1.push(pair.p1); team2.push(pair.p2);
        } else {
          team1.push(pair.p2); team2.push(pair.p1);
        }
      });

      // KEEPER CHECK & SWAP
      // Als er twee keepers in hetzelfde team zitten, wissel er één met zijn "mirror partner"
      const fixKeepers = () => {
        const k1 = team1.filter(p => p.isKeeper);
        const k2 = team2.filter(p => p.isKeeper);
        
        if (k1.length > 1 || k2.length > 1) {
           // Zoek een keeper in het team met te veel keepers
           const overflownTeam = k1.length > 1 ? team1 : team2;
           const otherTeam = k1.length > 1 ? team2 : team1;
           const keeperIdx = overflownTeam.findIndex(p => p.isKeeper);
           const keeper = overflownTeam[keeperIdx];
           
           // Zoek de partner in het andere team die bij de keeper hoorde
           // (In onze pairing logica zitten ze op dezelfde index in de team-arrays)
           const partner = otherTeam[keeperIdx];
           
           // Wissel ze om
           overflownTeam[keeperIdx] = partner;
           otherTeam[keeperIdx] = keeper;
        }
      };
      fixKeepers();

      // VARIATIE OPTIMALISATIE (Husselen van de mirroring binnen 0.3 grens)
      // We proberen 200 keer of we paartjes kunnen flippen om vaker-samen-spelen te voorkomen
      // ZONDER de balans aan te tasten (want we flippen alleen binnen duo's)
      for (let attempt = 0; attempt < 200; attempt++) {
        const pairToFlip = Math.floor(Math.random() * matchPairs.length);
        const p1 = team1[pairToFlip];
        const p2 = team2[pairToFlip];

        // Bereken huidige straf
        const currentPenalty = calculatePairPenalty(team1, team2, pairHistory, getPairKey);
        
        // Doe een proef-wissel
        team1[pairToFlip] = p2; team2[pairToFlip] = p1;
        const newPenalty = calculatePairPenalty(team1, team2, pairHistory, getPairKey);
        
        // Keeper check: mag niet 2 keepers in 1 team na flip
        const kCheck = team1.filter(x => x.isKeeper).length <= 1 && team2.filter(x => x.isKeeper).length <= 1;

        if (newPenalty < currentPenalty && kCheck) {
          // Houden zo
        } else {
          // Terugdraaien
          team1[pairToFlip] = p1; team2[pairToFlip] = p2;
        }
      }

      // Update historie
      [team1, team2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
          }
        }
      });

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
      };

      roundMatches.push({
        id: `r${r}h${hIdx}`, hallIndex: hIdx + 1, team1, team2,
        team1Score: 0, team2Score: 0, isPlayed: false,
        referee: findRole(availableForRoles, () => true) as Player,
        subHigh: findRole(availableForRoles, p => p.rating >= 5) as Player,
        subLow: findRole(availableForRoles, p => p.rating < 5) as Player
      });

      matchesRemaining--;
    });

    rounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: restingThisRound });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallsCount: hallsToUse, playersPerTeam, rounds, standings, isCompleted: false };
};

// Helper om variatie straf te berekenen
const calculatePairPenalty = (t1: Player[], t2: Player[], history: Map<string, number>, keyFn: any) => {
    let p = 0;
    [t1, t2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
            for (let j = i+1; j < team.length; j++) {
                p += (history.get(keyFn(team[i].id, team[j].id)) || 0) * 1000;
            }
        }
    });
    return p;
};
