import { Player, NKSession, NKRound, NKMatch } from '../types';

/**
 * Berekent het verschil tussen het team met de hoogste en laagste gemiddelde rating.
 */
function getSpread(teams: Player[][]): number {
  const avgs = teams.map(t => t.reduce((s, p) => s + p.rating, 0) / t.length);
  return Math.max(...avgs) - Math.min(...avgs);
}

/**
 * Controleert of de keepers evenredig zijn verdeeld (maximaal 1 verschil).
 */
function areKeepersBalanced(teams: Player[][]): boolean {
  const counts = teams.map(t => t.filter(p => p.isKeeper).length);
  return (Math.max(...counts) - Math.min(...counts)) <= 1;
}

/**
 * Zoekt de allerbeste teamindeling uit 10.000 willekeurige pogingen.
 */
function generateBestRandomTeams(players: Player[], teamSize: number): Player[][] {
  let bestTeams: Player[][] | null = null;
  let minSpread = Infinity;
  const numTeams = players.length / teamSize;

  for (let i = 0; i < 10000; i++) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const candidateTeams: Player[][] = [];
    
    for (let t = 0; t < numTeams; t++) {
      candidateTeams.push(shuffled.slice(t * teamSize, (t + 1) * teamSize));
    }

    if (areKeepersBalanced(candidateTeams)) {
      const spread = getSpread(candidateTeams);
      if (spread < minSpread) {
        minSpread = spread;
        bestTeams = candidateTeams;
      }
    }
  }

  if (!bestTeams) throw new Error("Kon geen indeling vinden met gebalanceerde keepers.");
  return bestTeams;
}

export async function generateFixedNKSchedule(
  allPlayers: Player[],
  hallNames: string[],
  ppt: number,
  competitionName: string,
  manualTimes: { start: string, end: string }[]
): Promise<NKSession> {
  if (allPlayers.length % ppt !== 0) {
    throw new Error(`Aantal spelers (${allPlayers.length}) moet een veelvoud zijn van ${ppt}.`);
  }

  // 1. Maak de beste teams (Best of 10.000)
  const teams = generateBestRandomTeams(allPlayers, ppt);
  const numTeams = teams.length;
  const teamIndices = Array.from({ length: numTeams }, (_, i) => i);
  
  // 2. Round Robin (Berger-tabel) pairings maken
  const bergerRounds: { t1: number, t2: number }[][] = [];
  const tempIndices = [...teamIndices];
  if (numTeams % 2 !== 0) tempIndices.push(-1); // Dummy voor oneven

  const n = tempIndices.length;
  const totalBergerRounds = n - 1;

  for (let r = 0; r < totalBergerRounds; r++) {
    const roundMatches: { t1: number, t2: number }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const t1 = tempIndices[i];
      const t2 = tempIndices[n - 1 - i];
      if (t1 !== -1 && t2 !== -1) roundMatches.push({ t1, t2 });
    }
    bergerRounds.push(roundMatches);
    tempIndices.splice(1, 0, tempIndices.pop()!);
  }

  // 3. Omzetten naar Rounds (rekening houdend met de rust-regel voor 4-per-team)
  // Bij 4-per-team mogen max (numTeams - 2) / 2 wedstrijden tegelijk per ronde.
  const finalRounds: NKRound[] = [];
  let roundNumber = 1;
  const matchesPerRoundLimit = ppt === 4 ? Math.floor((numTeams - 2) / 2) : hallNames.length;

  // We lopen door de Berger-rondes en verdelen de wedstrijden indien nodig over meer fysieke rondes
  bergerRounds.forEach((roundPairings) => {
    let pairingsLeft = [...roundPairings];
    
    while (pairingsLeft.length > 0) {
      const currentBatch = pairingsLeft.splice(0, matchesPerRoundLimit);
      const time = manualTimes[roundNumber - 1] || { start: '', end: '' };
      
      const matches: NKMatch[] = currentBatch.map((m, mIdx) => ({
        id: `fixed-r${roundNumber}-h${mIdx}`,
        hallName: hallNames[mIdx % hallNames.length] || '?',
        team1: teams[m.t1],
        team2: teams[m.t2],
        team1Score: 0,
        team2Score: 0,
        isPlayed: false,
        referee: null as any,
        subHigh: null as any,
        subLow: null as any,
        team1Name: `Team ${m.t1 + 1}`,
        team2Name: `Team ${m.t2 + 1}`
      }));

      finalRounds.push({
        roundNumber: roundNumber++,
        matches,
        startTime: time.start,
        endTime: time.end
      } as any);
    }
  });

  return {
    competitionName,
    hallNames,
    playersPerTeam: ppt,
    totalRounds: finalRounds.length,
    rounds: finalRounds,
    isCompleted: false,
    isFixedTeams: true,
    fixedTeams: teams.map((players, i) => ({ 
        id: i, 
        name: `Team ${i + 1}`, 
        players,
        avgRating: players.reduce((s, p) => s + p.rating, 0) / players.length 
    }))
  } as any;
}
