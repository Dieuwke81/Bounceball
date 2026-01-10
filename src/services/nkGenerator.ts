import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> => {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatchesNeeded = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const restTokens = new Map<number, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  // Iedereen moet een x aantal keer rusten (Totaal rondes - wedstrijden pp)
  players.forEach(p => {
    restTokens.set(p.id, totalRounds - matchesPerPlayer);
  });

  const rounds: NKRound[] = [];
  let matchesRemaining = totalMatchesNeeded;

  for (let r = 1; r <= totalRounds; r++) {
    const hallsInRound = Math.min(hallNames.length, matchesRemaining);
    const spotsToFill = hallsInRound * playersPerMatch;
    const numPeopleToRest = players.length - spotsToFill;

    let bestRoundMatches: NKMatch[] = [];
    let bestResting: Player[] = [];
    let roundFound = false;

    // Startwaarden voor de zoektocht
    let currentBalanceLimit = 0.30;
    let currentHistoryLimit = 3;

    // Blijf zoeken tot de ronde gevuld is
    while (!roundFound) {
      onProgress(`Ronde ${r}: Balans ${currentBalanceLimit.toFixed(2)} | Max herhaling: ${currentHistoryLimit}`);
      await sleep(1);

      // We proberen 100.000 keer per balans-stap
      const ITERATIONS_PER_STEP = 100000;
      const CHUNK_SIZE = 1000; // Kleine brokjes werk om browser levend te houden

      for (let i = 0; i < ITERATIONS_PER_STEP; i += CHUNK_SIZE) {
        if (i % CHUNK_SIZE === 0) await sleep(0);

        for (let j = 0; j < CHUNK_SIZE; j++) {
          // 1. Kies spelers die moeten rusten (wie rust-tokens heeft)
          const resting = [...players].sort((a, b) => 
            (restTokens.get(b.id)! - restCounts.get(a.id)!) || Math.random() - 0.5
          ).slice(0, numPeopleToRest);

          // Harde eis: Reserves mix (1x High, 1x Low per zaal)
          const highRusters = resting.filter(p => p.rating >= 5).length;
          const lowRusters = resting.filter(p => p.rating < 5).length;
          
          if (highRusters < hallsInRound || lowRusters < hallsInRound) {
              // Als we na heel veel pogingen geen perfecte rust-mix vinden, 
              // versoepelen we deze eis een heel klein beetje om door te kunnen
              if (currentBalanceLimit < 0.50) continue; 
          }

          const active = players.filter(p => !resting.find(res => res.id === p.id));
          const shuffledActive = [...active].sort(() => Math.random() - 0.5);
          
          let tempMatches: NKMatch[] = [];
          let valid = true;

          for (let h = 0; h < hallsInRound; h++) {
            const mPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
            const t1 = mPlayers.slice(0, playersPerTeam);
            const t2 = mPlayers.slice(playersPerTeam);

            // A. Balans check
            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            if (Math.abs(avg1 - avg2) > (currentBalanceLimit + 0.001)) { valid = false; break; }

            // B. Keeper check
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

            // C. Historie check (Samen & Tegen)
            let historyConflict = false;
            const checkTeam = (team: Player[]) => {
              for (let x = 0; x < team.length; x++) {
                for (let y = x + 1; y < team.length; y++) {
                  const count = togetherHistory.get(getPairKey(team[x].id, team[y].id)) || 0;
                  if (count >= currentHistoryLimit) return true;
                }
              }
              return false;
            };
            if (checkTeam(t1) || checkTeam(t2)) historyConflict = true;
            
            t1.forEach(p1 => {
              t2.forEach(p2 => {
                const count = againstHistory.get(getPairKey(p1.id, p2.id)) || 0;
                if (count >= currentHistoryLimit) historyConflict = true;
                // Totaal check (Samen + Tegen mag max 6)
                const tog = togetherHistory.get(getPairKey(p1.id, p2.id)) || 0;
                if (tog + count >= 6) historyConflict = true;
              });
            });

            if (historyConflict) { valid = false; break; }

            tempMatches.push({
              id: `r${r}h${h}`, hallName: hallNames[h], team1: t1, team2: t2,
              team1Score: 0, team2Score: 0, isPlayed: false,
              referee: players[0], subHigh: players[0], subLow: players[0]
            });
          }

          if (valid) {
            bestRoundMatches = tempMatches;
            bestResting = resting;
            roundFound = true;
            break;
          }
        }
        if (roundFound) break;
      }

      // Geen match na 100.000? Versoepel de grenzen
      if (!roundFound) {
        currentBalanceLimit += 0.01;
        // Na elke 5 stapjes balans rekken we de historie op
        if (Math.round(currentBalanceLimit * 100) % 5 === 0) {
            currentHistoryLimit++;
        }
      }
    }

    // Administratie bijwerken
    bestResting.forEach(p => restTokens.set(p.id, restTokens.get(p.id)! - 1));
    const rolePool = [...bestResting];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
      const idx = pool.findIndex(cond);
      return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    bestRoundMatches.forEach(match => {
      match.subHigh = findRole(rolePool, p => p.rating >= 5);
      match.subLow = findRole(rolePool, p => p.rating < 5);
      match.referee = findRole(rolePool, () => true);

      // Sla op in historie
      const updatePair = (p1: number, p2: number, map: Map<string, number>) => {
          const key = getPairKey(p1, p2);
          map.set(key, (map.get(key) || 0) + 1);
      };

      match.team1.forEach(p1 => {
        match.team1.forEach(p2 => { if(p1.id !== p2.id) updatePair(p1.id, p2.id, togetherHistory); });
        match.team2.forEach(p2 => { updatePair(p1.id, p2.id, againstHistory); });
      });
      match.team2.forEach(p1 => {
        match.team2.forEach(p2 => { if(p1.id !== p2.id) updatePair(p1.id, p2.id, togetherHistory); });
      });
      matchesRemaining--;
    });

    rounds.push({ roundNumber: r, matches: bestRoundMatches, restingPlayers: bestResting });
  }

  const standings: NKStandingsEntry[] = players.map(p => ({
    playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0
  }));

  return { competitionName, totalRounds: rounds.length, hallNames, playersPerTeam, rounds, standings, isCompleted: false };
};
