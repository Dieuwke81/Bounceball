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
  const togetherHistory = new Map<string, number>(); // Geheugen: Samen in team
  const againstHistory = new Map<string, number>();  // Geheugen: Tegen elkaar
  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => restCounts.set(p.id, 0));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const hallsThisRound = Math.min(hallsToUse, matchesRemaining);
    const spotsToFill = hallsThisRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    // A. Bepaal wie deze ronde RUSTEN
    const playersSortedForRest = [...players].sort((a, b) => 
      restCounts.get(a.id)! - restCounts.get(b.id)! || Math.random() - 0.5
    );

    const restingThisRound = playersSortedForRest.slice(0, numPeopleToRest);
    const activeThisRound = playersSortedForRest.slice(numPeopleToRest);
    restingThisRound.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! + 1));

    // B. MIRROR-PAIRING (Sorteer op rating en maak duo's)
    const sortedActive = [...activeThisRound].sort((a, b) => b.rating - a.rating);
    const pairs: {p1: Player, p2: Player}[] = [];
    for (let i = 0; i < sortedActive.length; i += 2) {
      if (sortedActive[i+1]) {
        pairs.push({ p1: sortedActive[i], p2: sortedActive[i+1] });
      }
    }

    // Verdeel duo's over de zalen
    const hallMatchesPools: {p1: Player, p2: Player}[][] = Array.from({ length: hallsThisRound }, () => []);
    pairs.forEach((pair, idx) => {
      hallMatchesPools[idx % hallsThisRound].push(pair);
    });

    const availableForRoles = [...restingThisRound];

    // C. Per zaal de verdeling optimaliseren op Samen én Tegen
    hallMatchesPools.forEach((matchPairs, hIdx) => {
      let team1: Player[] = [];
      let team2: Player[] = [];

      matchPairs.forEach((pair, pIdx) => {
        if (pIdx % 2 === 0) { team1.push(pair.p1); team2.push(pair.p2); } 
        else { team1.push(pair.p2); team2.push(pair.p1); }
      });

      // Keeper Swap (nooit 2 keepers in 1 team)
      const fixKeepers = () => {
        const k1 = team1.filter(p => p.isKeeper);
        const k2 = team2.filter(p => p.isKeeper);
        if (k1.length > 1 || k2.length > 1) {
            const overflownTeam = k1.length > 1 ? team1 : team2;
            const otherTeam = k1.length > 1 ? team2 : team1;
            const kIdx = overflownTeam.findIndex(p => p.isKeeper);
            const k = overflownTeam[kIdx];
            const p = otherTeam[kIdx];
            overflownTeam[kIdx] = p; otherTeam[kIdx] = k;
        }
      };
      fixKeepers();

      // OPTIMALISATIE LUS (Probeer 200 combinaties per wedstrijd)
      for (let attempt = 0; attempt < 200; attempt++) {
        const pairToFlip = Math.floor(Math.random() * matchPairs.length);
        const p1 = team1[pairToFlip];
        const p2 = team2[pairToFlip];

        const currentPenalty = calculateTotalPenalty(team1, team2, togetherHistory, againstHistory, getPairKey);
        
        // Probeer paartje om te draaien
        team1[pairToFlip] = p2; team2[pairToFlip] = p1;
        const newPenalty = calculateTotalPenalty(team1, team2, togetherHistory, againstHistory, getPairKey);
        
        const keeperSafe = team1.filter(x => x.isKeeper).length <= 1 && team2.filter(x => x.isKeeper).length <= 1;

        if (newPenalty < currentPenalty && keeperSafe) {
          // Houden zo, is beter
        } else {
          // Terugdraaien
          team1[pairToFlip] = p1; team2[pairToFlip] = p2;
        }
      }

      // Update de geschiedenis voor de volgende rondes/zalen
      // 1. Samen gespeeld
      [team1, team2].forEach(team => {
        for (let i = 0; i < team.length; i++) {
          for (let j = i+1; j < team.length; j++) {
            const key = getPairKey(team[i].id, team[j].id);
            togetherHistory.set(key, (togetherHistory.get(key) || 0) + 1);
          }
        }
      });
      // 2. Tegen elkaar gespeeld
      team1.forEach(p1 => {
        team2.forEach(p2 => {
          const key = getPairKey(p1.id, p2.id);
          againstHistory.set(key, (againstHistory.get(key) || 0) + 1);
        });
      });

      const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
        const idx = pool.findIndex(cond);
        return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift();
      };

      roundMatches.push({
        id: `r${r}h${hIdx}`, hallIndex: hIdx + 1, team1: [...team1], team2: [...team2],
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

// Hulpscherm voor de penalty-berekening (Samen + Tegen)
const calculateTotalPenalty = (
  t1: Player[], 
  t2: Player[], 
  togHist: Map<string, number>, 
  agHist: Map<string, number>, 
  keyFn: any
) => {
  let penalty = 0;
  
  // Straf voor teamgenoot herhaling (zwaar gewicht)
  [t1, t2].forEach(team => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i+1; j < team.length; j++) {
        const count = togHist.get(keyFn(team[i].id, team[j].id)) || 0;
        penalty += (count * count * 1000);
      }
    }
  });

  // Straf voor tegenstander herhaling (iets lichter gewicht, maar nog steeds belangrijk)
  t1.forEach(p1 => {
    t2.forEach(p2 => {
      const count = agHist.get(keyFn(p1.id, p2.id)) || 0;
      penalty += (count * count * 500);
    });
  });

  return penalty;
};
