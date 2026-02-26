import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getBestTeamSplit(players: Player[], ppt: number, targetDiff: number, minRating: number, isIntro: boolean) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  function combine(start: number, team1: Player[], currentTargetDiff: number) { // targetDiff als parameter
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
      combine(i + 1, team1, currentTargetDiff);
      team1.pop();
      if (bestDiff <= currentTargetDiff) return; // Gebruik currentTargetDiff
    }
  }

  // Eerste poging met de originele targetDiff
  combine(0, []);

  // Als isIntro is en er is geen split gevonden, probeer dan met een iets flexibeler targetDiff
  if (isIntro && bestSplit === null) {
      bestDiff = Infinity; // Reset bestDiff voor de tweede poging
      combine(0, [], 0.1); // Probeer met een toegestane afwijking van 0.1
  }
  
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
          if (mPlayers.length < ppm) throw new Error("Not enough players for a full match in pool."); // Directe fout als pool te klein is
          const split = getBestTeamSplit(mPlayers, ppt, target, minRating, isIntro);
          if (!split) throw new Error("Could not find a valid team split for match."); 
          mPlayers.forEach(p => usedThisRound.add(p.id));
          matches.push({ id: `r${rIdx}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false, subLow: null as any, subHigh: null as any, referee: null as any });
        }
        
        // Wie hebben er rust?
        let resting = allPlayers.filter(p => !usedThisRound.has(p.id));

        // ----------------------------------------------------------------------
        // HARDE LOGICA: RESERVES VULLEN MET RATING EISEN (NOGMAALS AANGEPAST - Flexibeler)
        // ----------------------------------------------------------------------
        
        const shuffledMatches = [...matches].sort(() => Math.random() - 0.5);

        let lowPool = resting.filter(p => p.rating < 6.0).sort((a, b) => a.rating - b.rating);
        let highPool = resting.filter(p => p.rating >= 6.0).sort((a, b) => a.rating - b.rating);

        let currentLowPool = [...lowPool]; // Kopie voor de 1e poging
        let currentHighPool = [...highPool]; // Kopie voor de 1e poging

        let perfectFillAttemptedAndFailed = false;

        // Eerste poging: probeer perfect te vullen (1 low, 1 high per match)
        for (let m of shuffledMatches) {
            if (currentLowPool.length > 0) {
                m.subLow = currentLowPool.shift()!;
            } else {
                perfectFillAttemptedAndFailed = true;
                break;
            }
            if (currentHighPool.length > 0) {
                m.subHigh = currentHighPool.pop()!;
            } else {
                perfectFillAttemptedAndFailed = true;
                break;
            }
        }

        // Als perfecte vulling is mislukt, of als er nog matches over zijn zonder reserves, reset en vul flexibel
        if (perfectFillAttemptedAndFailed) {
            // Reset de subLow en subHigh voor alle matches van deze ronde
            for (let m of shuffledMatches) {
                m.subLow = null as any;
                m.subHigh = null as any;
            }
            
            // Gooi alle resterende rustende spelers in een algemene pool
            let generalReservePool = [...lowPool, ...highPool].sort((a,b) => a.rating - b.rating);

            // Vul nu eerst alle subLow plekken, beginnend met de laagste spelers uit de algemene pool
            for (let m of shuffledMatches) {
                if (generalReservePool.length > 0) {
                    m.subLow = generalReservePool.shift()!;
                } else {
                    throw new Error("Niet genoeg algemene spelers voor subLow reserves na flexibele poging.");
                }
            }

            // Vul daarna alle subHigh plekken, beginnend met de hoogste resterende spelers uit de algemene pool
            for (let m of shuffledMatches) {
                if (generalReservePool.length > 0) {
                    m.subHigh = generalReservePool.pop()!;
                } else {
                    throw new Error("Niet genoeg algemene spelers voor subHigh reserves na flexibele poging.");
                }
            }
        }
        
        // STAP 3: Vul SCHEIDSRECHTERS met wat er over is (Mag leeg blijven)
        let leftoversForReferees = perfectFillAttemptedAndFailed ? generalReservePool : [...currentLowPool, ...currentHighPool];
        leftoversForReferees.sort((a,b) => a.rating - b.rating); // Zorg dat het gesorteerd is

        for (let m of shuffledMatches) {
            if (leftoversForReferees.length > 0) {
                m.referee = leftoversForReferees.splice(Math.floor(leftoversForReferees.length / 2), 1)[0]; 
            } else {
                m.referee = null as any; 
            }
        }
        // ----------------------------------------------------------------------

        roundMatches = matches; success = true; break;
      } catch (e) {
        // console.warn(`Attempt ${attempt + 1} for round ${rIdx} failed: ${(e as Error).message}`);
      }
    }

    if (success) {
      const time = manualTimes[rIdx - 1] || { start: '', end: '' };
      rounds.push({ roundNumber: rIdx, matches: roundMatches, restingPlayers: [], startTime: time.start, endTime: time.end } as any);
      
      const nextCounts = new Map(currentPlayedCount);
      roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => nextCounts.set(p.id, nextCounts.get(p.id)! + 1)));
      
      // Optionele: Tel de reserves/referees mee voor een 'activiteit' score
      // Pas de mpp hierop aan, of gebruik een aparte meter als dit niet direct telt voor 'wedstrijden gespeeld'
      // roundMatches.forEach(m => {
      //   if (m.subLow) nextCounts.set(m.subLow.id, nextCounts.get(m.subLow.id)! + 0.5); 
      //   if (m.subHigh) nextCounts.set(m.subHigh.id, nextCounts.get(m.subHigh.id)! + 0.5); 
      //   if (m.referee) nextCounts.set(m.referee.id, nextCounts.get(m.referee.id)! + 0.25);
      // });

      playedCountsHistory[rIdx] = nextCounts;
      rIdx++;
    } else {
      if (rIdx === 1) return null;
      rounds.pop(); rIdx--; roundAttempts[rIdx]++;
      if (roundAttempts[rIdx] > 15) { // Verhoog het aantal pogingen per ronde als het vaak misgaat?
          // console.error(`Failed to generate round ${rIdx} after ${roundAttempts[rIdx]} attempts.`);
          return null; 
      }
    }
  }

  // Aparte berekening voor isComplete om alleen de 'echte' wedstrijden te tellen
  const finalPlayedMatchesCount = new Map(allPlayers.map(p => [p.id, 0]));
  rounds.forEach(round => {
      round.matches.forEach(match => {
          [...match.team1, ...match.team2].forEach(p => {
              finalPlayedMatchesCount.set(p.id, finalPlayedMatchesCount.get(p.id)! + 1);
          });
      });
  });

  const isComplete = allPlayers.every(p => finalPlayedMatchesCount.get(p.id)! >= mpp); 
  if (!isComplete) {
    // console.warn("Schedule incomplete: Not all players played the required number of matches (mpp).");
    return null;
  }

  return { competitionName, hallNames, playersPerTeam: ppt, totalRounds: rounds.length, rounds, standings: [], isCompleted: false };
}

export async function generateNKSchedule(
    players: Player[], hallNames: string[], mpp: number, ppt: number, competitionName: string, onProgress: (msg: string) => void, manualTimes: {start: string, end: string}[], minTeamRating: number, isIntro: boolean
): Promise<NKSession> {
  const validVersions: NKSession[] = [];
  let totalAttempts = 0;

  while (validVersions.length < 250 && totalAttempts < 2000) { // Aantal pogingen verhoogd van 2000?
    totalAttempts++;
    if (totalAttempts % 10 === 0) {
        onProgress(`Optimaliseren: Versie ${validVersions.length}/250 gevonden... (Poging: ${totalAttempts})`);
        await delay(1);
    }
    const session = await generateSingleVersion(players, hallNames, mpp, ppt, competitionName, manualTimes, minTeamRating, isIntro);
    if (session) validVersions.push(session);
  }

  if (validVersions.length === 0) throw new Error("Geen schema gevonden die voldoet aan de eisen na meerdere pogingen.");

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
