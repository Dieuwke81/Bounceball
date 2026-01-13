import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getBestTeamSplit(players: Player[], ppt: number, targetDiff: number) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  function combine(start: number, team1: Player[]) {
    if (team1.length === ppt) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / ppt;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / ppt;
      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      // EIS: Beide teams minimaal 4.0 en max 1 keeper
      if (avg1 >= 4.0 && avg2 >= 4.0 && k1 <= 1 && k2 <= 1) {
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
  return bestSplit;
}

async function generateSingleVersion(
  allPlayers: Player[], 
  hallNames: string[], 
  mpp: number, 
  ppt: number, 
  competitionName: string
): Promise<NKSession | null> {
  const ppm = ppt * 2;
  const totalMatchesNeeded = (allPlayers.length * mpp) / ppm;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  let rounds: NKRound[] = [];
  let playedCountsHistory: (Map<number, number>)[] = [new Map(allPlayers.map(p => [p.id, 0]))];
  let roundAttempts = new Array(totalRounds + 1).fill(0);
  
  let rIdx = 1;
  const maxGlobalTime = Date.now() + 4000; // Max 4 sec per poging

  while (rIdx <= totalRounds) {
    if (Date.now() > maxGlobalTime) return null;

    const currentPlayedCount = playedCountsHistory[rIdx - 1];
    let roundMatches: NKMatch[] = [];
    let success = false;

    // Probeer een ronde te maken (60 pogingen per ronde)
    for (let attempt = 0; attempt < 60; attempt++) {
      const usedThisRound = new Set<number>();
      const matches: NKMatch[] = [];
      const target = attempt < 30 ? 0.3 : 0.6; // Wordt soepeler met balans, NOOIT met rating

      // Prioriteit: Spelers die het meest "achterlopen" op hun mpp
      const pool = [...allPlayers]
        .filter(p => currentPlayedCount.get(p.id)! < mpp)
        .sort((a, b) => {
          const diffA = mpp - currentPlayedCount.get(a.id)!;
          const diffB = mpp - currentPlayedCount.get(b.id)!;
          return diffB - diffA || Math.random() - 0.5;
        });

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));
      let roundFailed = false;

      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, ppm);
          if (mPlayers.length < ppm) throw new Error();

          const split = getBestTeamSplit(mPlayers, ppt, target);
          if (!split) throw new Error();

          mPlayers.forEach(p => usedThisRound.add(p.id));
          matches.push({
            id: `r${rIdx}h${h}`, hallName: hallNames[h],
            team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        // Officials: Spelers die NIET spelen in deze ronde
        let resting = allPlayers.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        if (resting.length < matches.length * 3) throw new Error();

        for (let m of matches) {
          m.subLow = resting.shift()!;
          m.subHigh = resting.pop()!;
          m.referee = resting.splice(Math.floor(resting.length / 2), 1)[0];
        }
        roundMatches = matches;
        success = true;
        break;
      } catch (e) {
        roundFailed = true;
      }
    }

    if (success) {
      rounds.push({ roundNumber: rIdx, matches: roundMatches, restingPlayers: [] });
      const nextCounts = new Map(currentPlayedCount);
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1)));
      playedCountsHistory[rIdx] = nextCounts;
      rIdx++;
    } else {
      // BACKTRACK: Gaat niet alleen 1 ronde terug, maar reset ook de pogingen teller
      if (rIdx === 1) return null;
      rounds.pop();
      rIdx--;
      roundAttempts[rIdx]++;
      if (roundAttempts[rIdx] > 20) return null; // Te vaak vastgelopen op dit pad
    }
  }

  // Laatste check: Iedereen exact op mpp?
  const finalCounts = playedCountsHistory[totalRounds];
  if (!allPlayers.every(p => finalCounts.get(p.id) === mpp)) return null;

  return {
    competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length,
    rounds, standings: [], isCompleted: false
  };
}

export async function generateNKSchedule(players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  while (validVersions.length < 5 && totalAttempts < 400) {
    totalAttempts++;
    onProgress(`Bouwen & Controleren (Versie ${validVersions.length + 1}/5)...`);
    const session = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName);
    
    if (session) {
      validVersions.push(session);
      await delay(1);
    }
    if (totalAttempts % 10 === 0) await delay(1);
  }

  if (validVersions.length === 0) {
    throw new Error(`KEIHARDE EIS NIET HAALBAAR:\nMet ${players.length} spelers en ${ppt}vs${ppt} is het wiskundig niet gelukt om iedereen ${mpp} keer te laten spelen met een 4.0+ rating per team.\n\nAdvies: Probeer 1 wedstrijd minder p.p.`);
  }

  // Kies de versie met de beste sociale spreiding
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

  return validVersions.reduce((best, cur) => getSocialScore(cur) < getSocialScore(best) ? cur : best);
}
