// App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Player,
  Match,
  MatchResult,
  Goal,
  GameSession,
  NewPlayer,
  Constraint,
  RatingLogEntry,
  Trophy,
} from './types';

import Header from './components/Header';
import PlayerList from './components/PlayerList';
import TeamDisplay from './components/TeamDisplay';
import PlayerManagement from './components/PlayerManagement';
import { generateTeams } from './services/teamGenerator';
import AttendanceParser from './components/AttendanceParser';
import TeamConstraints from './components/TeamConstraints';
import Statistics from './components/Statistics';
import HistoryView from './components/HistoryView';
import PlayerDetail from './components/PlayerDetail';
import ManualEntry from './components/ManualEntry';
import CompetitionManagement from './components/CompetitionManagement';
import TrophyRoom from './components/TrophyRoom';
import NKManager from './components/NKManager'; // Toegevoegd

import {
  getInitialData,
  saveGameSession,
  addPlayer,
  updatePlayer,
  deletePlayer,
  setCompetitionName as setCompetitionNameService,
  addTrophy,
  deleteTrophy,
} from './services/googleSheetService';

import TrophyIcon from './components/icons/TrophyIcon';
import UsersIcon from './components/icons/UsersIcon';
import ClockIcon from './components/icons/ClockIcon';
import EditIcon from './components/icons/EditIcon';
import ArchiveIcon from './components/icons/ArchiveIcon';
import LoginScreen from './components/LoginScreen';
import LockIcon from './components/icons/LockIcon';
import FutbolIcon from './components/icons/FutbolIcon';
import SetupGuide from './components/SetupGuide';

// NIEUW
import Rules from './components/Rules';
import BookOpenIcon from './components/icons/BookOpenIcon';

type View =
  | 'main'
  | 'rules'
  | 'stats'
  | 'history'
  | 'playerManagement'
  | 'playerDetail'
  | 'manualEntry'
  | 'competitionManagement'
  | 'trophyRoom'
  | 'nk'; // Toegevoegd

type Notification = { message: string; type: 'success' | 'error' };
type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

const ADMIN_PASSWORD = 'kemmer';
const UNSAVED_GAME_KEY = 'bounceball_unsaved_game';

// ============================================================================
// Helpers: constraints + keepers validation (kopie-light van teamGenerator)
// ============================================================================

const areTeamCompositionsIdentical = (teamsA: Player[][], teamsB: Player[][]): boolean => {
  if (teamsA.length !== teamsB.length) return false;
  if (teamsA.length === 0) return true;

  const getCanonicalTeam = (team: Player[]) =>
    JSON.stringify(team.map((p) => p.id).sort((a, b) => a - b));

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

const isCompositionValid = (teams: Player[][], constraints: Constraint[]): boolean => {
  if (!constraints || constraints.length === 0) return true;

  const playerTeamMap = new Map<number, number>();
  teams.forEach((team, index) => {
    team.forEach((player) => playerTeamMap.set(player.id, index));
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
      default:
        break;
    }
  }

  return true;
};

const hasValidKeeperDistribution = (teams: Player[][]) => {
  const keeperCounts = teams.map((t) => t.filter((p) => p.isKeeper).length);
  const maxKeepers = Math.max(...keeperCounts);
  const minKeepers = Math.min(...keeperCounts);
  return maxKeepers - minKeepers <= 1;
};

const calcTeamAvg = (team: Player[]) => {
  if (!team.length) return 0;
  const total = team.reduce((s, p) => s + p.rating, 0);
  return total / team.length;
};

const calcSpread = (teams: Player[][]) => {
  const avgs = teams.map(calcTeamAvg);
  if (avgs.length < 2) return 0;
  return Math.max(...avgs) - Math.min(...avgs);
};

// ============================================================================
// Season: samen gespeeld (pair frequency) + top6 op punten (met tiebreaks)
// ============================================================================

type PairKey = string; // "min-max"

const pairKey = (a: number, b: number): PairKey => (a < b ? `${a}-${b}` : `${b}-${a}`);

const computeSeasonPairCounts = (seasonHistory: GameSession[]) => {
  const counts = new Map<PairKey, number>();

  const addPairsFromTeam = (team: Player[]) => {
    const ids = team.map((p) => p.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  };

  for (const session of seasonHistory) {
    for (const match of session.round1Results || []) {
      const t1 = session.teams?.[match.team1Index] || [];
      const t2 = session.teams?.[match.team2Index] || [];
      addPairsFromTeam(t1);
      addPairsFromTeam(t2);
    }
    const teamsR2 = session.round2Teams ?? session.teams;
    for (const match of session.round2Results || []) {
      const t1 = teamsR2?.[match.team1Index] || [];
      const t2 = teamsR2?.[match.team2Index] || [];
      addPairsFromTeam(t1);
      addPairsFromTeam(t2);
    }
  }

  return counts;
};

type PlayerStanding = { pts: number; gf: number; gd: number };

const computeSeasonStandingsByPlayer = (seasonHistory: GameSession[]) => {
  const table = new Map<number, PlayerStanding>();
  const ensure = (id: number) => {
    if (!table.has(id)) table.set(id, { pts: 0, gf: 0, gd: 0 });
    return table.get(id)!;
  };
  const applyMatch = (teamsForRound: Player[][] | undefined, match: MatchResult) => {
    const t1 = teamsForRound?.[match.team1Index] || [];
    const t2 = teamsForRound?.[match.team2Index] || [];
    const s1 = (match.team1Goals || []).reduce((sum, g) => sum + g.count, 0);
    const s2 = (match.team2Goals || []).reduce((sum, g) => sum + g.count, 0);
    t1.forEach((p) => {
      const row = ensure(p.id);
      row.gf += s1;
      row.gd += s1 - s2;
    });
    t2.forEach((p) => {
      const row = ensure(p.id);
      row.gf += s2;
      row.gd += s2 - s1;
    });
    if (s1 > s2) {
      t1.forEach((p) => (ensure(p.id).pts += 3));
    } else if (s2 > s1) {
      t2.forEach((p) => (ensure(p.id).pts += 3));
    } else {
      t1.forEach((p) => (ensure(p.id).pts += 1));
      t2.forEach((p) => (ensure(p.id).pts += 1));
    }
  };
  for (const session of seasonHistory) {
    for (const match of session.round1Results || []) applyMatch(session.teams, match);
    const teamsR2 = session.round2Teams ?? session.teams;
    for (const match of session.round2Results || []) applyMatch(teamsR2, match);
  }
  return table;
};

// ============================================================================
// Preferences optimizer (soft)
// ============================================================================

const optimizeTeamsSoft = (params: {
  teams: Player[][];
  constraints: Constraint[];
  attendingIds: Set<number>;
  seasonPairCounts: Map<PairKey, number>;
  separateFrequent: boolean;
  separateTop6: boolean;
  top6Ids: Set<number>;
}) => {
  const { teams, constraints, attendingIds, seasonPairCounts, separateFrequent, separateTop6, top6Ids } = params;
  if (!separateFrequent && !separateTop6) return teams;
  const baseSpread = calcSpread(teams);
  const SPREAD_TOLERANCE = 0.01;
  const cloneTeams = (t: Player[][]) => t.map((team) => [...team]);
  const penalty = (t: Player[][]) => {
    let pen = 0;
    for (const team of t) {
      const ids = team.map((p) => p.id).filter((id) => attendingIds.has(id));
      if (separateFrequent) {
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const count = seasonPairCounts.get(pairKey(ids[i], ids[j])) || 0;
            pen += (count * count) * 10;
          }
        }
      }
      if (separateTop6) {
        const topCount = ids.reduce((s, id) => s + (top6Ids.has(id) ? 1 : 0), 0);
        if (topCount >= 2) pen += (topCount - 1) * (topCount - 1) * 50;
      }
    }
    return pen;
  };
  let best = cloneTeams(teams);
  let bestSpread = baseSpread;
  let bestPenalty = penalty(best);
  if (bestPenalty === 0) return best;
  const teamCount = best.length;
  if (teamCount < 2) return best;
  const teamSizes = best.map((t) => t.length);
  const maxIters = 50000;
  const randomInt = (max: number) => Math.floor(Math.random() * max);
  for (let iter = 0; iter < maxIters; iter++) {
    const a = randomInt(teamCount);
    let b = randomInt(teamCount);
    if (b === a) b = (b + 1) % teamCount;
    if (teamSizes[a] === 0 || teamSizes[b] === 0) continue;
    const ia = randomInt(teamSizes[a]);
    const ib = randomInt(teamSizes[b]);
    const cand = cloneTeams(best);
    const pa = cand[a][ia];
    const pb = cand[b][ib];
    cand[a][ia] = pb;
    cand[b][ib] = pa;
    if (!hasValidKeeperDistribution(cand)) continue;
    if (!isCompositionValid(cand, constraints)) continue;
    const candSpread = calcSpread(cand);
    if (candSpread > baseSpread + SPREAD_TOLERANCE) continue;
    const candPenalty = penalty(cand);
    const spreadBetter = candSpread < bestSpread - 1e-6;
    const spreadSameEnough = Math.abs(candSpread - bestSpread) <= 1e-6;
    if (spreadBetter || (spreadSameEnough && candPenalty < bestPenalty)) {
      best = cand;
      bestSpread = candSpread;
      bestPenalty = candPenalty;
      if (bestPenalty === 0) break;
    }
  }
  return best;
};

const syncRatingsBetweenOpponents = (teams: Player[][]): Player[][] => {
  const result = [...teams.map((t) => [...t])];
  for (let i = 0; i < result.length; i += 2) {
    if (!result[i + 1]) break;
    const teamA = result[i];
    const teamB = result[i + 1];
    const keepersA = teamA.filter(p => p.isKeeper);
    const othersA = teamA.filter(p => !p.isKeeper);
    const keepersB = teamB.filter(p => p.isKeeper);
    const othersB = teamB.filter(p => !p.isKeeper);
    const slots: { a: Player | null, b: Player | null }[] = [];
    const numKeeperPairs = Math.min(keepersA.length, keepersB.length);
    for (let k = 0; k < numKeeperPairs; k++) {
      slots.push({ a: keepersA.shift()!, b: keepersB.shift()! });
    }
    const remainingA = [...keepersA, ...othersA].sort((a, b) => b.rating - a.rating);
    const remainingB = [...keepersB, ...othersB].sort((a, b) => b.rating - a.rating);
    const maxRemaining = Math.max(remainingA.length, remainingB.length);
    for (let r = 0; r < maxRemaining; r++) {
      slots.push({ a: remainingA[r] || null, b: remainingB[r] || null });
    }
    for (let j = slots.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [slots[j], slots[k]] = [slots[k], slots[j]];
    }
    result[i] = slots.map(s => s.a).filter((p): p is Player => p !== null);
    result[i + 1] = slots.map(s => s.b).filter((p): p is Player => p !== null);
  }
  return result;
};

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [introPlayers, setIntroPlayers] = useState<Player[]>([]); // ✅ NIEUW
  const [history, setHistory] = useState<GameSession[]>([]);
  const [ratingLogs, setRatingLogs] = useState<RatingLogEntry[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [attendingPlayerIds, setAttendingPlayerIds] = useState<Set<number>>(new Set());
  const [teams, setTeams] = useState<Player[][]>([]);
  const [originalTeams, setOriginalTeams] = useState<Player[][] | null>(null);
  const [teams2, setTeams2] = useState<Player[][] | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [round1Results, setRound1Results] = useState<MatchResult[]>([]);
  const [round2Pairings, setRound2Pairings] = useState<Match[]>([]);
  const [goalScorers, setGoalScorers] = useState<{ [key: string]: Goal[] }>({});
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('main');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [viewingArchive, setViewingArchive] = useState<GameSession[] | null>(null);
  const [isManagementAuthenticated, setIsManagementAuthenticated] = useState(false);
  const [competitionName, setCompetitionName] = useState<string | null>(null);
  const [seasonStartDate, setSeasonStartDate] = useState<string>('');

  const [separateFrequentTeammates, setSeparateFrequentTeammates] = useState<boolean>(false);
  const [separateTop6OnPoints, setSeparateTop6OnPoints] = useState<boolean>(false);
  const [showFrequentPairs, setShowFrequentPairs] = useState<boolean>(true);
  const [syncOpponentRatings, setSyncOpponentRatings] = useState<boolean>(false);

  useEffect(() => {
    if (gameMode) {
      const stateToSave = {
        attendingPlayerIds: Array.from(attendingPlayerIds),
        teams, originalTeams, teams2, currentRound, round1Results, round2Pairings, goalScorers, gameMode, constraints, separateFrequentTeammates, separateTop6OnPoints, showFrequentPairs, syncOpponentRatings,
      };
      localStorage.setItem(UNSAVED_GAME_KEY, JSON.stringify(stateToSave));
    }
  }, [attendingPlayerIds, teams, originalTeams, teams2, currentRound, round1Results, round2Pairings, goalScorers, gameMode, constraints, separateFrequentTeammates, separateTop6OnPoints, showFrequentPairs, syncOpponentRatings]);

  useEffect(() => {
    const savedGameJSON = localStorage.getItem(UNSAVED_GAME_KEY);
    if (savedGameJSON) {
      try {
        const savedGame = JSON.parse(savedGameJSON);
        if (window.confirm('Er is een niet-opgeslagen wedstrijd gevonden. Wil je doorgaan?')) {
          setAttendingPlayerIds(new Set(savedGame.attendingPlayerIds || []));
          setTeams(savedGame.teams || []);
          setOriginalTeams(savedGame.originalTeams || null);
          setTeams2(savedGame.teams2 || null);
          setCurrentRound(savedGame.currentRound || 0);
          setRound1Results(savedGame.round1Results || []);
          setRound2Pairings(savedGame.round2Pairings || []);
          setGoalScorers(savedGame.goalScorers || {});
          setGameMode(savedGame.gameMode || null);
          setConstraints(savedGame.constraints || []);
          setSeparateFrequentTeammates(!!savedGame.separateFrequentTeammates);
          setSeparateTop6OnPoints(!!savedGame.separateTop6OnPoints);
          setShowFrequentPairs(savedGame.showFrequentPairs !== false);
          setSyncOpponentRatings(!!savedGame.syncOpponentRatings);
        } else {
          localStorage.removeItem(UNSAVED_GAME_KEY);
        }
      } catch (e) {
        localStorage.removeItem(UNSAVED_GAME_KEY);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getInitialData();
      setSeasonStartDate(data.seasonStartDate || '');
      setPlayers(data.players);
      setIntroPlayers(data.introPlayers || []); // ✅ NIEUW: Introductie spelers laden
      setHistory(data.history);
      setCompetitionName(data.competitionName || null);
      setRatingLogs(data.ratingLogs || []);
      setTrophies(data.trophies || []);
    } catch (e: any) {
      setError(e.message || 'Fout bij laden gegevens.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
  };

  const handlePlayerToggle = (playerId: number) => {
    setAttendingPlayerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) newSet.delete(playerId);
      else newSet.add(playerId);
      return newSet;
    });
  };

  const handleParseAttendance = (text: string) => {
    const normalize = (str: string): string => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\.$/, '');
    const lines = text.split('\n');
    const potentialNames = new Set<string>();
    const monthNames = ['feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const nonNameIndicators = ['afgemeld', 'gemeld', 'ja', 'nee', 'ok', 'jup', 'aanwezig', 'present', 'ik ben er', 'ik kan', 'helaas', 'ik ben erbij', 'twijfel', 'later', 'keepen', 'keeper', 'reserve', 'niet', 'graag', 'team'];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      const lowerLine = trimmedLine.toLowerCase();
      if (nonNameIndicators.some((word) => lowerLine.includes(word)) && lowerLine.length > 20) return;
      if (monthNames.some((month) => lowerLine.includes(month)) && (lowerLine.match(/\d/g) || []).length > 1) return;
      let cleaned = trimmedLine.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').replace(/\[.*?\]/, '').replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].replace(/[\(\[].*?[\)\]]/g, '').trim();
      if (cleaned && cleaned.length > 1 && /[a-zA-Z]/.test(cleaned) && cleaned.length < 30) potentialNames.add(cleaned);
    });

    if (potentialNames.size === 0) {
      showNotification('Geen geldige namen gevonden.', 'error');
      return;
    }

    const playerLookup = new Map<string, Player>();
    players.forEach((player) => {
      const normalizedFullName = normalize(player.name);
      const normalizedFirstName = normalizedFullName.split(' ')[0];
      playerLookup.set(normalizedFullName, player);
      if (!playerLookup.has(normalizedFirstName)) playerLookup.set(normalizedFirstName, player);
    });

    const newAttendingPlayerIds = new Set(attendingPlayerIds);
    potentialNames.forEach((originalName) => {
      const normalizedName = normalize(originalName);
      const matchedPlayer = playerLookup.get(normalizedName) || playerLookup.get(normalizedName.split(' ')[0]);
      if (matchedPlayer) newAttendingPlayerIds.add(matchedPlayer.id);
    });
    setAttendingPlayerIds(newAttendingPlayerIds);
  };

  const attendingPlayers = useMemo(() => players.filter((p) => attendingPlayerIds.has(p.id)), [players, attendingPlayerIds]);
  const activeHistory = viewingArchive || history;
  const seasonPairCounts = useMemo(() => computeSeasonPairCounts(activeHistory), [activeHistory]);

  const top6Ids = useMemo(() => {
    const attendingSet = new Set(attendingPlayers.map((p) => p.id));
    const standings = computeSeasonStandingsByPlayer(activeHistory);
    const sorted = [...attendingSet].map((id) => {
        const row = standings.get(id) || { pts: 0, gf: 0, gd: 0 };
        return { id, ...row };
      }).sort((a, b) => b.pts - a.pts || b.gf - a.gf || b.gd - a.gd || a.id - b.id).slice(0, 6).map((x) => x.id);
    return new Set<number>(sorted);
  }, [activeHistory, attendingPlayers]);

  const handleGenerateTeams = async (mode: GameMode) => {
    resetGameState();
    setGameMode(mode);
    const playerCount = attendingPlayers.length;
    let numberOfTeams = mode === 'simple' || mode === 'doubleHeader' ? 2 : (playerCount >= 24 ? 6 : (playerCount >= 16 ? 4 : 2));
    if (attendingPlayers.length < numberOfTeams) { showNotification(`Niet genoeg spelers voor ${numberOfTeams} teams.`, 'error'); return; }
    setActionInProgress('generating');
    try {
      let generated = await generateTeams(attendingPlayers, numberOfTeams, constraints, null, activeHistory);
      if (separateFrequentTeammates || separateTop6OnPoints) {
        generated = optimizeTeamsSoft({ teams: generated, constraints, attendingIds: new Set(attendingPlayers.map(p=>p.id)), seasonPairCounts, separateFrequent: separateFrequentTeammates, separateTop6: separateTop6OnPoints, top6Ids });
      }
      if (syncOpponentRatings) generated = syncRatingsBetweenOpponents(generated);
      setTeams(generated);
      setOriginalTeams(JSON.parse(JSON.stringify(generated)));
      setCurrentRound(1);
    } catch (e: any) {
      showNotification(e.message, 'error');
      resetGameState();
    } finally { setActionInProgress(null); }
  };

  const handleGoalChange = (matchIndex: number, teamIdentifier: 'team1' | 'team2', playerId: number, count: number) => {
    const key = `${matchIndex}-${teamIdentifier}`;
    setGoalScorers((prev) => {
      const newGoals = [...(prev[key] || [])];
      const existingGoalIndex = newGoals.findIndex((g) => g.playerId === playerId);
      if (count > 0) {
        if (existingGoalIndex > -1) newGoals[existingGoalIndex] = { ...newGoals[existingGoalIndex], count };
        else newGoals.push({ playerId, count });
      } else if (existingGoalIndex > -1) newGoals.splice(existingGoalIndex, 1);
      return { ...prev, [key]: newGoals };
    });
  };

  const handleSaveSession = async (sessionData: GameSession) => {
    const ratingChanges = calculateRatingDeltas({ teams: sessionData.teams, round1Results: sessionData.round1Results, round2Results: sessionData.round2Results, round2Teams: sessionData.round2Teams });
    const updatedRatings = players.filter((p) => ratingChanges[p.id] !== undefined).map((p) => ({ id: p.id, rating: parseFloat((p.rating + ratingChanges[p.id]).toFixed(2)) }));
    try {
      await saveGameSession(sessionData, updatedRatings);
      showNotification('Opgeslagen!', 'success');
      setPlayers((prev) => prev.map((p) => { const update = updatedRatings.find((u) => u.id === p.id); return update ? { ...p, rating: update.rating } : p; }));
      setHistory((prev) => [sessionData, ...prev]);
      resetGameState();
      setAttendingPlayerIds(new Set());
    } catch (e: any) { showNotification(`Fout: ${e.message}`, 'error'); }
  };

  const handleSaveRound1 = (matches: Match[]) => {
    const results: MatchResult[] = matches.map((match, index) => ({ ...match, team1Goals: goalScorers[`${index}-team1`] || [], team2Goals: goalScorers[`${index}-team2`] || [] }));
    setRound1Results(results);
    const teamPoints: any[] = teams.map((_, index) => ({ teamIndex: index, points: 0, goalDifference: 0, goalsFor: 0 }));
    results.forEach((result) => {
      const s1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
      const s2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);
      const t1 = teamPoints.find((t) => t.teamIndex === result.team1Index)!;
      const t2 = teamPoints.find((t) => t.teamIndex === result.team2Index)!;
      t1.goalDifference += s1 - s2; t1.goalsFor += s1;
      t2.goalDifference += s2 - s1; t2.goalsFor += s2;
      if (s1 > s2) t1.points += 3; else if (s2 > s1) t2.points += 3; else { t1.points += 1; t2.points += 1; }
    });
    teamPoints.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamIndex - b.teamIndex);
    const newPairings: Match[] = [];
    const available = [...teamPoints];
    while (available.length > 0) {
      const teamA = available.shift(); if (!teamA) break;
      let teamB = null, teamBIdx = -1;
      for (let i = 0; i < available.length; i++) {
        if (!results.some(m => (m.team1Index === teamA.teamIndex && m.team2Index === available[i].teamIndex) || (m.team1Index === available[i].teamIndex && m.team2Index === teamA.teamIndex))) {
          teamB = available[i]; teamBIdx = i; break;
        }
      }
      if (!teamB) { teamB = available[0]; teamBIdx = 0; }
      if (teamB) { available.splice(teamBIdx, 1); newPairings.push({ team1Index: teamA.teamIndex, team2Index: teamB.teamIndex }); }
    }
    setRound2Pairings(newPairings); setGoalScorers({}); setCurrentRound(2);
  };

  const requireAdmin = (): boolean => {
    if (isManagementAuthenticated) return true;
    const password = window.prompt('Voer het beheerderswachtwoord in:');
    if (password === ADMIN_PASSWORD) { setIsManagementAuthenticated(true); return true; }
    alert('Onjuist wachtwoord.'); return false;
  };

  const handleLogin = (password: string): boolean => { if (password === ADMIN_PASSWORD) { setIsManagementAuthenticated(true); return true; } return false; };

  const renderContent = () => {
    switch (currentView) {
      case 'main':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-8">
              <AttendanceParser onParse={handleParseAttendance} />
              <PlayerList players={players} attendingPlayerIds={attendingPlayerIds} onPlayerToggle={handlePlayerToggle} />
              {/* Voorkeuren Sectie */}
              <div className="bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-700/50">
                <h3 className="text-white font-bold text-lg mb-3">Team-voorkeuren</h3>
                {[ 
                  { label: "Haal vaak-samen spelers uit elkaar", state: separateFrequentTeammates, setter: setSeparateFrequentTeammates },
                  { label: "Top 6 zoveel mogelijk spreiden", state: separateTop6OnPoints, setter: setSeparateTop6OnPoints },
                  { label: "Sync ratings tegenstanders", state: syncOpponentRatings, setter: setSyncOpponentRatings }
                ].map((pref, i) => (
                  <label key={i} className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2 mb-2">
                    <span className="text-sm font-semibold text-gray-100">{pref.label}</span>
                    <input type="checkbox" checked={pref.state} onChange={(e) => pref.setter(e.target.checked)} className="w-5 h-5" />
                  </label>
                ))}
              </div>
              <TeamConstraints attendingPlayers={attendingPlayers} constraints={constraints} onAddConstraint={(c) => setConstraints([...constraints, c])} onRemoveConstraint={(i) => setConstraints(constraints.filter((_, idx) => idx !== i))} />
            </div>
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Start Wedstrijd</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onClick={() => handleGenerateTeams('simple')} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg">1 Wedstrijd</button>
                  <button onClick={() => handleGenerateTeams('tournament')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">Toernooi</button>
                  <button onClick={() => handleGenerateTeams('doubleHeader')} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg">2 Wedstrijden</button>
                </div>
                <div className="mt-8 flex justify-center border-t border-gray-700/50 pt-6">
                   <button onClick={() => { if (requireAdmin()) setCurrentView('nk'); }} className="bg-gradient-to-r from-amber-500/80 to-amber-700/80 text-white text-[10px] font-bold py-2 px-6 rounded-lg uppercase tracking-wider">NK Toernooi Manager</button>
                </div>
              </div>
              {actionInProgress === 'generating' ? <div className="mt-8 flex justify-center p-8 bg-gray-800 rounded-xl"><p className="animate-pulse">Teams worden gemaakt...</p></div> : <TeamDisplay teams={teams} teams2={teams2} gameMode={gameMode} currentRound={currentRound} round1Results={round1Results} round2Pairings={round2Pairings} goalScorers={goalScorers} onGoalChange={handleGoalChange} onSaveRound1={handleSaveRound1} onSaveFinalResults={handleSaveFinalResults} onSaveSimpleMatch={handleSaveSimpleMatch} onStartSecondDoubleHeaderMatch={handleStartSecondDoubleHeaderMatch} onSaveDoubleHeader={handleSaveDoubleHeader} onRegenerateTeams={handleRegenerateTeamsForR2} actionInProgress={actionInProgress} />}
            </div>
          </div>
        );
      case 'rules': return <Rules />;
      case 'nk': return <NKManager players={players} introPlayers={introPlayers} onClose={() => setCurrentView('main')} />; // ✅ PROPS BIJGEWERKT
      case 'stats': return isManagementAuthenticated ? <Statistics history={activeHistory} players={players} onSelectPlayer={(id) => { setSelectedPlayerId(id); setCurrentView('playerDetail'); }} competitionName={competitionName || ""} /> : <LoginScreen onLogin={handleLogin} />;
      case 'history': return <HistoryView history={activeHistory} players={players} isAuthenticated={isManagementAuthenticated} onDeleteSession={() => {}} />;
      case 'playerManagement': return isManagementAuthenticated ? <PlayerManagement players={players} onAdd={handleAddPlayer} onUpdate={handleUpdatePlayer} onDelete={handleDeletePlayer} isLoading={!!actionInProgress} /> : <LoginScreen onLogin={handleLogin} />;
      case 'playerDetail': return selectedPlayer ? <PlayerDetail player={selectedPlayer} history={activeHistory} players={players} ratingLogs={ratingLogs} trophies={trophies} seasonStartDate={seasonStartDate} onBack={() => setCurrentView('stats')} /> : <p>Speler niet gevonden.</p>;
      case 'manualEntry': return <ManualEntry allPlayers={players} onSave={(d) => { if (requireAdmin()) handleSaveManualEntry(d); }} isLoading={actionInProgress === 'savingManual'} />;
      case 'competitionManagement': return isManagementAuthenticated ? <CompetitionManagement currentHistory={history} players={players} seasonStartDate={seasonStartDate} onViewArchive={(a) => { setViewingArchive(a); setCurrentView('stats'); }} onRefresh={fetchData} currentCompetitionName={competitionName} onSetCompetitionName={handleSetCompetitionName} /> : <LoginScreen onLogin={handleLogin} />;
      case 'trophyRoom': return <TrophyRoom trophies={trophies} players={players} isAuthenticated={isManagementAuthenticated} onAddTrophy={handleAddTrophy} onDeleteTrophy={handleDeleteTrophy} />;
      default: return null;
    }
  };

  const NavItem: React.FC<{ view: View; label: string; icon: React.ReactNode; isProtected?: boolean; colorClass?: string; }> = ({ view, label, icon, isProtected, colorClass = 'bg-gray-700' }) => (
    <button onClick={() => { if (view === 'main') setViewingArchive(null); setCurrentView(view); }} className={`group flex flex-col items-center justify-center p-2 transition-all ${currentView === view ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}>
      <div className={`relative p-3 rounded-2xl shadow-lg mb-1 transition-transform group-hover:scale-110 ${colorClass}`}>
        {isProtected && <LockIcon className="w-3 h-3 text-white absolute top-0 right-0 -mt-1 -mr-1" />}
        {icon}
      </div>
      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">{label}</span>
    </button>
  );

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-white text-center"><p className="text-xl font-semibold animate-pulse">Laden...</p></div>;
  if (error || players.length === 0) return <SetupGuide error={error || "Geen spelers gevonden."} onRetry={fetchData} />;

  return (
    <div className="min-h-screen text-white pb-8">
      <div className="container mx-auto p-4 md:p-6">
        <Header competitionName={competitionName} />
        {notification && <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg animate-fade-in-out whitespace-pre-line ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{notification.message}</div>}
        {viewingArchive && <div className="bg-amber-800/50 border border-amber-700 text-amber-200 px-4 py-3 rounded-lg relative mb-6 text-center" role="alert"><strong>Archiefmodus:</strong> Ga naar 'Wedstrijd' om terug te keren.</div>}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 mb-8 shadow-xl border border-gray-700/50">
          <div className="grid grid-cols-4 gap-x-6 gap-y-6 justify-items-center">
            <NavItem view="main" label="Wedstrijd" icon={<FutbolIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-red-400 to-red-700" />
            <NavItem view="rules" label="Regels" icon={<BookOpenIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-orange-300 to-orange-700" />
            <NavItem view="stats" label="Statistieken" icon={<UsersIcon className="w-6 h-6" />} isProtected colorClass="bg-gradient-to-br from-yellow-300 to-yellow-600" />
            <NavItem view="history" label="Geschiedenis" icon={<ClockIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-green-300 to-green-700" />
            <NavItem view="trophyRoom" label="Prijzen" icon={<TrophyIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-blue-300 to-blue-700" />
            <NavItem view="manualEntry" label="Invoer" icon={<EditIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-indigo-300 to-indigo-700" />
            <NavItem view="playerManagement" label="Spelers" icon={<EditIcon className="w-6 h-6" />} isProtected colorClass="bg-gradient-to-br from-purple-300 to-purple-700" />
            <NavItem view="competitionManagement" label="Beheer" icon={<ArchiveIcon className="w-6 h-6" />} isProtected colorClass="bg-gradient-to-br from-pink-300 to-pink-700" />
          </div>
        </div>
        <main>{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
