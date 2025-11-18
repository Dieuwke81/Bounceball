import type { Player, Constraint } from '../types';

const ITERATIONS = 200000; // A good balance between performance and quality.

// Helper to check if two team compositions are functionally identical
// It works for any number of teams and ignores player order within teams and the order of teams.
const areTeamCompositionsIdentical = (teamsA: Player[][], teamsB: Player[][]): boolean => {
    if (teamsA.length !== teamsB.length) return false;
    if (teamsA.length === 0) return true;

    // Create a canonical representation for each team (sorted list of player IDs as a string)
    const getCanonicalTeam = (team: Player[]) => JSON.stringify(team.map(p => p.id).sort((a, b) => a - b));

    // Create a frequency map of canonical teams for the first composition
    const mapA = new Map<string, number>();
    for (const team of teamsA) {
        const canonical = getCanonicalTeam(team);
        mapA.set(canonical, (mapA.get(canonical) || 0) + 1);
    }
    
    // Try to match teams from B against the map from A
    for (const team of teamsB) {
        const canonical = getCanonicalTeam(team);
        const countInA = mapA.get(canonical);
        // If a team from B is not found in A, or all occurrences have already been matched
        if (!countInA || countInA === 0) {
            return false;
        }
        mapA.set(canonical, countInA - 1);
    }
    
    // If we get here, all teams in B were successfully matched with teams in A
    return true;
};

// Helper to shuffle an array in-place
const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Helper to check if a composition is valid against constraints
const isCompositionValid = (teams: Player[][], constraints: Constraint[]): boolean => {
  if (constraints.length === 0) return true;

  const playerTeamMap = new Map<number, number>(); // playerId -> teamIndex
  teams.forEach((team, index) => {
    team.forEach(player => {
      playerTeamMap.set(player.id, index);
    });
  });

  for (const constraint of constraints) {
    const [p1Id, p2Id] = constraint.playerIds;
    const team1Index = playerTeamMap.get(p1Id);
    
    if (team1Index === undefined) continue; // Player not in any team, shouldn't happen

    const team2Index = p2Id !== undefined ? playerTeamMap.get(p2Id) : undefined;

    switch (constraint.type) {
      case 'together':
        if (team2Index === undefined || team1Index !== team2Index) return false;
        break;
      case 'apart':
        if (team2Index !== undefined && team1Index === team2Index) return false;
        break;
       case 'versus':
        // 1. Ze mogen niet in hetzelfde team zitten (net als bij 'apart')
        if (team2Index === undefined || team1Index === team2Index) return false;
        
        // 2. Ze moeten in dezelfde wedstrijd zitten (Index 0 vs 1, of 2 vs 3, of 4 vs 5)
        // Door de index door 2 te delen en af te ronden (Math.floor), krijg je het wedstrijdnummer.
        // Als die nummers niet gelijk zijn, spelen ze niet tegen elkaar in de eerste ronde.
        if (Math.floor(team1Index / 2) !== Math.floor(team2Index / 2)) return false;
        break;
      case 'must_be_5':
        if (teams[team1Index].length !== 5) return false;
        break;
    }
  }
  return true;
};

export const generateTeams = async (
  attendingPlayers: Player[],
  numberOfTeams: number,
  constraints: Constraint[] = [],
  excludeComposition: Player[][] | null = null
): Promise<Player[][]> => {
  if (attendingPlayers.length < numberOfTeams || numberOfTeams <= 0) {
    return [];
  }
  
  // This function is computationally intensive but runs locally, so we can wrap it
  // in a promise that resolves on the next tick to prevent UI blocking on call.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
        let bestComposition: Player[][] | null = null;
        let minSpread = Infinity;

        // Determine team sizes for equitable distribution
        const baseTeamSize = Math.floor(attendingPlayers.length / numberOfTeams);
        const teamsWithExtraPlayer = attendingPlayers.length % numberOfTeams;
        const teamSizes = Array(numberOfTeams).fill(baseTeamSize);
        for (let i = 0; i < teamsWithExtraPlayer; i++) {
            teamSizes[i]++;
        }
        const minTeamSize = Math.min(...teamSizes);
const maxTeamSize = Math.max(...teamSizes);

if (minTeamSize < 4 || maxTeamSize > 5) {
  const teamSizesString = [...new Set(teamSizes)].sort().join(' en ');
  const errorMessage = `Met ${attendingPlayers.length} spelers voor ${numberOfTeams} teams, zouden de teams ${teamSizesString} spelers hebben. Dit is niet toegestaan (min. 4, max. 5). Pas het aantal spelers of teams aan.`;
  return reject(new Error(errorMessage));
}
        // Pre-separating keepers and field players doesn't guarantee better balance
        // with random shuffles. Shuffling the whole list gives more combinations.
        // We will validate keeper distribution instead.

        for (let i = 0; i < ITERATIONS; i++) {
          const shuffledPlayers = shuffle([...attendingPlayers]);
          const currentTeams: Player[][] = Array.from({ length: numberOfTeams }, () => []);
          
          // Distribute players into teams according to the calculated sizes
          let playerCursor = 0;
          for (let teamIdx = 0; teamIdx < numberOfTeams; teamIdx++) {
              const currentTeamSize = teamSizes[teamIdx];
              for (let j = 0; j < currentTeamSize; j++) {
                  if (shuffledPlayers[playerCursor]) {
                      currentTeams[teamIdx].push(shuffledPlayers[playerCursor]);
                      playerCursor++;
                  }
              }
          }

          // Validate keeper distribution. The difference in number of keepers between any two teams should not be more than 1.
          const keeperCounts = currentTeams.map(t => t.filter(p => p.isKeeper).length);
          const maxKeepers = Math.max(...keeperCounts);
          const minKeepers = Math.min(...keeperCounts);
          if (maxKeepers - minKeepers > 1) {
            continue; // Skip this iteration due to poor keeper distribution
          }
          
          // Validate against user-defined constraints
          if (!isCompositionValid(currentTeams, constraints)) {
            continue;
          }
          
          // Check if this composition should be excluded
          if (excludeComposition && areTeamCompositionsIdentical(currentTeams, excludeComposition)) {
            continue; // This composition is disallowed, try the next shuffle
          }
          
          // If valid, calculate the spread based on AVERAGE rating
          const teamAverageRatings = currentTeams.map(team => {
            if (team.length === 0) return 0; // Avoid division by zero
            const totalRating = team.reduce((sum, p) => sum + p.rating, 0);
            return totalRating / team.length;
          });

          if (teamAverageRatings.length < 2) continue; // Not enough teams to compare
          
          const maxAvgRating = Math.max(...teamAverageRatings);
          const minAvgRating = Math.min(...teamAverageRatings);
          const spread = maxAvgRating - minAvgRating;

          // If this is the best composition so far, save it
          if (spread < minSpread) {
            minSpread = spread;
            bestComposition = currentTeams;
          }

          // Early exit if a perfect balance is found
          if (minSpread < 0.001) {
            break;
          }
        }

        if (!bestComposition) {
            // This can happen if constraints are impossible to satisfy, or if the only possible composition was the excluded one.
            const errorMessage = (constraints.length > 0 || excludeComposition) 
                ? "Kon geen (nieuwe) teamindeling vinden die aan alle restricties voldoet. Probeer andere restricties, of er is geen alternatieve eerlijke indeling mogelijk."
                : "Interne fout: Kon geen teams genereren. Controleer het aantal spelers.";
            return reject(new Error(errorMessage));
        }
        
        console.log(`Beste teamindeling gevonden met een gem. ratingverschil van ${minSpread.toFixed(3)} na ${ITERATIONS} pogingen.`);
        resolve(bestComposition);
    }, 0);
  });
};
