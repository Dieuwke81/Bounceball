import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<NKSession> => {
  const playersPerMatch = playersPerTeam * 2;
  const totalPlayerSpots = players.length * matchesPerPlayer;
  const totalMatchesNeeded = totalPlayerSpots / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  // Elke speler begint met een tegoed aan wedstrijden
  const matchTokens = new Map<number, number>();
  players.forEach(p => matchTokens.set(p.id, matchesPerPlayer));

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    // Geef de browser tijd om het laadscherm te tonen
    await sleep(10);

    const roundsLeft = (totalRounds - r) + 1;
    const hallsThisRoundCount = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsThisRoundCount * playersPerMatch;

    let bestRoundMatches: NKMatch[] = [];
    let bestRestingThisRound: Player[] = [];
    let foundValidRound = false;

    // We doen 10.000 pogingen om een gebalanceerde ronde te vinden
    for (let attempt = 0; attempt < 10000; attempt++) {
      if (attempt % 2000 === 0) await sleep(0);

      // 1. Kies spelers voor deze ronde
      // Prioriteit 1: Spelers die móeten spelen (tokens over == resterende rondes)
      // Prioriteit 2: Spelers met de meeste tokens over
      const sortedByNeed = [...players].sort((a, b) => {
        const tA = matchTokens.get(a.id)!;
        const tB = matchTokens.get(b.id)!;
        const mustA = tA === roundsLeft ? 1 : 0;
        const mustB = tB === roundsLeft ? 1 : 0;
        return mustB - mustA || tB - tA || Math.random() - 0.5;
      });

      const activeThisRound = sortedByNeed.slice(0, spotsToFill);
      const restingThisRound = sortedByNeed.slice(spotsToFill);

      // Check of we in de rustgroep wel genoeg High/Low hebben voor de rollen
      const highRes = restingThisRound.filter(p => p.rating >= 5).length;
      const lowRes = restingThisRound.filter(p => p.rating < 5).length;
      if (highRes < hallsThisRoundCount || lowRes < hallsThisRoundCount) {
          if (attempt < 9000) continue; // Blijf zoeken naar een betere rust-mix
      }

      // 2. Verdeel de actieve spelers over de zalen en teams
      const shuffledActive = [...activeThisRound].sort(() => Math.random() - 0.5);
      const currentRoundMatches: NKMatch[] = [];
      let allMatchesInRoundValid = true;
      let balanceLimit = attempt < 5000 ? 0.301 : 0.401; // Versoepel heel langzaam bij nood

      for (let h = 0; h < hallsThisRoundCount; h++) {
        const matchPool = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
        
        // Zoek beste Team 1 en Team 2 verdeling binnen deze zaal
        let bestT1: Player[] = [];
        let bestT2: Player[] = [];
        let minDiff = Infinity;

        // Probeer 100 verdelingen binnen de zaal
        for (let tAttempt = 0; tAttempt < 100; tAttempt++) {
            const s = [...matchPool].sort(() => Math.random() - 0.5);
            const t1 = s.slice(0, playersPerTeam);
            const t2 = s.slice(playersPerTeam);
            
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) continue;

            const diff = Math.abs((t1.reduce((sum,p)=>sum+p.rating,0)/t1.length) - (t2.reduce((sum,p)=>sum+p.rating,0)/t2.length));
            if (diff < minDiff) {
                minDiff = diff;
                bestT1 = t1;
                bestT2 = t2;
            }
            if (minDiff <= 0.3) break;
        }

        if (minDiff > balanceLimit) {
            allMatchesInRoundValid = false;
            break;
        }

        currentRoundMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h], team1: bestT1, team2: bestT2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            referee: players[0], subHigh: players[0], subLow: players[0] 
        });
      }

      if (allMatchesInRoundValid) {
        bestRoundMatches = currentRoundMatches;
        bestRestingThisRound = restingThisRound;
        foundValidRound = true;
        break;
      }
    }

    // 3. Finaliseer de ronde
    if (foundValidRound) {
        const rolePool = [...bestRestingThisRound];
        const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
            const idx = pool.findIndex(cond);
            return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
        };

        bestRoundMatches.forEach(match => {
            // Trek tokens af van de spelers
            [...match.team1, ...match.team2].forEach(p => matchTokens.set(p.id, matchTokens.get(p.id)! - 1));
            
            // Wijs rollen toe
            match.subHigh = findRole(rolePool, p => p.rating >= 5);
            match.subLow = findRole(rolePool, p => p.rating < 5);
            match.referee = findRole(rolePool, () => true);

            // Update historie
            const updateHist = (team: Player[]) => {
                for (let i=0; i<team.length; i++) {
                    for (let j=i+1; j<team.length; j++) {
                        const key = getPairKey(team[i].id, team[j].id);
                        togetherHistory.set(key, (togetherHistory.get(key)||0)+1);
                    }
                }
            };
            updateHist(match.team1); updateHist(match.team2);
            match.team1.forEach(p1 => match.team2.forEach(p2 => {
                const key = getPairKey(p1.id, p2.id);
                againstHistory.set(key, (againstHistory.get(key)||0)+1);
            }));
            matchesRemaining--;
        });

        rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: bestRestingThisRound });
        roundNum++;
    } else {
        // Mocht het na 10k pogingen niet lukken (noodgreep voor stabiliteit)
        console.error("Kon ronde niet voltooien");
        break;
    }
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
