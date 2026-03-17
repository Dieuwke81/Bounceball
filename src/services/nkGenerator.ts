import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getBestTeamSplit(players: Player[], ppt: number, targetDiff: number, minRating: number, isIntro: boolean) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  function combine(start: number, team1: Player[]) {
    if (team1.length === ppt) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / ppt;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / ppt;
      
      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;
      const keepersOk = isIntro ? true : (k1 <= 1 && k2 <= 1);

      if (avg1 >= minRating && avg2 >= minRating && keepersOk) {
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
  if (isIntro && bestDiff > 0.00001) return null;
  return bestSplit;
}

async function generateSingleVersion(
  allPlayers: Player[], 
  hallNames: string[], 
  mpp: number, 
  ppt: number, 
  competitionName: string,
  manualTimes: {start: string, end: string}[],
  minRating: number,
  isIntro: boolean
): Promise<NKSession | null> {
  const ppm = ppt * 2;
  const totalRounds = Math.ceil((allPlayers.length * mpp / ppm) / hallNames.length);
  const playedCount = new Map(allPlayers.map(p => [p.id, 0]));
  const pairCounts = new Map<string, number>(); // Bijhouden wie wie heeft gezien in DEZE versie
  const rounds: NKRound[] = [];
  const playedCountsHistory: (Map<number, number>)[] = [new Map(playedCount)];
  const roundAttempts = new Array(totalRounds + 1).fill(0);
  
  let rIdx = 1;
  const maxGlobalTime = Date.now() + 5000; 

  while (rIdx <= totalRounds) {
    if (Date.now() > maxGlobalTime) return null;
    const currentPlayedCount = playedCountsHistory[rIdx - 1];
    let success = false;
    let roundMatches: NKMatch[] = [];

    for (let attempt = 0; attempt < 50; attempt++) {
      const usedThisRound = new Set<number>();
      const matches: NKMatch[] = [];
      const target = isIntro ? 0 : (attempt < 25 ? 0.3 : 0.6);
      
      // Pool van spelers die nog wedstrijden moeten spelen
      let pool = [...allPlayers].filter(p => currentPlayedCount.get(p.id)! < mpp)
        .sort((a, b) => (mpp - currentPlayedCount.get(a.id)!) - (mpp - currentPlayedCount.get(b.id)!) || Math.random() - 0.5)
        .reverse();

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));
      try {
        for (let h = 0; h < mInRound; h++) {
          const candidates = pool.filter(p => !usedThisRound.has(p.id));
          if (candidates.length < ppm) break;

          // --- SOCIALE SELECTIE ---
          // Pak niet zomaar de eersten, maar kies een groep die elkaar weinig heeft gezien
          const selectedForMatch: Player[] = [];
          selectedForMatch.push(candidates[0]); // Start met de speler die de hoogste prio heeft

          while (selectedForMatch.length < ppm) {
            const remaining = candidates.filter(c => !selectedForMatch.includes(c));
            // Sorteer resterende spelers op basis van ontmoetingen met de al geselecteerden
            remaining.sort((a, b) => {
                const scoreA = selectedForMatch.reduce((sum, p) => sum + (pairCounts.get([p.id, a.id].sort().join('-')) || 0), 0);
                const scoreB = selectedForMatch.reduce((sum, p) => sum + (pairCounts.get([p.id, b.id].sort().join('-')) || 0), 0);
                return scoreA - scoreB || Math.random() - 0.5;
            });
            selectedForMatch.push(remaining[0]);
          }
          
          const mPlayers = selectedForMatch;
          const split = getBestTeamSplit(mPlayers, ppt, target, minRating, isIntro);
          if (!split) throw new Error();
          
          mPlayers.forEach(p => usedThisRound.add(p.id));
          matches.push({ id: `r${rIdx}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false, subLow: null as any, subHigh: null as any, referee: null as any });
        }

        let resting = allPlayers.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        for (let m of matches) { 
            if (resting.length > 0) m.subLow = resting.shift()!;
            if (resting.length > 0) m.subHigh = resting.pop()!;
            if (resting.length > 0) m.referee = resting.splice(Math.floor(resting.length / 2), 1)[0]; 
        }
        roundMatches = matches; success = true; break;
      } catch (e) {}
    }

    if (success) {
      const time = manualTimes[rIdx - 1] || { start: '', end: '' };
      rounds.push({ roundNumber: rIdx, matches: roundMatches, restingPlayers: [], startTime: time.start, endTime: time.end } as any);
      const nextCounts = new Map(currentPlayedCount);
      
      roundMatches.forEach(m => {
        const allInMatch = [...m.team1, ...m.team2];
        allInMatch.forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1));
        // Update pair counts voor sociale selectie in volgende rondes
        for (let i = 0; i < allInMatch.length; i++) {
            for (let j = i + 1; j < allInMatch.length; j++) {
                const key = [allInMatch[i].id, allInMatch[j].id].sort().join('-');
                pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
            }
        }
      });
      
      playedCountsHistory[rIdx] = nextCounts;
      rIdx++;
    } else {
      if (rIdx === 1) return null;
      rounds.pop(); rIdx--; roundAttempts[rIdx]++;
      if (roundAttempts[rIdx] > 15) return null; 
    }
  }

  const lastCounts = playedCountsHistory[playedCountsHistory.length - 1];
  if (!allPlayers.every(p => lastCounts.get(p.id) === mpp)) return null;

  return { competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length, rounds, standings: [], isCompleted: false };
}

export async function generateNKSchedule(
    players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void, manualTimes: {start: string, end: string}[], minTeamRating: number, isIntro: boolean
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  // We genereren meer versies om een betere sociale spreiding te kunnen vinden
  while (validVersions.length < 300 && totalAttempts < 3000) {
    totalAttempts++;
    if (totalAttempts % 10 === 0) {
        onProgress(`Optimaliseren: Versie ${validVersions.length}/300 gevonden...`);
        await delay(1);
    }
    const session = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName, manualTimes, minTeamRating, isIntro);
    if (session) validVersions.push(session);
  }

  if (validVersions.length === 0) throw new Error("Geen schema gevonden die voldoet aan de eisen.");

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

  const getSocialScore = (s: NKSession): number => {
    const pairs = new Map<string, number>();
    s.rounds.forEach(r => r.matches.forEach(m => {
      const p = [...m.team1, ...m.team2];
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const key = [p[i].id, p[j].id].sort().join('-');
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }));

    let score = 0;
    let maxRepeats = 0;
    pairs.forEach(v => {
      // EXTREME straf voor herhalingen boven de 2-3 keer.
      // v^6 zorgt dat 4x herhalen (4096) vele malen zwaarder weegt dan 2x (64).
      score += Math.pow(v, 6);
      if (v > maxRepeats) maxRepeats = v;
    });

    // Straf voor spelers die elkaar NOOIT zien
    let missing = 0;
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            if (!pairs.has([players[i].id, players[j].id].sort().join('-'))) missing++;
        }
    }

    return score + (missing * 500) + (maxRepeats * 10000);
  };

  // Selectie-strategie:
  // 1. Filter versies die een acceptabele balans hebben (bijv. maxDiff < 0.7)
  // 2. Sorteer die subset op de allerbeste sociale score.
  const balanceThreshold = 0.75;
  let candidates = validVersions.filter(v => getMaxDiff(v) <= balanceThreshold);
  
  // Als er geen kandidaten zijn onder de threshold, pak dan de 20 beste qua balans
  if (candidates.length < 10) {
      candidates = [...validVersions].sort((a, b) => getMaxDiff(a) - getMaxDiff(b)).slice(0, 20);
  }

  return candidates.reduce((best, cur) => getSocialScore(cur) < getSocialScore(best) ? cur : best);
}
