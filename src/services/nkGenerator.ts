import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function calculateSocialScore(session: NKSession): number {
  const pairCounts = new Map<string, number>();
  session.rounds.forEach(r => r.matches.forEach(m => {
    const allPlayers = [...m.team1, ...m.team2];
    for (let i = 0; i < allPlayers.length; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const key = [allPlayers[i].id, allPlayers[j].id].sort().join('-');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }));
  let score = 0;
  pairCounts.forEach(count => { score += Math.pow(count, 2); });
  return score;
}

function getBestTeamSplit(players: Player[], playersPerTeam: number, targetDiff: number) {
  let bestDiff = Infinity;
  let bestSplit: { t1: Player[], t2: Player[] } | null = null;

  function combine(start: number, team1: Player[]) {
    if (team1.length === playersPerTeam) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const diff = Math.abs(avg1 - avg2);
      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      if (k1 <= 1 && k2 <= 1 && avg1 >= 4.0 && avg2 >= 4.0) {
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
  return { split: bestSplit, diff: bestDiff };
}

async function generateSingleVersion(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<NKSession | null> {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatchesNeeded = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatchesNeeded / hallNames.length);

  const playedCount = new Map(players.map(p => [p.id, 0]));
  const allRounds: NKRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    let roundSuccess = false;
    let roundMatches: NKMatch[] = [];
    
    for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
      const target = rAttempt < 50 ? 0.3 : 0.4;
      const usedThisRound = new Set<number>();
      const currentMatches: NKMatch[] = [];

      const pool = [...players]
        .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
        .sort((a, b) => (playedCount.get(a.id)! - playedCount.get(b.id)!) || (Math.random() - 0.5));

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
      
      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
          if (mPlayers.length < playersPerMatch) throw new Error("Te weinig spelers");

          const { split } = getBestTeamSplit(mPlayers, playersPerTeam, target);
          if (!split) throw new Error("Geen balans");

          mPlayers.forEach(p => usedThisRound.add(p.id));
          currentMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h],
            team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        let restingPool = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
        if (restingPool.length < currentMatches.length * 3) throw new Error("Officials tekort");

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
        return null;
    }
  }

  const allReachedLimit = players.every(p => playedCount.get(p.id) === matchesPerPlayer);
  if (!allReachedLimit) return null;

  return {
    competitionName, hallNames, playersPerTeam, totalRounds: allRounds.length,
    rounds: allRounds, standings: players.map(p => ({ playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 })),
    isCompleted: false
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

  while (validVersions.length < 10 && attempts < 1000) {
    attempts++;
    const version = await generateSingleVersion(players, hallNames, matchesPerPlayer, playersPerTeam, competitionName);
    
    if (version) {
      validVersions.push(version);
      onProgress(`Kwaliteitscontrole: ${validVersions.length}/10 versies gevonden...`);
      await delay(10);
    }
    
    if (attempts % 50 === 0) {
      onProgress(`Bezig met berekenen (Poging ${attempts})...`);
      await delay(1);
    }
  }

  if (validVersions.length === 0) {
    throw new Error("Het lukt niet om een schema te maken waarbij iedereen exact het gevraagde aantal wedstrijden speelt. Controleer de spelersgroep.");
  }

  return validVersions.reduce((best, current) => 
    calculateSocialScore(current) < calculateSocialScore(best) ? current : best
  );
}
