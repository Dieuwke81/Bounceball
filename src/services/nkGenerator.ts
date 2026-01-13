import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let failureLog = { ratingFail: 0, balanceFail: 0, officialsFail: 0, poolEmptyFail: 0 };

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

      if (k1 <= 1 && k2 <= 1 && avg1 >= 4.0 && avg2 >= 4.0) {
        foundRatingMatch = true;
        const diff = Math.abs(avg1 - avg2);
        if (diff < bestDiff) { bestDiff = diff; bestSplit = { t1: [...team1], t2: [...team2] }; }
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
  return { split: bestSplit };
}

async function generateSingleVersion(
  allPlayers: Player[], 
  hallNames: string[], 
  mpp: number, 
  ppt: number, 
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession | null> {
  const ppm = ppt * 2;
  const totalMatchesNeeded = (allPlayers.length * mpp) / ppm;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  // Backtracking state
  let rounds: NKRound[] = [];
  let playedCountsHistory: (Map<number, number>)[] = [new Map(allPlayers.map(p => [p.id, 0]))];
  let roundAttempts = new Array(totalRounds + 1).fill(0);
  
  let currentRoundIdx = 1;
  const startTime = Date.now();

  while (currentRoundIdx <= totalRounds) {
    // Tijdslimiet per versie (5 seconden) om te voorkomen dat hij oneindig in een dood spoor blijft hangen
    if (Date.now() - startTime > 5000) return null;

    let roundSuccess = false;
    let roundMatches: NKMatch[] = [];
    const currentPlayedCount = playedCountsHistory[currentRoundIdx - 1];

    // Probeer een geldige ronde te maken
    for (let rAttempt = 0; rAttempt < 40; rAttempt++) {
      const target = rAttempt < 20 ? 0.3 : 0.5;
      const usedThisRound = new Set<number>();
      const matches: NKMatch[] = [];
      
      const pool = [...allPlayers]
        .filter(p => currentPlayedCount.get(p.id)! < mpp)
        .sort((a, b) => (currentPlayedCount.get(b.id)! - currentPlayedCount.get(a.id)!) || (Math.random() - 0.5));

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));

      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, ppm);
          if (mPlayers.length < ppm) throw new Error("Leeg");
          const { split } = getBestTeamSplit(mPlayers, ppt, target);
          if (!split) throw new Error("Rating");
          mPlayers.forEach(p => usedThisRound.add(p.id));
          matches.push({ id: `r${currentRoundIdx}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false, subLow: null as any, subHigh: null as any, referee: null as any });
        }

        let resting = allPlayers.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        if (resting.length < matches.length * 3) throw new Error("Officials");

        for (let m of matches) {
          m.subLow = resting.shift()!;
          m.subHigh = resting.pop()!;
          m.referee = resting.splice(Math.floor(resting.length / 2), 1)[0];
        }
        roundMatches = matches;
        roundSuccess = true;
        break;
      } catch (e) { continue; }
    }

    if (roundSuccess) {
      // ✅ Ronde gelukt: Sla op en ga naar de volgende ronde
      rounds.push({ roundNumber: currentRoundIdx, matches: roundMatches, restingPlayers: [] });
      const nextCounts = new Map(currentPlayedCount);
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1)));
      playedCountsHistory[currentRoundIdx] = nextCounts;
      currentRoundIdx++;
    } else {
      // ❌ Ronde mislukt: BACKTRACK (Ga één ronde terug)
      if (currentRoundIdx === 1) return null; // Kan niet verder terug dan ronde 1
      rounds.pop();
      currentRoundIdx--;
      roundAttempts[currentRoundIdx]++; // Tel hoe vaak we op dit punt zijn vastgelopen

      // Als we te vaak terugstappen op dezelfde ronde, is het hele begin van het toernooi waarschijnlijk fout
      if (roundAttempts[currentRoundIdx] > 15) return null; 
    }
  }

  return {
    competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length,
    rounds, standings: [], isCompleted: false
  };
}

export async function generateNKSchedule(players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let attempts = 0;
  failureLog = { ratingFail: 0, balanceFail: 0, officialsFail: 0, poolEmptyFail: 0 };

  while (validVersions.length < 10 && attempts < 100) {
    attempts++;
    onProgress(`Bouwen & Backtracken (Poging ${attempts})...`);
    const session = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName, onProgress);
    
    if (session) {
      validVersions.push(session);
      onProgress(`Optimalisatie: ${validVersions.length}/10...`);
      await delay(1);
    }
    await delay(1);
  }

  if (validVersions.length === 0) {
    throw new Error(`KEIHARDE EIS NIET HAALBAAR:\nZelfs met terugstappen (backtracking) lukt het niet om ronde 12 te vullen met teams van 4.0+.\n\nAdvies: Probeer 1 wedstrijd minder p.p. of wijzig het aantal zalen.`);
  }

  const socialScore = (s: NKSession) => {
    const pairs = new Map<string, number>();
    s.rounds.forEach(r => r.matches.forEach(m => {
      const p = [...m.team1, ...m.team2];
      for (let i = 0; i < p.length; i++) 
        for (let j = i + 1; j < p.length; j++) {
          const k = [p[i].id, p[j].id].sort().join('-');
          pairs.set(k, (pairs.get(k) || 0) + 1);
        }
    }));
    let score = 0;
    pairs.forEach(c => score += Math.pow(c, 2));
    return score;
  };

  return validVersions.reduce((best, cur) => socialScore(cur) < socialScore(best) ? cur : best);
}
