import { Player, NKSession, NKRound, NKMatch } from '../types';

/**
 * Verdeelt spelers in vaste, gebalanceerde teams op basis van rating.
 */
function createBalancedTeams(players: Player[], teamSize: number): Player[][] {
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
  const numTeams = players.length / teamSize;
  const teams: Player[][] = Array.from({ length: numTeams }, () => []);

  // Snake distribution voor balans
  sortedPlayers.forEach((player, index) => {
    const round = Math.floor(index / numTeams);
    const teamIdx = round % 2 === 0 
      ? index % numTeams 
      : (numTeams - 1) - (index % numTeams);
    teams[teamIdx].push(player);
  });

  return teams;
}

/**
 * Genereert een Round Robin schema (Berger-tabellen principe)
 */
export async function generateFixedNKSchedule(
  allPlayers: Player[],
  hallNames: string[],
  ppt: number, // 4 of 5
  competitionName: string,
  manualTimes: { start: string, end: string }[]
): Promise<NKSession> {
  if (allPlayers.length % ppt !== 0) {
    throw new Error(`Aantal spelers (${allPlayers.length}) moet een veelvoud zijn van ${ppt}.`);
  }

  const teams = createBalancedTeams(allPlayers, ppt);
  const numTeams = teams.length;
  const teamIndices = Array.from({ length: numTeams }, (_, i) => i);
  
  // Berger-tabellen logica voor Round Robin
  const schedule: { t1: number, t2: number }[][] = [];
  const tempIndices = [...teamIndices];
  if (numTeams % 2 !== 0) tempIndices.push(-1); // Dummy team voor oneven aantal

  const n = tempIndices.length;
  const roundsCount = n - 1;

  for (let r = 0; r < roundsCount; r++) {
    const roundMatches: { t1: number, t2: number }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const t1 = tempIndices[i];
      const t2 = tempIndices[n - 1 - i];
      if (t1 !== -1 && t2 !== -1) {
        roundMatches.push({ t1, t2 });
      }
    }
    schedule.push(roundMatches);
    // Rotate (laatste index blijft staan, rest schuift door)
    tempIndices.splice(1, 0, tempIndices.pop()!);
  }

  // Verwerken naar NKSession formaat
  const finalRounds: NKRound[] = schedule.map((roundObj, rIdx) => {
    const time = manualTimes[rIdx] || { start: '', end: '' };
    
    // Bij 4 spelers: maximaal (Teams - 2) / 2 wedstrijden per ronde (zodat 2 teams rusten)
    // Bij 5 spelers: maximaal Teams / 2 wedstrijden per ronde
    const maxMatchesThisRound = ppt === 4 
      ? Math.floor((numTeams - 2) / 2) 
      : Math.floor(numTeams / 2);
    
    // Let op: In een echt Round Robin schema bij 4 spelers kan het zijn dat we 
    // wedstrijden over meer rondes moeten uitsmeren om die 2 teams rust te garanderen.
    // Voor nu volgen we het schema en mappen we dit naar de zalen.
    
    const matches: NKMatch[] = roundObj.slice(0, hallNames.length).map((m, mIdx) => ({
      id: `fixed-r${rIdx + 1}-h${mIdx}`,
      hallName: hallNames[mIdx] || '?',
      team1: teams[m.t1],
      team2: teams[m.t2],
      team1Score: 0,
      team2Score: 0,
      isPlayed: false,
      // Geen officials in deze modus
      referee: null as any,
      subHigh: null as any,
      subLow: null as any,
      // Metadata voor de UI
      team1Name: `Team ${m.t1 + 1}`,
      team2Name: `Team ${m.t2 + 1}`
    }));

    return {
      roundNumber: rIdx + 1,
      matches,
      startTime: time.start,
      endTime: time.end
    } as any;
  });

  return {
    competitionName,
    hallNames,
    playersPerTeam: ppt,
    totalRounds: finalRounds.length,
    rounds: finalRounds,
    isCompleted: false,
    // Markeer als vaste teams sessie
    isFixedTeams: true,
    fixedTeams: teams.map((players, i) => ({ id: i, name: `Team ${i + 1}`, players }))
  } as any;
}
