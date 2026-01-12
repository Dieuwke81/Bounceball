import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

      // VOORWAARDEN: 
      // 1. Max 1 keeper per team
      // 2. BEIDE teams moeten minimaal een 4.0 gemiddelde hebben
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

export async function generateNKSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string,
  onProgress: (msg: string) => void
): Promise<NKSession> {
  const playersPerMatch = playersPerTeam * 2;
  
  // 1. Validatie van groepsgemiddelde
  const groupAvg = players.reduce((s, p) => s + p.rating, 0) / players.length;
  if (groupAvg < 4.0) {
    throw new Error(`Onmogelijk: De geselecteerde groep heeft een gemiddelde van ${groupAvg.toFixed(2)}. Om teams van min. 4.0 te maken moet het groepsgemiddelde ook minimaal 4.0 zijn.`);
  }

  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatches / hallNames.length);

  let attempt = 0;
  while (attempt < 100) {
    attempt++;
    onProgress(`Poging ${attempt} (Mikt op balans 0.3 & Gem 4.0+)...`);
    await delay(1);

    const playedCount = new Map(players.map(p => [p.id, 0]));
    const allRounds: NKRound[] = [];
    let success = true;

    for (let r = 1; r <= totalRounds; r++) {
      let roundMatches: NKMatch[] = [];
      let roundSuccess = false;
      
      for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
        const target = r < totalRounds - 1 ? 0.3 : 0.4 + (rAttempt * 0.01);
        const usedThisRound = new Set<number>();
        const currentMatches: NKMatch[] = [];

        const pool = [...players]
          .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
          .sort((a, b) => (playedCount.get(b.id)! - playedCount.get(a.id)!) || (Math.random() - 0.5))
          .reverse();

        const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
        
        try {
          for (let h = 0; h < mInRound; h++) {
            const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
            if (mPlayers.length < playersPerMatch) throw new Error("Pool leeg");

            const { split, diff } = getBestTeamSplit(mPlayers, playersPerTeam, target);
            if (!split) throw new Error("Geen balans of gem < 4.0");

            mPlayers.forEach(p => usedThisRound.add(p.id));
            currentMatches.push({
              id: `r${r}h${h}`, hallName: hallNames[h],
              team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
              subLow: null as any, subHigh: null as any, referee: null as any
            });
          }

          let restingPool = players.filter(p => !usedThisRound.has(p.id)).sort((a, b) => a.rating - b.rating);
          if (restingPool.length < currentMatches.length * 3) throw new Error("Te weinig officials");

          for (let m of currentMatches) {
            m.subLow = restingPool.shift()!;
            m.subHigh = restingPool.pop()!;
            const midIdx = Math.floor(restingPool.length / 2);
            m.referee = restingPool.splice(midIdx, 1)[0];
          }

          roundMatches = currentMatches;
          roundSuccess = true;
          break; 
        } catch (e) { continue; }
      }

      if (roundSuccess) {
        roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
        allRounds.push({ 
            roundNumber: r, 
            matches: roundMatches, 
            restingPlayers: players.filter(p => !roundMatches.some(m => 
                [...m.team1, ...m.team2, m.subLow, m.subHigh, m.referee].some(x => x?.id === p.id)
            )) 
        });
      } else {
        success = false;
        break;
      }
    }

    if (success && Array.from(playedCount.values()).every(v => v === matchesPerPlayer)) {
      return {
        competitionName, hallNames, playersPerTeam, totalRounds: allRounds.length,
        rounds: allRounds, standings: players.map(p => ({ playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 })),
        isCompleted: false
      };
    }
  }
  throw new Error("Het lukt niet om een schema te maken waarbij elk team minimaal 4.0 gemiddeld is. Selecteer sterkere spelers of verlaag het aantal wedstrijden.");
}
