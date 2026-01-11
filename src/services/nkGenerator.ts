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

      // Keepers check: verplicht max 1 per team
      if (k1 <= 1 && k2 <= 1) {
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
      if (bestDiff <= targetDiff) return; // Vroegtijdig stoppen als doel bereikt is
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
  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatches / hallNames.length);

  let attempt = 0;
  while (attempt < 100) {
    attempt++;
    onProgress(`Hoofdpoging ${attempt}...`);
    await delay(1);

    const playedCount = new Map(players.map(p => [p.id, 0]));
    const allRounds: NKRound[] = [];
    let success = true;

    for (let r = 1; r <= totalRounds; r++) {
      let roundMatches: NKMatch[] = [];
      let roundSuccess = false;
      
      // Probeer elke ronde 100 keer te genereren met een schuivende balans-eis
      for (let rAttempt = 0; rAttempt < 100; rAttempt++) {
        // In de eerste rondes zijn we streng (0.3), later iets soepeler als het echt niet anders kan
        const target = r < totalRounds - 1 ? 0.3 : 0.4 + (rAttempt * 0.01);
        const usedThisRound = new Set<number>();
        const currentMatches: NKMatch[] = [];

        // Kies pool: wie moet het meest spelen?
        const pool = [...players]
          .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
          .sort((a, b) => (playedCount.get(b.id)! - playedCount.get(a.id)!) || (Math.random() - 0.5))
          .reverse();

        const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
        
        try {
          for (let h = 0; h < mInRound; h++) {
            const mPlayers = pool.filter(p => !usedThisRound.has(p.id)).slice(0, playersPerMatch);
            if (mPlayers.length < playersPerMatch) throw new Error("Te weinig spelers");

            const { split, diff } = getBestTeamSplit(mPlayers, playersPerTeam, target);
            if (!split || diff > target + 0.2) throw new Error("Geen balans");

            mPlayers.forEach(p => usedThisRound.add(p.id));
            currentMatches.push({
              id: `r${r}h${h}`, hallName: hallNames[h],
              team1: split.t1, team2: split.t2, team1Score: 0, team2Score: 0, isPlayed: false,
              subLow: null as any, subHigh: null as any, referee: null as any
            });
          }

          // Officials toewijzen
          const resting = players.filter(p => !usedThisRound.has(p.id)).sort((a,b) => a.rating - b.rating);
          if (resting.length < currentMatches.length * 3) throw new Error("Te weinig officials");

          currentMatches.forEach((m, idx) => {
            m.subLow = resting[idx * 3];
            m.subHigh = resting[resting.length - 1 - (idx * 3)];
            m.referee = resting[idx * 3 + 1];
          });

          roundMatches = currentMatches;
          roundSuccess = true;
          break; 
        } catch (e) { continue; }
      }

      if (roundSuccess) {
        roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => playedCount.set(p.id, playedCount.get(p.id)! + 1)));
        allRounds.push({ roundNumber: r, matches: roundMatches, restingPlayers: players.filter(p => !roundMatches.some(m => [...m.team1, ...m.team2].some(x => x.id === p.id))) });
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
  throw new Error("Het lukt niet om een sluitend schema te maken met deze spelers. Probeer 1 speler meer/minder of verlaag het aantal wedstrijden p.p.");
}
