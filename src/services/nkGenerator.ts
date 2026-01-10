import { Player, NKSession, NKRound, NKMatch, NKStandingsEntry } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateNKSchedule = async (
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void // Callback voor voortgang op scherm
): Promise<NKSession> => {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatchesNeeded = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const togetherHistory = new Map<string, number>(); 
  const againstHistory = new Map<string, number>();  
  const restCounts = new Map<number, number>();
  const getPairKey = (id1: number, id2: number) => [id1, id2].sort().join('-');

  players.forEach(p => {
    restCounts.set(p.id, totalRounds - matchesPerPlayer);
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

    // We verhogen de balans en historie grens stap voor stap
    let currentBalanceLimit = 0.30;
    let currentHistoryLimit = 3;

    while (!roundFound) {
      onProgress(`Ronde ${r}: Balans ${currentBalanceLimit.toFixed(2)} | Max samen/tegen: ${currentHistoryLimit}`);
      await sleep(1);

      // Doe 100.000 pogingen voor deze specifieke grenzen
      const ITERATIONS_PER_STEP = 100000;
      const CHUNK_SIZE = 5000; // Even ademen voor de browser

      for (let i = 0; i < ITERATIONS_PER_STEP; i += CHUNK_SIZE) {
        if (i % CHUNK_SIZE === 0) await sleep(0);

        for (let j = 0; j < CHUNK_SIZE; j++) {
          // 1. Kies ruster groep
          const resting = [...players].sort((a, b) => 
            (restCounts.get(b.id)! - restCounts.get(a.id)!) || Math.random() - 0.5
          ).slice(0, numPeopleToRest);

          // Check High/Low mix voor rollen
          if (resting.filter(p => p.rating >= 5).length < hallsInRound || 
              resting.filter(p => p.rating < 5).length < hallsInRound) continue;

          const active = players.filter(p => !resting.find(res => res.id === p.id));
          const shuffledActive = [...active].sort(() => Math.random() - 0.5);
          
          let tempMatches: NKMatch[] = [];
          let valid = true;

          for (let h = 0; h < hallsInRound; h++) {
            const mPlayers = shuffledActive.slice(h * playersPerMatch, (h + 1) * playersPerMatch);
            const t1 = mPlayers.slice(0, playersPerTeam);
            const t2 = mPlayers.slice(playersPerTeam);

            // Balans check
            const avg1 = t1.reduce((s, p) => s + p.rating, 0) / t1.length;
            const avg2 = t2.reduce((s, p) => s + p.rating, 0) / t2.length;
            if (Math.abs(avg1 - avg2) > (currentBalanceLimit + 0.001)) { valid = false; break; }

            // Keeper check
            const k1 = t1.filter(p => p.isKeeper).length;
            const k2 = t2.filter(p => p.isKeeper).length;
            if (k1 > 1 || k2 > 1 || Math.abs(k1 - k2) > 1) { valid = false; break; }

            // Historie check
            let historyConflict = false;
            const checkTeam = (team: Player[]) => {
              for (let x = 0; x < team.length; x++) {
                for (let y = x + 1; y < team.length; y++) {
                  if ((togetherHistory.get(getPairKey(team[x].id, team[y].id)) || 0) >= currentHistoryLimit) return true;
                }
              }
              return false;
            };
            if (checkTeam(t1) || checkTeam(t2)) historyConflict = true;
            
            t1.forEach(p1 => {
              t2.forEach(p2 => {
                if ((againstHistory.get(getPairKey(p1.id, p2.id)) || 0) >= currentHistoryLimit) historyConflict = true;
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

      // Als na 100.000 keer niets gevonden is, verruim de balans
      if (!roundFound) {
        currentBalanceLimit += 0.01;
        // Na elke 10 balans-stapjes, rekken we de historie op
        if (Math.round(currentBalanceLimit * 100) % 10 === 0) {
            currentHistoryLimit++;
        }
      }
    }

    // Afronden ronde
    bestResting.forEach(p => restCounts.set(p.id, restCounts.get(p.id)! - 1));
    const rolePool = [...bestResting];
    const findRole = (pool: Player[], cond: (p: Player) => boolean) => {
      const idx = pool.findIndex(cond);
      return idx !== -1 ? pool.splice(idx, 1)[0] : pool.shift() || players[0];
    };

    bestRoundMatches.forEach(match => {
      match.subHigh = findRole(rolePool, p => p.rating >= 5);
      match.subLow = findRole(rolePool, p => p.rating < 5);
      match.referee = findRole(rolePool, () => true);

      // Update historie
      match.team1.forEach(p1 => {
        match.team1.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
        match.team2.forEach(p2 => { againstHistory.set(getPairKey(p1.id, p2.id), (againstHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
      });
      match.team2.forEach(p1 => {
        match.team2.forEach(p2 => { if(p1.id !== p2.id) togetherHistory.set(getPairKey(p1.id, p2.id), (togetherHistory.get(getPairKey(p1.id, p2.id)) || 0) + 1); });
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
