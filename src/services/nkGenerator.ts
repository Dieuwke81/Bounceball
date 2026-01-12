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
  else if (!bestSplit) failureLog.balanceFail++;
  return { split: bestSplit };
}

async function generateSingleVersion(players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string): Promise<{session: NKSession | null, failedRound: number}> {
  const ppm = ppt * 2;
  const totalRounds = Math.ceil((players.length * mpp / ppm) / hallNames.length);
  const playedCount = new Map(players.map(p => [p.id, 0]));
  const allRounds: NKRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    let roundSuccess = false;
    let roundMatches: NKMatch[] = [];
    
    for (let rAttempt = 0; rAttempt < 50; rAttempt++) {
      const target = rAttempt < 25 ? 0.3 : 0.45;
      const usedThisRound = new Set<number>();
      const currentMatches: NKMatch[] = [];
      const pool = [...players].filter(p => playedCount.get(p.id)! < mpp).sort((a, b) => (playedCount.get(b.id)! - playedCount.get(a.id)!) || (Math.random() - 0.5));
      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));
      
      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, ppm);
          if (mPlayers.length < ppm) throw new Error("Leeg");
          const { split } = getBestTeamSplit(mPlayers, ppt, target);
          if (!split) throw new Error("Rating");
          mPlayers.forEach(p => usedThisRound.add(p.id));
          currentMatches.push({ id: `r${r}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false, subLow: null as any, subHigh: null as any, referee: null as any });
        }
        let restingPool = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        if (restingPool.length < currentMatches.length * 3) { failureLog.officialsFail++; throw new Error("Officials"); }
        for (let m of currentMatches) { m.subLow = restingPool.shift()!; m.subHigh = restingPool.pop()!; m.referee = restingPool.splice(Math.floor(restingPool.length / 2), 1)[0]; }
        roundMatches = currentMatches; roundSuccess = true; break; 
      } catch (e) { continue; }
    }

    if (roundSuccess) {
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
      allRounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: [] });
    } else return { session: null, failedRound: r };
  }
  return { session: { competitionName, hallNames, playersPerTeam: ppt, totalRounds: allRounds.length, rounds: allRounds, standings: [], isCompleted: false }, failedRound: 0 };
}

export async function generateNKSchedule(players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let attempts = 0;
  failureLog = { ratingFail: 0, balanceFail: 0, officialsFail: 0, poolEmptyFail: 0 };
  let roundFailureTally: {[key: number]: number} = {};

  while (validVersions.length < 10 && attempts < 800) {
    attempts++;
    const { session, failedRound } = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName);
    if (session) { validVersions.push(session); onProgress(`Optimalisatie: ${validVersions.length}/10...`); }
    else roundFailureTally[failedRound] = (roundFailureTally[failedRound] || 0) + 1;
    if (attempts % 100 === 0) { onProgress(`Poging ${attempts}/800...`); await delay(1); }
  }

  if (validVersions.length === 0) {
    const mostFailed = Object.keys(roundFailureTally).reduce((a, b) => roundFailureTally[+a] > roundFailureTally[+b] ? a : b, "0");
    throw new Error(`ONMOGELIJK SCHEMA:\nMeest problematische ronde: ${mostFailed}\n- Rating < 4.0: ${failureLog.ratingFail}x\n- Balans > 0.3: ${failureLog.balanceFail}x\n- Officials tekort: ${failureLog.officialsFail}x\n\nAdvies: Probeer minder wedstrijden p.p. of pas het spelersaantal aan.`);
  }

  const socialScore = (s: NKSession) => {
    const pairs = new Map<string, number>();
    s.rounds.forEach(r => r.matches.forEach(m => { const p = [...m.team1, ...m.team2]; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) { const k = [p[i].id, p[j].id].sort().join('-'); pairs.set(k, (pairs.get(k) || 0) + 1); } }));
    let score = 0; pairs.forEach(c => score += Math.pow(c, 2)); return score;
  };
  return validVersions.reduce((best, cur) => socialScore(cur) < socialScore(best) ? cur : best);
}
