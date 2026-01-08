import type { Player, Constraint, GameSession, MatchResult } from '../types';

const ITERATIONS = 1000000; // A good balance between performance and quality.

/**
 * Balans is altijd #1.
 * Binnen deze spread-tolerantie kiezen we de indeling die spelers die vaak samen zaten het meest spreidt.
 */
const SPREAD_TOLERANCE = 0.02; 
const MAX_CANDIDATES = 50;     

const areTeamCompositionsIdentical = (teamsA: Player[][], teamsB: Player[][]): boolean => {
  if (teamsA.length !== teamsB.length) return false;
  if (teamsA.length === 0) return true;
  const getCanonicalTeam = (team: Player[]) => JSON.stringify(team.map(p => p.id).sort((a, b) => a - b));
  const mapA = new Map<string, number>();
  for (const team of teamsA) {
    const canonical = getCanonicalTeam(team);
    mapA.set(canonical, (mapA.get(canonical) || 0) + 1);
  }
  for (const team of teamsB) {
    const canonical = getCanonicalTeam(team);
    const countInA = mapA.get(canonical);
    if (!countInA || countInA === 0) return false;
    mapA.set(canonical, countInA - 1);
  }
  return true;
};

const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const isCompositionValid = (teams: Player[][], constraints: Constraint[]): boolean => {
  if (constraints.length === 0) return true;
  const playerTeamMap = new Map<number, number>();
  teams.forEach((team, index) => {
    team.forEach(player => {
      playerTeamMap.set(player.id, index);
    });
  });
  for (const constraint of constraints) {
    const [p1Id, p2Id] = constraint.playerIds;
    const team1Index = playerTeamMap.get(p1Id);
    if (team1Index === undefined) continue;
    const team2Index = p2Id !== undefined ? playerTeamMap.get(p2Id) : undefined;
    switch (constraint.type) {
      case 'together':
        if (team2Index === undefined || team1Index !== team2Index) return false;
        break;
      case 'apart':
        if (team2Index !== undefined && team1Index === team2Index) return false;
        break;
      case 'versus':
        if (team2Index === undefined || team1Index === team2Index) return false;
        if (Math.floor(team1Index / 2) !== Math.floor(team2Index / 2)) return false;
        break;
      case 'must_be_5':
        if (teams[team1Index].length !== 5) return false;
        break;
    }
  }
  return true;
};

type PairKey = string;
const makePairKey = (a: number, b: number): PairKey => {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
};

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
    const teamA = teamsForRound[match.team1Index] || [];
    const teamB = teamsForRound[match.team2Index] || [];
    addPairsFromTeam(teamA);
    addPairsFromTeam(teamB);
  };
  for (const session of seasonHistory) {
    const r1Teams = session.teams || [];
    (session.round1Results || []).forEach((m) => addPairsFromMatch(r1Teams, m));
    const r2Teams = session.round2Teams ?? session.teams ?? [];
    (session.round2Results || []).forEach((m) => addPairsFromMatch(r2Teams, m));
  }
  return map;
};

const calculateTogetherPenalty = (teams: Player[][], pairCounts: Map<PairKey, number>): number => {
  if (pairCounts.size === 0) return 0;
  let penalty = 0;
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = makePairKey(team[i].id, team[j].id);
        const c = pairCounts.get(key) || 0;
        // ✅ Penalty zwaarder: Kwadraat
        penalty += (c * c);
      }
    }
  }
  return penalty;
};

export const generateTeams = async (
  attendingPlayers: Player[],
  numberOfTeams: number,
  constraints: Constraint[] = [],
  excludeComposition: Player[][] | null = null,
  seasonHistory?: GameSession[]
): Promise<Player[][]> => {
  if (attendingPlayers.length < numberOfTeams || numberOfTeams <= 0) return [];
  const seasonPairCounts = buildSeasonPairCounts(seasonHistory);

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let minSpread = Infinity;
      let candidates: { teams: Player[][]; spread: number; penalty: number }[] = [];
      const baseTeamSize = Math.floor(attendingPlayers.length / numberOfTeams);
      const teamsWithExtraPlayer = attendingPlayers.length % numberOfTeams;
      const teamSizes = Array(numberOfTeams).fill(baseTeamSize);
      for (let i = 0; i < teamsWithExtraPlayer; i++) teamSizes[i]++;
      const minTeamSize = Math.min(...teamSizes);
      const maxTeamSize = Math.max(...teamSizes);

      if (minTeamSize < 4 || maxTeamSize > 5) {
        const teamSizesString = [...new Set(teamSizes)].sort().join(' en ');
        return reject(new Error(`Teams zouden ${teamSizesString} spelers hebben. Dit mag niet (min. 4, max. 5).`));
      }

      for (let i = 0; i < ITERATIONS; i++) {
        const shuffledPlayers = shuffle([...attendingPlayers]);
        const currentTeams: Player[][] = Array.from({ length: numberOfTeams }, () => []);
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
        const keeperCounts = currentTeams.map(t => t.filter(p => p.isKeeper).length);
        if (Math.max(...keeperCounts) - Math.min(...keeperCounts) > 1) continue;
        if (!isCompositionValid(currentTeams, constraints)) continue;
        if (excludeComposition && areTeamCompositionsIdentical(currentTeams, excludeComposition)) continue;

        const teamAverageRatings = currentTeams.map(team => {
          if (team.length === 0) return 0;
          return team.reduce((sum, p) => sum + p.rating, 0) / team.length;
        });
        const spread = Math.max(...teamAverageRatings) - Math.min(...teamAverageRatings);

        if (spread < minSpread - 1e-9) {
          minSpread = spread;
          const penalty = calculateTogetherPenalty(currentTeams, seasonPairCounts);
          candidates = [{ teams: currentTeams, spread, penalty }];
        } else if (spread <= minSpread + SPREAD_TOLERANCE) {
          const penalty = calculateTogetherPenalty(currentTeams, seasonPairCounts);
          candidates.push({ teams: currentTeams, spread, penalty });
          if (candidates.length > MAX_CANDIDATES) {
            candidates.sort((a, b) => a.spread - b.spread || a.penalty - b.penalty);
            candidates = candidates.slice(0, MAX_CANDIDATES);
          }
        }
        if (minSpread < 0.001 && candidates.length >= 10) break;
      }

      if (!candidates.length) return reject(new Error('Kon geen geldige teamindeling vinden.'));
      candidates.sort((a, b) => a.spread - b.spread || a.penalty - b.penalty);
      resolve(candidates[0].teams);
    }, 0);
  });
};
