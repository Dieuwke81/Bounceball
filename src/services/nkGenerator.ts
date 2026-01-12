import { Player, NKSession, NKRound, NKMatch } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function getBestTeamSplit(players: Player[], playersPerTeam: number, targetDiff: number) {
  let validSplits: { t1: Player[], t2: Player[] }[] = [];

  function combine(start: number, team1: Player[]) {
    if (team1.length === playersPerTeam) {
      const team2 = players.filter(p => !team1.find(t1p => t1p.id === p.id));
      const avg1 = team1.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const avg2 = team2.reduce((s, p) => s + p.rating, 0) / playersPerTeam;
      const diff = Math.abs(avg1 - avg2);

      const k1 = team1.filter(p => p.isKeeper).length;
      const k2 = team2.filter(p => p.isKeeper).length;

      if (k1 <= 1 && k2 <= 1 && avg1 >= 4.0 && avg2 >= 4.0 && diff <= targetDiff) {
        validSplits.push({ t1: [...team1], t2: [...team2] });
      }
      return;
    }
    for (let i = start; i < players.length; i++) {
      team1.push(players[i]);
      combine(i + 1, team1);
      team1.pop();
    }
  }

  combine(0, []);
  // Pak een willekeurige uit de geldige splits voor meer variatie tussen toernooien
  return validSplits.length > 0 ? validSplits[Math.floor(Math.random() * validSplits.length)] : null;
}

function calculateSocialScore(session: NKSession): number {
  const together = new Map<string, number>();
  const against = new Map<string, number>();

  session.rounds.forEach(r => r.matches.forEach(m => {
    const add = (p1: number, p2: number, map: Map<string, number>) => {
      const key = [p1, p2].sort().join('-');
      map.set(key, (map.get(key) || 0) + 1);
    };
    m.team1.forEach((p, i) => m.team1.slice(i+1).forEach(p2 => add(p.id, p2.id, together)));
    m.team2.forEach((p, i) => m.team2.slice(i+1).forEach(p2 => add(p.id, p2.id, together)));
    m.team1.forEach(p1 => m.team2.forEach(p2 => add(p1.id, p2.id, against)));
  }));

  let score = 0;
  // Straf herhalingen zwaar af met kwadraten
  together.forEach(v => score += (v * v));
  against.forEach(v => score += (v * v));
  return score;
}

async function generateSingleSchedule(
  players: Player[],
  hallNames: string[],
  matchesPerPlayer: number,
  playersPerTeam: number,
  competitionName: string
): Promise<NKSession | null> {
  const playersPerMatch = playersPerTeam * 2;
  const totalMatches = (players.length * matchesPerPlayer) / playersPerMatch;
  const totalRounds = Math.ceil(totalMatches / hallNames.length);

  const playedCount = new Map(players.map(p => [p.id, 0]));
  const allRounds: NKRound[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatches: NKMatch[] = [];
    const usedThisRound = new Set<number>();
    
    // We proberen per ronde 50 keer een geldige set wedstrijden te vinden
    let roundSuccess = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const target = r < totalRounds - 1 ? 0.3 : 0.45;
      const currentUsed = new Set<number>();
      const currentMatches: NKMatch[] = [];

      const pool = [...players]
        .filter(p => playedCount.get(p.id)! < matchesPerPlayer)
        .sort((a, b) => (playedCount.get(b.id)! - playedCount.get(a.id)!) || (Math.random() - 0.5))
        .reverse();

      const mInRound = Math.min(hallNames.length, Math.floor(pool.length / playersPerMatch));
      
      try {
        for (let h = 0; h < mInRound; h++) {
          const mPlayers = pool.filter(p => !currentUsed.has(p.id)).slice(0, playersPerMatch);
          const split = getBestTeamSplit(mPlayers, playersPerTeam, target);
          if (!split) throw new Error();

          mPlayers.forEach(p => currentUsed.add(p.id));
          currentMatches.push({
            id: `r${r}h${h}`, hallName: hallNames[h], team1: split.t1, team2: split.t2,
            team1Score: 0, team2Score: 0, isPlayed: false,
            subLow: null as any, subHigh: null as any, referee: null as any
          });
        }

        const resting = players.filter(p => !currentUsed.has(p.id)).sort((a,b) => a.rating - b.rating);
        currentMatches.forEach((m, idx) => {
          m.subLow = resting[idx * 3];
          m.subHigh = resting[resting.length - 1 - (idx * 3)];
          m.referee = resting[idx * 3 + 1];
        });

        roundMatches = currentMatches;
        roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => currentUsed.add(p.id))); // Sync
        roundSuccess = true;
        break;
      } catch (e) { continue; }
    }

    if (!roundSuccess) return null;

    roundMatches.forEach(m => [...m.team1, ...m.team2].forEach(p => {
        playedCount.set(p.id, playedCount.get(p.id)! + 1);
        usedThisRound.add(p.id);
    }));

    allRounds.push({ 
        roundNumber: r, 
        matches: roundMatches, 
        restingPlayers: players.filter(p => !usedThisRound.has(p.id)) 
    });
  }

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
  const validSchedules: NKSession[] = [];
  let attempts = 0;

  onProgress("Starten met optimalisatie...");

  while (validSchedules.length < 5 && attempts < 200) {
    attempts++;
    const schedule = await generateSingleSchedule(players, hallNames, matchesPerPlayer, playersPerTeam, competitionName);
    
    if (schedule) {
      validSchedules.push(schedule);
      onProgress(`Toernooi ${validSchedules.length}/5 gevonden...`);
      await delay(10);
    } else {
      if (attempts % 10 === 0) onProgress(`Bezig met berekenen... (Poging ${attempts})`);
      await delay(1);
    }
  }

  if (validSchedules.length === 0) {
    throw new Error("Geen schema gevonden binnen de balans-eisen.");
  }

  // Kies het schema met de laagste social score
  onProgress("Beste mix selecteren...");
  validSchedules.sort((a, b) => calculateSocialScore(a) - calculateSocialScore(b));
  
  return validSchedules[0];
}
