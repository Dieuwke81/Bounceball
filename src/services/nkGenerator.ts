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
      
      const pool = [...allPlayers].filter(p => currentPlayedCount.get(p.id)! < mpp)
        .sort((a, b) => (mpp - currentPlayedCount.get(a.id)!) - (mpp - currentPlayedCount.get(b.id)!) || Math.random() - 0.5)
        .reverse();

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / ppm));
      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, ppm);
          if (mPlayers.length < ppm) break;
          const split = getBestTeamSplit(mPlayers, ppt, target, minRating, isIntro);
          if (!split) throw new Error("Could not find a valid team split"); // Meer specifieke foutmelding
          mPlayers.forEach(p => usedThisRound.add(p.id));
          matches.push({ id: `r${rIdx}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false, subLow: null as any, subHigh: null as any, referee: null as any });
        }
        
        // Wie hebben er rust?
        let resting = allPlayers.filter(p => !usedThisRound.has(p.id));

        // ----------------------------------------------------------------------
        // HARDE LOGICA: RESERVES VULLEN MET RATING EISEN (AANGEPAST)
        // ----------------------------------------------------------------------
        
        // Shuffle de matches om een eerlijke verdeling van reserves te bevorderen
        const shuffledMatches = [...matches].sort(() => Math.random() - 0.5);

        // 1. Splits de rustende spelers in de twee bakken
        // Bak LAAG: alles onder 6.0 (gesorteerd van laag naar hoog)
        let lowPool = resting.filter(p => p.rating < 6.0).sort((a, b) => a.rating - b.rating);
        
        // Bak HOOG: alles vanaf 6.0 (gesorteerd van laag naar hoog)
        let highPool = resting.filter(p => p.rating >= 6.0).sort((a, b) => a.rating - b.rating);

        const requiredLowSubs = shuffledMatches.length;
        const requiredHighSubs = shuffledMatches.length;

        // Controleer of er genoeg spelers zijn voor de minimale eisen
        if (lowPool.length < requiredLowSubs || highPool.length < requiredHighSubs) {
            // Als er te weinig spelers zijn in een van de categorieën,
            // dan is deze ronde niet mogelijk onder de strenge regels.
            // Gooi een error om een retry van de ronde te forceren.
            throw new Error("Niet genoeg spelers voor de vereiste lage en hoge reserves");
        }

        // STAP 1: Vul alle LAGE reserves (Prioriteit 1) - Strikt uit lowPool
        for (let m of shuffledMatches) {
            m.subLow = lowPool.shift()!; // We hebben gecontroleerd dat er genoeg zijn
        }

        // STAP 2: Vul alle HOGE reserves (Prioriteit 2) - Strikt uit highPool
        for (let m of shuffledMatches) {
            m.subHigh = highPool.pop()!; // We hebben gecontroleerd dat er genoeg zijn
        }

        // STAP 3: Vul SCHEIDSRECHTERS met wat er over is (Prioriteit 3 - Mag leeg blijven)
        // Gooi de restanten weer op één hoop, gesorteerd op rating
        let leftovers = [...lowPool, ...highPool].sort((a, b) => a.rating - b.rating);
        
        for (let m of shuffledMatches) {
            if (leftovers.length > 0) {
                // Pak de middelste speler voor scheids (meest eerlijk)
                m.referee = leftovers.splice(Math.floor(leftovers.length / 2), 1)[0]; 
            } else {
                m.referee = null as any; // Geen probleem, scheids mag leeg
            }
        }
        // ----------------------------------------------------------------------

        roundMatches = matches; success = true; break;
      } catch (e) {
        // Log de fout voor debuggen, maar laat de loop verdergaan met een nieuwe poging
        // console.warn("Attempt failed for round", rIdx, ":", (e as Error).message);
      }
    }

    if (success) {
      const time = manualTimes[rIdx - 1] || { start: '', end: '' };
      rounds.push({ roundNumber: rIdx, matches: roundMatches, restingPlayers: [], startTime: time.start, endTime: time.end } as any);
      const nextCounts = new Map(currentPlayedCount);
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1)));
      // Ook de reserves tellen mee voor de 'gespeelde' count als we willen dat ze niet te vaak rusten
      roundMatches.forEach(m => {
        if (m.subLow) nextCounts.set(m.subLow.id, nextCounts.get(m.subLow.id)! + 0.5); // Bijvoorbeeld een halve wedstrijd
        if (m.subHigh) nextCounts.set(m.subHigh.id, nextCounts.get(m.subHigh.id)! + 0.5); // Bijvoorbeeld een halve wedstrijd
        if (m.referee) nextCounts.set(m.referee.id, nextCounts.get(m.referee.id)! + 0.25); // En een kwart voor scheids
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
  // Pas deze controle aan als je de playedCount voor reserves hebt aangepast (bijv. +0.5)
  // De `mpp` moet dan mogelijk ook de verwachte "sub" of "referee" activiteiten omvatten,
  // of je moet de playedCount voor de "isComplete" check anders berekenen.
  const isComplete = allPlayers.every(p => lastCounts.get(p.id)! >= mpp); 
  if (!isComplete) return null;

  return { competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length, rounds, standings: [], isCompleted: false };
}

export async function generateNKSchedule(
    players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void, manualTimes: {start: string, end: string}[], minTeamRating: number, isIntro: boolean
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  while (validVersions.length < 250 && totalAttempts < 2000) {
    totalAttempts++;
    if (totalAttempts % 10 === 0) {
        onProgress(`Optimaliseren: Versie ${validVersions.length}/250 gevonden...`);
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
      // Tel alle betrokken spelers mee voor de social score
      const p = [...m.team1, ...m.team2];
      if (m.subLow) p.push(m.subLow);
      if (m.subHigh) p.push(m.subHigh);
      if (m.referee) p.push(m.referee);

      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const key = [p[i].id, p[j].id].sort().join('-');
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    }));
    let score = 0;
    pairs.forEach(v => score += Math.pow(v, 2));
    return score;
  };

  const sortedByBalance = [...validVersions].sort((a, b) => getMaxDiff(a) - getMaxDiff(b));
  const top5Balanced = sortedByBalance.slice(0, 5);
  return top5Balanced.reduce((best, cur) => getSocialScore(cur) < getSocialScore(best) ? cur : best);
}
