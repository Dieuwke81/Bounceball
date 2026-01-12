import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Analyse teller om te begrijpen waarom het vastloopt
let failureLog = {
  ratingFail: 0,
  balanceFail: 0,
  officialsFail: 0,
  poolEmptyFail: 0,
  backtrackCount: 0
};

function getBestTeamSplit(players: Player[], playersPerTeam: number, targetDiff: number) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;
  let foundRatingMatch = false;

  function combine(start: number, team1: Player[]) {
    if (team1.length === playersPerTeam) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / playersPerTeam;

      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      // EIS: Minimaal 4.0 gemiddelde per team
      if (k1 <= 1 && k2 <= 1 && avg1 >= 4.0 && avg2 >= 4.0) {
        foundRatingMatch = true;
        const diff = Math.abs(avg1 - avg2);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = { t1: [...team1], t2: [...team2] };
        }
      }
      return;
    }
    for (let i = start; i < players.length; i++) {
      team1.push(players[i]);
      combine(i + 1, team1);
      team1.pop();
      if (bestDiff <= targetDiff) return; 
    }
  }

  combine(0, []);
  
  if (!foundRatingMatch) failureLog.ratingFail++;
  else if (!bestSplit) failureLog.balanceFail++;

  return { split: bestSplit };
}

async function generateSingleVersion(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<{session: NKSession | null, failedRound: number}> {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatchesNeeded = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const playedCount = new Map(players.map(p => [p.id, 0]));
  const allRounds: NKRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    let roundSuccess = false;
    let roundMatches: NKMatch[] = [];
    
    // Probeer een ronde te maken
    for (let rAttempt = 0; rAttempt < 60; rAttempt++) {
      // Wordt langzaam flexibeler bij elke poging
      const target = rAttempt < 30 ? 0.3 : 0.45;
      const usedThisRound = new Set<number>();
      const currentMatches: NKMatch[] = [];

      // Sorteer pool: wie het minst gespeeld heeft MOET nu spelen
      const pool = [...players]
        .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
        .sort((a, b) => (playedCount.get(b.id)! - playedCount.get(a.id)!) || (Math.random() - 0.5));

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
      
      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
          if (mPlayers.length < playersPerMatch) { failureLog.poolEmptyFail++; throw new Error("Leeg"); }

          const { split } = getBestTeamSplit(mPlayers, playersPerTeam, target);
          if (!split) throw new Error("Rating");

          mPlayers.forEach(p => usedThisRound.add(p.id));
          currentMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h],
            team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        // Officials toewijzen uit de rest
        let restingPool = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        if (restingPool.length < currentMatches.length * 3) { failureLog.officialsFail++; throw new Error("Officials"); }

        for (let m of currentMatches) {
          m.subLow = restingPool.shift()!;
          m.subHigh = restingPool.pop()!;
          m.referee = restingPool.splice(Math.floor(restingPool.length / 2), 1)[0];
        }

        roundMatches = currentMatches;
        roundSuccess = true;
        break; 
      } catch (e) { continue; }
    }

    if (roundSuccess && roundMatches.length > 0) {
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
      allRounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: [] });
    } else {
        failureLog.backtrackCount++;
        return { session: null, failedRound: r };
    }
  }

  // Check of iedereen exact op het aantal matches zit
  const allReachedLimit = players.every(p => playedCount.get(p.id) === matchesPerPlayer);
  if (!allReachedLimit) return { session: null, failedRound: totalRounds };

  return {
    session: {
      competitionName, hallNames, playersPerTeam, totalRounds: allRounds.length,
      rounds: allRounds, standings: [], // Memo berekent dit nu live in de UI
      isCompleted: false
    },
    failedRound: 0
  };
}

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let attempts = 0;
  
  // Reset logs
  failureLog = { ratingFail: 0, balanceFail: 0, officialsFail: 0, poolEmptyFail: 0, backtrackCount: 0 };
  let roundFailureTally: {[key: number]: number} = {};

  while (validVersions.length < 10 && attempts < 1000) {
    attempts++;
    const { session, failedRound } = await generateSingleVersion(players, hallNames, matchesPerPlayer, playersPerTeam, competitionName);
    
    if (session) {
      validVersions.push(session);
      onProgress(`Optimalisatie: ${validVersions.length}/10...`);
      await delay(1);
    } else {
      roundFailureTally[failedRound] = (roundFailureTally[failedRound] || 0) + 1;
    }
    
    if (attempts % 100 === 0) {
      onProgress(`Bezig... (Poging ${attempts}/1000)`);
      await delay(1);
    }
  }

  if (validVersions.length === 0) {
    const mostProblematic = Object.keys(roundFailureTally).reduce((a, b) => roundFailureTally[+a] > roundFailureTally[+b] ? a : b, "0");
    
    throw new Error(
      `MISLUKT NA 1000 POGINGEN.\n\n` +
      `Meest lastige ronde: ${mostProblematic}\n` +
      `Oorzaken analyse:\n` +
      `- Rating onder 4.0: ${failureLog.ratingFail}x\n` +
      `- Balans > 0.3: ${failureLog.balanceFail}x\n` +
      `- Te weinig officials: ${failureLog.officialsFail}x\n\n` +
      `ADVIES: Verlaag het aantal wedstrijden of zalen, of kies een ander aantal spelers.`
    );
  }

  // Sociale score berekenen: we willen zo min mogelijk herhalingen
  const getSocialScore = (s: NKSession): number => {
    const pairs = new Map<string, number>();
    s.rounds.forEach(r => r.matches.forEach(m => {
      const p = [...m.team1, ...m.team2];
      for (let i = 0; i < p.length; i++) 
        for (let j = i + 1; j < p.length; j++) {
          const key = [p[i].id, p[j].id].sort().join('-');
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
    }));
    let score = 0;
    pairs.forEach(v => score += Math.pow(v, 2));
    return score;
  };

  // Kies de beste van de 10
  return validVersions.reduce((best, current) => 
    getSocialScore(current) < getSocialScore(best) ? current : best
  );
}
