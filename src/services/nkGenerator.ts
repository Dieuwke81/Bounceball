import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getBestTeamSplit(players: Player[], ppt: number, targetDiff: number) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;
  let foundRatingMatch = false;

  function combine(start: number, team1: Player[]) {
    if (team1.length === ppt) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / ppt;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / ppt;
      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      if (avg1 >= 4.0 && avg2 >= 4.0 && k1 <= 1 && k2 <= 1) {
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
  const maxGlobalTime = Date.now() + 5000; 

  while (rIdx <= totalRounds) {
    if (Date.now() > maxGlobalTime) return null;

    const currentPlayedCount = playedCountsHistory[rIdx - 1];
    let roundMatches: NKMatch[] = [];
    let success = false;

    for (let attempt = 0; attempt < 50; attempt++) {
      const usedThisRound = new Set<number>();
      const matches: NKMatch[] = [];
      const target = attempt < 25 ? 0.3 : 0.6;

      const pool = [...allPlayers]
        .filter(p => currentPlayedCount.get(p.id)! < mpp)
        .sort((a, b) => (mpp - currentPlayedCount.get(a.id)!) - (mpp - currentPlayedCount.get(b.id)!) || Math.random() - 0.5)
        .reverse();

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));

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
      } catch (e) { }
    }

    if (success) {
      rounds.push({ roundNumber: rIdx, matches: roundMatches, restingPlayers: [] });
      const nextCounts = new Map(currentPlayedCount);
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1)));
      playedCountsHistory[rIdx] = nextCounts;
      rIdx++;
    } else {
      if (rIdx === 1) return null;
      rounds.pop();
      rIdx--;
      roundAttempts[rIdx]++;
      if (roundAttempts[rIdx] > 15) return null; 
    }
  }

  const finalCounts = playedCountsHistory[totalRounds];
  if (!allPlayers.every(p => finalCounts.get(p.id) === mpp)) return null;

  return { competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length, rounds, standings: [], isCompleted: false };
}

export async function generateNKSchedule(players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  while (validVersions.length < 10 && totalAttempts < 500) {
    totalAttempts++;
    onProgress(`Zoeken naar beste balans: Versie ${validVersions.length}/10 gevonden...`);
    const session = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName);
    
    if (session) {
      validVersions.push(session);
      await delay(1);
    }
    if (totalAttempts % 20 === 0) await delay(1);
  }

  if (validVersions.length === 0) {
    throw new Error(`KEIHARDE EIS NIET HAALBAAR:\nZelfs met backtracking kon geen 4.0+ teams maken. Probeer 1 wedstrijd minder p.p.`);
  }

  // ✅ DE NIEUWE BALANS OPTIMALISATIE:
  // We berekenen per toernooi-versie wat de uitschieter (grootste verschil) is.
  const getMaxDiff = (s: NKSession): number => {
    let max = 0;
    s.rounds.forEach(r => r.matches.forEach(m => {
      const avg1 = m.team1.reduce((acc, p) => acc + p.rating, 0) / m.team1.length;
      const avg2 = m.team2.reduce((acc, p) => acc + p.rating, 0) / m.team2.length;
      const diff = Math.abs(avg1 - avg2);
      if (diff > max) max = diff;
    }));
    return max;
  };

  onProgress("Meest gebalanceerde schema selecteren...");
  // Kies de versie waarbij het maximale verschil het LAAGST is.
  return validVersions.reduce((best, cur) => getMaxDiff(cur) < getMaxDiff(best) ? cur : best);
}
