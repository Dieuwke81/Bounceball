
import type { Player, Constraint, GameSession, MatchResult } from '../types';

const ITERATIONS = 1000000; // A good balance between performance and quality.

/**
 * Balans is altijd #1.
 * Binnen deze spread-tolerantie kiezen we de indeling die spelers die vaak samen zaten het meest spreidt.
 * (Klein houden = balans blijft leidend)
 */
const SPREAD_TOLERANCE = 0.02; // 0.02 rating verschil tolerantie (tweakbaar)
const MAX_CANDIDATES = 50;     // cap om memory onder controle te houden

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
        if (Math.floor(team1Index / 2) !== Math.floor(team2Index / 2)) return false;
        break;
      case 'must_be_5':
        if (teams[team1Index].length !== 5) return false;
        break;
    }
  }
  return true;
};

// ---------- NEW: season "played together" penalty helpers ----------

type PairKey = string; // "minId-maxId"

const makePairKey = (a: number, b: number): PairKey => {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
};

/**
 * Bouwt een map: "id1-id2" -> count
 * count = hoe vaak twee spelers samen in hetzelfde team hebben gezeten in de meegegeven seasonHistory
 *
 * Belangrijk: we kijken per match (ronde 1 en ronde 2), en gebruiken:
 * - ronde 1 teams: session.teams
 * - ronde 2 teams: session.round2Teams ?? session.teams
 */
const buildSeasonPairCounts = (seasonHistory?: GameSession[]): Map<PairKey, number> => {
  const map = new Map<PairKey, number>();
  if (!seasonHistory || seasonHistory.length === 0) return map;

  const addPairsFromTeam = (team: Player[]) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = makePairKey(team[i].id, team[j].id);
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
  };

  const addPairsFromMatch = (teamsForThatRound: Player[][], match: MatchResult) => {
    const teamA = teamsForThatRound[match.team1Index] || [];
    const teamB = teamsForThatRound[match.team2Index] || [];
    addPairsFromTeam(teamA);
    addPairsFromTeam(teamB);
  };

  for (const session of seasonHistory) {
    // Ronde 1
    const r1Teams = session.teams || [];
    (session.round1Results || []).forEach((m) => addPairsFromMatch(r1Teams, m));

    // Ronde 2
    const r2Teams = session.round2Teams ?? session.teams ?? [];
    (session.round2Results || []).forEach((m) => addPairsFromMatch(r2Teams, m));
  }

  return map;
};

/**
 * Penalty voor een candidate composition:
 * hoe hoger, hoe meer "vaak samen" duo's weer bij elkaar zitten.
 *
 * We doen:
 *  sum over all pairs in each team: pairCount
 *
 * Je kunt dit agressiever maken door te kwadrateren (pairCount^2),
 * maar ik laat 'm lineair zodat balans echt leidend blijft.
 */
const calculateTogetherPenalty = (teams: Player[][], pairCounts: Map<PairKey, number>): number => {
  if (pairCounts.size === 0) return 0;

  let penalty = 0;
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = makePairKey(team[i].id, team[j].id);
        const c = pairCounts.get(key) || 0;
        penalty += c;
      }
    }
  }
  return penalty;
};

// ---------- generator ----------

export const generateTeams = async (
  attendingPlayers: Player[],
  numberOfTeams: number,
  constraints: Constraint[] = [],
  excludeComposition: Player[][] | null = null,

  /**
   * NIEUW (optioneel): seizoen history om "vaak samen" te spreiden.
   * Als je dit niet meegeeft, werkt alles exact zoals eerst.
   */
  seasonHistory?: GameSession[]
): Promise<Player[][]> => {
  if (attendingPlayers.length < numberOfTeams || numberOfTeams <= 0) {
    return [];
  }

  // Precompute season pair counts (cheap once, then reused)
  const seasonPairCounts = buildSeasonPairCounts(seasonHistory);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let minSpread = Infinity;

      // We bewaren meerdere "bijna even goede" kandidaten op spread,
      // en kiezen daaruit de laagste together-penalty (balans blijft #1).
      let candidates: { teams: Player[][]; spread: number; penalty: number }[] = [];

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

        // Validate keeper distribution understanding.
        const keeperCounts = currentTeams.map(t => t.filter(p => p.isKeeper).length);
        const maxKeepers = Math.max(...keeperCounts);
        const minKeepers = Math.min(...keeperCounts);
        if (maxKeepers - minKeepers > 1) continue;

        // Validate constraints
        if (!isCompositionValid(currentTeams, constraints)) continue;

        // Exclude composition if needed
        if (excludeComposition && areTeamCompositionsIdentical(currentTeams, excludeComposition)) continue;

        // Spread based on AVERAGE rating
        const teamAverageRatings = currentTeams.map(team => {
          if (team.length === 0) return 0;
          const totalRating = team.reduce((sum, p) => sum + p.rating, 0);
          return totalRating / team.length;
        });
        if (teamAverageRatings.length < 2) continue;

        const maxAvgRating = Math.max(...teamAverageRatings);
        const minAvgRating = Math.min(...teamAverageRatings);
        const spread = maxAvgRating - minAvgRating;

        // If this composition is better spread-wise, reset candidates
        if (spread < minSpread - 1e-9) {
          minSpread = spread;
          const penalty = calculateTogetherPenalty(currentTeams, seasonPairCounts);
          candidates = [{ teams: currentTeams, spread, penalty }];
        } else if (spread <= minSpread + SPREAD_TOLERANCE) {
          // Similar spread: keep as candidate, choose later on penalty
          const penalty = calculateTogetherPenalty(currentTeams, seasonPairCounts);
          candidates.push({ teams: currentTeams, spread, penalty });

          // Cap candidates to avoid growth; keep best penalties among close spreads
          if (candidates.length > MAX_CANDIDATES) {
            candidates.sort((a, b) => {
              // primary: spread (lower better), secondary: penalty (lower better)
              return a.spread - b.spread || a.penalty - b.penalty;
            });
            candidates = candidates.slice(0, MAX_CANDIDATES);
          }
        }

        // Early exit: if spread is practically perfect AND we have enough candidates, stop early.
        if (minSpread < 0.001 && candidates.length >= 10) {
          break;
        }
      }

      if (!candidates.length) {
        const errorMessage =
          (constraints.length > 0 || excludeComposition)
            ? 'Kon geen (nieuwe) teamindeling vinden die aan alle restricties voldoet. Probeer andere restricties, of er is geen alternatieve eerlijke indeling mogelijk.'
            : 'Interne fout: Kon geen teams genereren. Controleer het aantal spelers.';
        return reject(new Error(errorMessage));
      }

      // Choose the best candidate:
      // 1) minimal spread
      // 2) minimal penalty
      candidates.sort((a, b) => a.spread - b.spread || a.penalty - b.penalty);
      const best = candidates[0];

      console.log(
        `Beste teamindeling: spread=${best.spread.toFixed(3)}, penalty=${best.penalty} (kandidaten=${candidates.length}) na ${ITERATIONS} pogingen.`
      );

      resolve(best.teams);
    }, 0);
  });
};
