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
import NKManager from './components/NKManager'; 

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
  | 'nk';

type Notification = { message: string; type: 'success' | 'error' };
type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

const ADMIN_PASSWORD = 'kemmer';
const UNSAVED_GAME_KEY = 'bounceball_unsaved_game';

// ============================================================================
// Helpers: constraints + keepers validation
// ============================================================================

const areTeamCompositionsIdentical = (teamsA: Player[][], teamsB: Player[][]): boolean => {
  if (!teamsA || !teamsB || teamsA.length !== teamsB.length) return false;
  const getCanonicalTeam = (team: Player[]) =>
    JSON.stringify(team.map((p) => p.id).sort((a, b) => a - b));

  for (let i = 0; i < teamsA.length; i++) {
    if (getCanonicalTeam(teamsA[i]) !== getCanonicalTeam(teamsB[i])) return false;
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
  const total = team.reduce((s, p) => s + Number(p.rating), 0);
  return total / team.length;
};

const calcSpread = (teams: Player[][]) => {
  const avgs = teams.map(calcTeamAvg);
  if (avgs.length < 2) return 0;
  return Math.max(...avgs) - Math.min(...avgs);
};

// ============================================================================
// Season Logic
// ============================================================================

type PairKey = string; 
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

const computeSeasonStandingsByPlayer = (seasonHistory: GameSession[]) => {
  const table = new Map<number, { pts: number; gf: number; gd: number }>();
  const ensure = (id: number) => {
    if (!table.has(id)) table.set(id, { pts: 0, gf: 0, gd: 0 });
    return table.get(id)!;
  };
  const applyMatch = (teamsForRound: Player[][] | undefined, match: MatchResult) => {
    const t1 = teamsForRound?.[match.team1Index] || [];
    const t2 = teamsForRound?.[match.team2Index] || [];
    const s1 = (match.team1Goals || []).reduce((sum, g) => sum + Number(g.count), 0);
    const s2 = (match.team2Goals || []).reduce((sum, g) => sum + Number(g.count), 0);
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

const optimizeTeamsSoft = (params: any) => {
  const { teams, constraints, attendingIds, seasonPairCounts, separateFrequent, pairInfrequent, separateTop6, top6Ids } = params;
  if (!separateFrequent && !separateTop6 && !pairInfrequent) return teams;
  const baseSpread = calcSpread(teams);
  const SPREAD_TOLERANCE = 0.05; 
  const cloneTeams = (t: Player[][]) => t.map((team) => [...team]);
  const penalty = (t: Player[][]) => {
    let pen = 0;
    for (const team of t) {
      const ids = team.map((p) => p.id).filter((id) => attendingIds.has(id));
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const count = seasonPairCounts.get(pairKey(ids[i], ids[j])) || 0;
          if (separateFrequent) pen += (count * count) * 150;
          if (pairInfrequent) pen += (count * 25);
        }
      }
      if (separateTop6) {
        const topCount = ids.reduce((s, id) => s + (top6Ids.has(id) ? 1 : 0), 0);
        if (topCount >= 2) pen += (topCount - 1) * 500;
      }
    }
    return pen;
  };
  let best = cloneTeams(teams);
  let bestPenalty = penalty(best);
  const teamCount = best.length;
  if (teamCount < 2 || bestPenalty === 0) return best;
  const teamSizes = best.map((t) => t.length);
  for (let iter = 0; iter < 60000; iter++) {
    const a = Math.floor(Math.random() * teamCount);
    let b = Math.floor(Math.random() * teamCount);
    if (b === a) b = (b + 1) % teamCount;
    if (teamSizes[a] === 0 || teamSizes[b] === 0) continue;
    const ia = Math.floor(Math.random() * teamSizes[a]);
    const ib = Math.floor(Math.random() * teamSizes[b]);
    const cand = cloneTeams(best);
    const pa = cand[a][ia]; const pb = cand[b][ib];
    cand[a][ia] = pb; cand[b][ib] = pa;
    if (!hasValidKeeperDistribution(cand)) continue;
    if (!isCompositionValid(cand, constraints)) continue;
    if (calcSpread(cand) > Math.max(baseSpread, 0.1) + SPREAD_TOLERANCE) continue;
    const candPenalty = penalty(cand);
    if (candPenalty < bestPenalty) {
      best = cand; bestPenalty = candPenalty;
      if (bestPenalty === 0) break;
    }
  }
  return best;
};

const syncRatingsBetweenOpponents = (teams: Player[][]): Player[][] => {
  const result = [...teams.map((t) => [...t])];
  for (let i = 0; i < result.length; i += 2) {
    if (!result[i + 1]) break;
    const teamA = result[i]; const teamB = result[i + 1];
    const keepersA = teamA.filter(p => p.isKeeper); const othersA = teamA.filter(p => !p.isKeeper);
    const keepersB = teamB.filter(p => p.isKeeper); const othersB = teamB.filter(p => !p.isKeeper);
    const slots: { a: Player | null, b: Player | null }[] = [];
    const numKeeperPairs = Math.min(keepersA.length, keepersB.length);
    for (let k = 0; k < numKeeperPairs; k++) slots.push({ a: keepersA.shift()!, b: keepersB.shift()! });
    const remainingA = [...keepersA, ...othersA].sort((a, b) => b.rating - a.rating);
    const remainingB = [...keepersB, ...othersB].sort((a, b) => b.rating - a.rating);
    const maxRemaining = Math.max(remainingA.length, remainingB.length);
    for (let r = 0; r < maxRemaining; r++) slots.push({ a: remainingA[r] || null, b: remainingB[r] || null });
    for (let j = slots.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [slots[j], slots[k]] = [slots[k], slots[j]];
    }
    result[i] = slots.map(s => s.a).filter((p): p is Player => p !== null);
    result[i + 1] = slots.map(s => s.b).filter((p): p is Player => p !== null);
  }
  return result;
};

const calculateRatingDeltas = (session: GameSession): { [key: number]: number } => {
  const ratingChanges: { [key: number]: number } = {};
  const delta = 0.1;
  const applyResults = (results: MatchResult[], teamsForRound: Player[][]) => {
    results.forEach((match) => {
      const t1 = teamsForRound[match.team1Index]; const t2 = teamsForRound[match.team2Index];
      if (!t1 || !t2) return;
      const s1 = (match.team1Goals || []).reduce((sum, g) => sum + Number(g.count), 0);
      const s2 = (match.team2Goals || []).reduce((sum, g) => sum + Number(g.count), 0);
      if (s1 > s2) {
        t1.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) + delta);
        t2.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) - delta);
      } else if (s2 > s1) {
        t1.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) - delta);
        t2.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) + delta);
      }
    });
  };
  applyResults(session.round1Results, session.teams);
  applyResults(session.round2Results, session.round2Teams ?? session.teams);
  return ratingChanges;
};

// ============================================================================
// Main Component
// ============================================================================

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [introPlayers, setIntroPlayers] = useState<Player[]>([]); 
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

  const [separateFrequentTeammates, setSeparateFrequentTeammates] = useState(false);
  const [pairInfrequentTeammates, setPairInfrequentTeammates] = useState(false); 
  const [separateTop6OnPoints, setSeparateTop6OnPoints] = useState(false);
  const [showFrequentPairs, setShowFrequentPairs] = useState(true);
  const [showInfrequentPairs, setShowInfrequentPairs] = useState(false); 
  const [syncOpponentRatings, setSyncOpponentRatings] = useState(false);

  useEffect(() => {
    if (gameMode) {
      const stateToSave = {
        attendingPlayerIds: Array.from(attendingPlayerIds),
        teams, originalTeams, teams2, currentRound, round1Results, round2Pairings, goalScorers, gameMode, constraints,
        separateFrequentTeammates, pairInfrequentTeammates, separateTop6OnPoints, showFrequentPairs, showInfrequentPairs, syncOpponentRatings,
      };
      localStorage.setItem(UNSAVED_GAME_KEY, JSON.stringify(stateToSave));
    }
  }, [
    attendingPlayerIds, teams, originalTeams, teams2, currentRound, round1Results, round2Pairings, goalScorers, gameMode, 
    constraints, separateFrequentTeammates, pairInfrequentTeammates, separateTop6OnPoints, showFrequentPairs, showInfrequentPairs, syncOpponentRatings,
  ]);

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
          setPairInfrequentTeammates(!!savedGame.pairInfrequentTeammates);
          setSeparateTop6OnPoints(!!savedGame.separateTop6OnPoints);
          setShowFrequentPairs(savedGame.showFrequentPairs !== false);
          setShowInfrequentPairs(!!savedGame.showInfrequentPairs);
          setSyncOpponentRatings(!!savedGame.syncOpponentRatings);
        } else { localStorage.removeItem(UNSAVED_GAME_KEY); }
      } catch (e) { localStorage.removeItem(UNSAVED_GAME_KEY); }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getInitialData();
      setSeasonStartDate(data.seasonStartDate || ''); 
      setPlayers(data.players); setIntroPlayers((data as any).introPlayers || []);
      setHistory(data.history); setCompetitionName(data.competitionName || null); 
      setRatingLogs(data.ratingLogs || []); setTrophies(data.trophies || []);
    } catch (e: any) { setError(e.message || 'Laden mislukt.'); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => { setNotification({ message, type }); };
  const handlePlayerToggle = (id: number) => {
    setAttendingPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleParseAttendance = (text: string) => {
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\.$/, '');
    const lines = text.split('\n');
    const potentialNames = new Set<string>();
    const monthNames = ['feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const nonNameIndicators = ['afgemeld', 'gemeld', 'ja', 'nee', 'ok', 'jup', 'aanwezig', 'present', 'ik ben er', 'ik kan', 'helaas', 'ik ben erbij', 'twijfel', 'later', 'keepen', 'keeper', 'reserve', 'niet', 'graag', 'team', 'maandag', 'dinsdag', 'uari', 'Dinsdag'];
    lines.forEach((line) => {
      const trimmed = line.trim(); if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (nonNameIndicators.some(w => lower.includes(w)) && lower.length > 20) return;
      if (monthNames.some(m => lower.includes(m)) && (lower.match(/\d/g) || []).length > 1) return;
      let cleaned = trimmed.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').replace(/\[.*?\]/, '').replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].replace(/[\(\[].*?[\)\]]/g, '').trim();
      if (cleaned && cleaned.length > 1 && /[a-zA-Z]/.test(cleaned) && cleaned.length < 30) potentialNames.add(cleaned);
    });
    const playerLookup = new Map<string, Player>();
    players.forEach((p) => {
      const full = normalize(p.name); const first = full.split(' ')[0];
      playerLookup.set(full, p); if (!playerLookup.has(first)) playerLookup.set(first, p);
    });
    const nextIds = new Set(attendingPlayerIds);
    const found: string[] = []; const notFound: string[] = [];
    potentialNames.forEach((name) => {
      const norm = normalize(name);
      const match = playerLookup.get(norm) || playerLookup.get(norm.split(' ')[0]);
      if (match) { if (!nextIds.has(match.id)) found.push(match.name); nextIds.add(match.id); }
      else { notFound.push(name); }
    });
    setAttendingPlayerIds(nextIds);
    if (found.length > 0 || notFound.length > 0) {
      let msg = ''; let type: 'success' | 'error' = 'success';
      if (found.length > 0) msg += `${found.length} speler(s) toegevoegd: ${found.join(', ')}.`;
      if (notFound.length > 0) { msg += `${msg ? '\n' : ''}Niet herkend: ${notFound.join(', ')}.`; type = 'error'; }
      showNotification(msg, type);
    }
  };

  const resetGameState = () => {
    setTeams([]); setTeams2(null); setOriginalTeams(null); setCurrentRound(0);
    setRound1Results([]); setRound2Pairings([]); setGoalScorers({});
    setGameMode(null); setActionInProgress(null); setConstraints([]);
    localStorage.removeItem(UNSAVED_GAME_KEY);
  };

  const attendingPlayers = useMemo(() => players.filter((p) => attendingPlayerIds.has(p.id)), [players, attendingPlayerIds]);
  const activeHistory = viewingArchive || history;
  const seasonPairCounts = useMemo(() => computeSeasonPairCounts(activeHistory), [activeHistory]);

  const top6Ids = useMemo(() => {
    const standings = computeSeasonStandingsByPlayer(activeHistory);
    return new Set(attendingPlayers.map((p) => ({ id: p.id, ...standings.get(p.id) || { pts: 0, gf: 0, gd: 0 } }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.id - b.id)
      .slice(0, 6).map((x) => x.id));
  }, [activeHistory, attendingPlayers]);

  const frequentPairsForUI = useMemo(() => {
    const idToP = new Map(players.map(p => [p.id, p]));
    return Array.from(seasonPairCounts.entries()).map(([k, count]) => {
      const [aStr, bStr] = k.split('-'); const a = Number(aStr); const b = Number(bStr);
      if (!attendingPlayerIds.has(a) || !attendingPlayerIds.has(b)) return null;
      const pa = idToP.get(a); const pb = idToP.get(b);
      return (pa && pb) ? { a, b, count, aName: pa.name, bName: pb.name } : null;
    }).filter((x): x is any => !!x).sort((x, y) => y.count - x.count);
  }, [seasonPairCounts, players, attendingPlayerIds]);

  const infrequentPairsForUI = useMemo(() => {
    const idToP = new Map(players.map(p => [p.id, p]));
    const attArr = attendingPlayers.map(p => p.id);
    const pairs: any[] = [];
    for (let i = 0; i < attArr.length; i++) {
      for (let j = i + 1; j < attArr.length; j++) {
        const a = attArr[i]; const b = attArr[j];
        const count = seasonPairCounts.get(pairKey(a, b)) || 0;
        pairs.push({ a, b, count, aName: idToP.get(a)?.name, bName: idToP.get(b)?.name });
      }
    }
    return pairs.sort((x, y) => x.count - y.count);
  }, [seasonPairCounts, players, attendingPlayers]);

  const handleGenerateTeams = async (mode: GameMode) => {
    resetGameState(); setGameMode(mode);
    let numberOfTeams = (mode === 'simple' || mode === 'doubleHeader') ? 2 : (attendingPlayers.length >= 24 ? 6 : (attendingPlayers.length >= 16 ? 4 : 2));
    if (attendingPlayers.length < numberOfTeams) return showNotification(`Niet genoeg spelers voor ${numberOfTeams} teams.`, 'error');
    setActionInProgress('generating');
    try {
      let gen = await generateTeams(attendingPlayers, numberOfTeams, constraints, null, activeHistory);
      gen = optimizeTeamsSoft({
        teams: gen, constraints, attendingIds: new Set(attendingPlayers.map(p => p.id)), seasonPairCounts,
        separateFrequent: separateFrequentTeammates, pairInfrequent: pairInfrequentTeammates,
        separateTop6: separateTop6OnPoints, top6Ids,
      });
      if (syncOpponentRatings) gen = syncRatingsBetweenOpponents(gen);
      setTeams(gen); setOriginalTeams(JSON.parse(JSON.stringify(gen))); setCurrentRound(1);
    } catch (e: any) { showNotification(e.message, 'error'); resetGameState(); } finally { setActionInProgress(null); }
  };

  const handleGoalChange = (matchIndex: number, teamId: 'team1' | 'team2', playerId: number, count: number) => {
    const key = `${matchIndex}-${teamId}`;
    setGoalScorers((prev) => {
      const list = [...(prev[key] || [])]; const idx = list.findIndex(g => g.playerId === playerId);
      if (count > 0) { if (idx > -1) list[idx] = { ...list[idx], count }; else list.push({ playerId, count }); }
      else if (idx > -1) list.splice(idx, 1);
      return { ...prev, [key]: list };
    });
  };

  const handleSaveSession = async (sessionData: GameSession) => {
    const changes = calculateRatingDeltas(sessionData);
    const updates = players.filter(p => changes[p.id] !== undefined)
      .map(p => ({ id: p.id, rating: parseFloat((Number(p.rating) + changes[p.id]).toFixed(2)) }));
    try {
    //  await saveGameSession(sessionData, updates); showNotification('Sessie opgeslagen!', 'success');
      showNotification('TESTMODUS: Niets naar de sheet gestuurd!', 'success');
      setPlayers(prev => prev.map(p => { const u = updates.find(x => x.id === p.id); return u ? { ...p, rating: u.rating } : p; }));
      setHistory(prev => [sessionData, ...prev]); resetGameState(); setAttendingPlayerIds(new Set());
    } catch (e: any) { showNotification(`Fout: ${e.message}`, 'error'); }
  };

  const handleSaveRound1 = (matches: Match[]) => {
    const results = matches.map((m, i) => ({ ...m, team1Goals: goalScorers[`${i}-team1`] || [], team2Goals: goalScorers[`${i}-team2`] || [] }));
    setRound1Results(results);
    const pts = teams.map((_, i) => ({ teamIndex: i, points: 0, gd: 0, gf: 0 }));
    results.forEach((r) => {
      const s1 = r.team1Goals.reduce((s, g) => s + Number(g.count), 0);
      const s2 = r.team2Goals.reduce((s, g) => s + Number(g.count), 0);
      const t1 = pts.find(t => t.teamIndex === r.team1Index)!;
      const t2 = pts.find(t => t.teamIndex === r.team2Index)!;
      t1.gd += s1 - s2; t1.gf += s1; t2.gd += s2 - s1; t2.gf += s2;
      if (s1 > s2) t1.points += 3; else if (s2 > s1) t2.points += 3; else { t1.points += 1; t2.points += 1; }
    });
    pts.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    const pairings: Match[] = []; const avail = [...pts];
    while (avail.length) {
      const tA = avail.shift()!;
      let bIdx = avail.findIndex(tB => !results.some(m => (m.team1Index === tA.teamIndex && m.team2Index === tB.teamIndex) || (m.team1Index === tB.teamIndex && m.team2Index === tA.teamIndex)));
      if (bIdx === -1) bIdx = 0;
      const tB = avail.splice(bIdx, 1)[0]; if (tB) pairings.push({ team1Index: tA.teamIndex, team2Index: tB.teamIndex });
    }
    setRound2Pairings(pairings); setGoalScorers({}); setCurrentRound(2);
  };

  const handleRegenerateTeamsForR2 = async () => {
    if (!originalTeams) return; setActionInProgress('regeneratingTeams');
    try {
      const currentAttending = players.filter(p => attendingPlayerIds.has(p.id));
      let reg = await generateTeams(currentAttending, originalTeams.length, constraints, null, activeHistory);
      reg = optimizeTeamsSoft({
        teams: reg, constraints, attendingIds: new Set(currentAttending.map(p => p.id)), seasonPairCounts,
        separateFrequent: separateFrequentTeammates, pairInfrequent: pairInfrequentTeammates,
        separateTop6: separateTop6OnPoints, top6Ids
      });
      if (syncOpponentRatings) reg = syncRatingsBetweenOpponents(reg);
      setTeams(reg); setRound2Pairings(Array.from({ length: reg.length / 2 }, (_, i) => ({ team1Index: i * 2, team2Index: i * 2 + 1 })));
      setGoalScorers({});
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setActionInProgress(null); }
  };

  const handleSaveFinalResults = async (matches: Match[]) => {
    if (!requireAdmin()) return; setActionInProgress('savingFinal');
    const r2 = matches.map((m, i) => ({ ...m, team1Goals: goalScorers[`${i}-team1`] || [], team2Goals: goalScorers[`${i}-team2`] || [] }));
    
    // ✅ FIX: Gebruik originalTeams voor Ronde 1 uitslagen
    const sessionTeamsR1 = originalTeams || teams;
    const sessionTeamsR2 = teams;
    const sessionData: GameSession = {
      date: new Date().toISOString(),
      teams: sessionTeamsR1,
      round1Results,
      round2Results: r2,
    };
    if (!areTeamCompositionsIdentical(sessionTeamsR1, sessionTeamsR2)) {
      sessionData.round2Teams = sessionTeamsR2;
    }
    await handleSaveSession(sessionData);
    setActionInProgress(null);
  };

  const handleSaveSimpleMatch = async (match: Match) => {
    if (!requireAdmin()) return; setActionInProgress('savingSimple');
    await handleSaveSession({ 
      date: new Date().toISOString(), 
      teams: originalTeams || teams, 
      round1Results: [{ ...match, team1Goals: goalScorers['0-team1'] || [], team2Goals: goalScorers['0-team2'] || [] }], 
      round2Results: [] 
    });
    setActionInProgress(null);
  };

  const handleStartSecondDoubleHeaderMatch = async (m1: MatchResult) => {
    setActionInProgress('generating');
    try {
      let reg = await generateTeams(teams.flat(), 2, constraints, teams, activeHistory);
      reg = optimizeTeamsSoft({
        teams: reg, constraints, attendingIds: new Set(teams.flat().map(p => p.id)), seasonPairCounts,
        separateFrequent: separateFrequentTeammates, pairInfrequent: pairInfrequentTeammates,
        separateTop6: separateTop6OnPoints, top6Ids
      });
      if (syncOpponentRatings) reg = syncRatingsBetweenOpponents(reg);
      setTeams2(reg); setRound1Results([m1]); setGoalScorers({}); setCurrentRound(2);
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setActionInProgress(null); }
  };

  const handleSaveDoubleHeader = async (m2: MatchResult) => {
    if (!requireAdmin()) return; setActionInProgress('savingDouble');
    if (!originalTeams || !teams2) return setActionInProgress(null);
    const s1 = { date: new Date().toISOString(), teams: originalTeams, round1Results, round2Results: [] };
    const s2 = { date: new Date().toISOString(), teams: teams2, round1Results: [m2], round2Results: [] };
    const d1 = calculateRatingDeltas(s1); const d2 = calculateRatingDeltas(s2);
    const updates = players.map(p => {
      const v = (d1[p.id] || 0) + (d2[p.id] || 0);
      return v !== 0 ? { id: p.id, rating: parseFloat((Number(p.rating) + v).toFixed(2)) } : null;
    }).filter((x): x is any => !!x);
    try {
      await saveGameSession(s1, updates); await new Promise(r => setTimeout(r, 2000)); await saveGameSession(s2, updates);
      showNotification('Beide opgeslagen!', 'success'); fetchData(); resetGameState(); setAttendingPlayerIds(new Set());
    } catch (e: any) { showNotification(`Fout: ${e.message}`, 'error'); }
    setActionInProgress(null);
  };

  const handleManualSwap = (teamA: number, pA: number, teamB: number, pB: number) => {
    const next = teams.map(t => [...t]); 
    const playerA = next[teamA][pA]; const playerB = next[teamB][pB];
    next[teamA][pA] = playerB; next[teamB][pB] = playerA;
    setTeams(next);
    if (currentRound === 1) setOriginalTeams(JSON.parse(JSON.stringify(next)));
  };

  const handleAddConstraint = (c: Constraint) => setConstraints(prev => [...prev, c]);
  const handleRemoveConstraint = (i: number) => setConstraints(prev => prev.filter((_, idx) => idx !== i));
  const handleAddPlayer = async (p: NewPlayer) => { try { const { newId } = await addPlayer(p); setPlayers(prev => [...prev, { ...p, id: newId }].sort((a, b) => a.name.localeCompare(b.name))); showNotification('Toegevoegd!'); } catch (e: any) { showNotification(e.message, 'error'); } };
  const handleUpdatePlayer = async (p: Player) => { try { await updatePlayer(p); setPlayers(prev => prev.map(x => x.id === p.id ? p : x)); showNotification('Bijgewerkt!'); } catch (e: any) { showNotification(e.message, 'error'); } };
  const handleDeletePlayer = async (id: number) => { try { await deletePlayer(id); setPlayers(prev => prev.filter(x => x.id !== id)); showNotification('Verwijderd.'); } catch (e: any) { showNotification(e.message, 'error'); } };
  const handleAddTrophy = async (t: any) => { try { await addTrophy(t); fetchData(); showNotification('Trofee!'); } catch (e: any) { showNotification(e.message, 'error'); throw e; } };
  const handleDeleteTrophy = async (id: string) => { try { await deleteTrophy(id); setTrophies(prev => prev.filter(x => x.id !== id)); } catch (e: any) { showNotification(e.message, 'error'); } };
  const handleSelectPlayer = (id: number) => { setSelectedPlayerId(id); setCurrentView('playerDetail'); };
  const handleLogin = (p: string) => { if (p === ADMIN_PASSWORD) { setIsManagementAuthenticated(true); return true; } return false; };
  const requireAdmin = () => { if (isManagementAuthenticated) return true; const p = window.prompt('Wachtwoord:'); if (p === ADMIN_PASSWORD) { setIsManagementAuthenticated(true); return true; } return false; };
  const handleSaveManualEntry = async (d: any) => { if (requireAdmin()) { setActionInProgress('savingManual'); await handleSaveSession(d); setActionInProgress(null); } };
  const handleSetCompetitionName = async (n: string) => { try { await setCompetitionNameService(n); setCompetitionName(n); } catch (e: any) { showNotification(e.message, 'error'); } };

  const renderMainView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-8">
        <AttendanceParser onParse={handleParseAttendance} />
        <PlayerList players={players} attendingPlayerIds={attendingPlayerIds} onPlayerToggle={handlePlayerToggle} />
        <div className="bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-700/50">
          <h3 className="text-white font-bold text-lg mb-3">Team-voorkeuren</h3>
          <label className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2 mb-2">
            <div className="text-sm">
              <div className="font-semibold text-gray-100">Frequent partners apart</div>
              <div className="text-xs text-gray-400">Vergroot variatie in teams.</div>
            </div>
            <input type="checkbox" checked={separateFrequentTeammates} onChange={(e) => setSeparateFrequentTeammates(e.target.checked)} className="w-5 h-5" />
          </label>
          <label className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2 mb-2">
            <div className="text-sm">
              <div className="font-semibold text-gray-100">Nieuwe duo's samen</div>
              <div className="text-xs text-gray-400">Favoriseert onbekende combinaties.</div>
            </div>
            <input type="checkbox" checked={pairInfrequentTeammates} onChange={(e) => setPairInfrequentTeammates(e.target.checked)} className="w-5 h-5" />
          </label>
          <label className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2 mb-2">
            <div className="text-sm"><div className="font-semibold text-gray-100">Top 6 spreiden</div></div>
            <input type="checkbox" checked={separateTop6OnPoints} onChange={(e) => setSeparateTop6OnPoints(e.target.checked)} className="w-5 h-5" />
          </label>
          <label className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2 mb-2">
            <div className="text-sm"><div className="font-semibold text-gray-100">Sync ratings tegenstanders</div></div>
            <input type="checkbox" checked={syncOpponentRatings} onChange={(e) => setSyncOpponentRatings(e.target.checked)} className="w-5 h-5" />
          </label>
          <div className="border-t border-gray-700 my-4 pt-2">
            <label className="flex items-center justify-between gap-3 px-1 py-1">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Lijst: Vaak samen</div>
              <input type="checkbox" checked={showFrequentPairs} onChange={(e) => setShowFrequentPairs(e.target.checked)} className="w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-3 px-1 py-1">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Lijst: Zelden samen</div>
              <input type="checkbox" checked={showInfrequentPairs} onChange={(e) => setShowInfrequentPairs(e.target.checked)} className="w-4 h-4" />
            </label>
          </div>
          {showFrequentPairs && (
            <div className="mt-3 bg-gray-900/40 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 font-black uppercase mb-2">Vaak samen:</div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {frequentPairsForUI.length === 0 ? <p className="text-xs text-gray-500">Nog geen data.</p> : 
                  frequentPairsForUI.map((p: any) => (
                    <div key={`${p.a}-${p.b}`} className="flex justify-between text-sm bg-red-900/20 rounded px-2 py-1 mb-1 border border-red-900/30">
                      <span className="truncate text-gray-200">{p.aName} & {p.bName}</span>
                      <span className="text-xs font-mono bg-red-900 text-red-100 px-2 rounded-full">{p.count}x</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          {showInfrequentPairs && (
            <div className="mt-3 bg-gray-900/40 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 font-black uppercase mb-2">Zelden samen:</div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {infrequentPairsForUI.length === 0 ? <p className="text-xs text-gray-500">Nog geen data.</p> : 
                  infrequentPairsForUI.map((p: any) => (
                    <div key={`${p.a}-${p.b}`} className="flex justify-between text-sm bg-green-900/20 rounded px-2 py-1 mb-1 border border-green-900/30">
                      <span className="truncate text-gray-200">{p.aName} & {p.bName}</span>
                      <span className="text-xs font-mono bg-green-900 text-green-100 px-2 rounded-full">{p.count}x</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
        <TeamConstraints attendingPlayers={attendingPlayers} constraints={constraints} onAddConstraint={handleAddConstraint} onRemoveConstraint={handleRemoveConstraint} />
      </div>
      <div className="lg:col-span-2">
        <div className="bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Start Wedstrijd</h2>
          <div className="flex items-center mb-4"><UsersIcon className="w-5 h-5 text-gray-400 mr-2" /><span className="text-lg font-semibold text-white">{attendingPlayers.length} spelers aanwezig</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => handleGenerateTeams('simple')} disabled={actionInProgress==='generating'||attendingPlayers.length<2} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg transform hover:scale-105 transition-all">1 Wedstrijd</button>
            <button onClick={() => handleGenerateTeams('tournament')} disabled={actionInProgress==='generating'||attendingPlayers.length<4} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transform hover:scale-105 transition-all">Toernooi</button>
            <button onClick={() => handleGenerateTeams('doubleHeader')} disabled={actionInProgress==='generating'||attendingPlayers.length<2} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transform hover:scale-105 transition-all">2 Wedstrijden</button>
          </div>
          <div className="mt-8 flex justify-center border-t border-gray-700/50 pt-6">
            <button onClick={() => { if(requireAdmin()) setCurrentView('nk'); }} className="bg-gradient-to-r from-amber-500/80 to-amber-700/80 text-white text-[10px] font-bold py-2 px-6 rounded-lg uppercase tracking-wider transform hover:scale-105 transition-all">NK Manager</button>
          </div>
        </div>
        {actionInProgress === 'generating' ? (
          <div className="mt-8 flex justify-center p-8 bg-gray-800 rounded-xl flex-col items-center">
            <FutbolIcon className="w-16 h-16 text-cyan-400 animate-bounce" />
            <p className="mt-4 text-white font-semibold animate-pulse">AI zoekt balans...</p>
          </div>
        ) : (
          <TeamDisplay teams={teams} teams2={teams2} gameMode={gameMode} currentRound={currentRound} round1Results={round1Results} round2Pairings={round2Pairings} goalScorers={goalScorers} onGoalChange={handleGoalChange} onSaveRound1={handleSaveRound1} onSaveFinalResults={handleSaveFinalResults} onSaveSimpleMatch={handleSaveSimpleMatch} onStartSecondDoubleHeaderMatch={handleStartSecondDoubleHeaderMatch} onSaveDoubleHeader={handleSaveDoubleHeader} onRegenerateTeams={handleRegenerateTeamsForR2} onManualSwap={handleManualSwap} actionInProgress={actionInProgress} />
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'main': return renderMainView();
      case 'rules': return <Rules />;
      case 'stats': return isManagementAuthenticated ? <Statistics history={activeHistory} players={players} onSelectPlayer={handleSelectPlayer} competitionName={competitionName || "Statistieken"} /> : <LoginScreen onLogin={handleLogin} />;
      case 'history': return <HistoryView history={activeHistory} players={players} isAuthenticated={isManagementAuthenticated} onDeleteSession={() => {}} />;
      case 'playerManagement': return isManagementAuthenticated ? <PlayerManagement players={players} onAdd={handleAddPlayer} onUpdate={handleUpdatePlayer} onDelete={handleDeletePlayer} isLoading={!!actionInProgress} /> : <LoginScreen onLogin={handleLogin} />;
      case 'playerDetail':
        const pdP = players.find(p => p.id === selectedPlayerId);
        return pdP ? <PlayerDetail player={pdP} history={activeHistory} players={players} ratingLogs={ratingLogs} trophies={trophies} seasonStartDate={seasonStartDate} competitionName={competitionName} onBack={() => setCurrentView('stats')} /> : <div className="text-center p-8 bg-gray-800 rounded-xl"><p>Niet gevonden.</p></div>;
      case 'manualEntry': return <ManualEntry allPlayers={players} onSave={handleSaveManualEntry} isLoading={actionInProgress === 'savingManual'} />;
      case 'competitionManagement': return isManagementAuthenticated ? <CompetitionManagement currentHistory={history} players={players} seasonStartDate={seasonStartDate} onViewArchive={setViewingArchive} onRefresh={fetchData} currentCompetitionName={competitionName} onSetCompetitionName={handleSetCompetitionName} /> : <LoginScreen onLogin={handleLogin} />;
      case 'trophyRoom': return <TrophyRoom trophies={trophies} players={players} isAuthenticated={isManagementAuthenticated} onAddTrophy={handleAddTrophy} onDeleteTrophy={handleDeleteTrophy} />;
      case 'nk': return <NKManager players={players} introPlayers={introPlayers} onClose={() => setCurrentView('main')} />;
      default: return renderMainView();
    }
  };

  const NavItem = ({ view, label, icon, isProtected, colorClass }: any) => (
    <button onClick={() => { if (view === 'main') setViewingArchive(null); setCurrentView(view); }} className={`group flex flex-col items-center p-2 rounded-xl transition-all ${currentView === view ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}>
      <div className={`relative p-3 rounded-2xl shadow-lg mb-1 ${colorClass}`}>
        {isProtected && <LockIcon className="w-3 h-3 text-white absolute top-0 right-0 -mt-1 -mr-1" />}
        <div className="text-white">{icon}</div>
      </div>
      <span className="text-[10px] font-bold text-gray-300 uppercase">{label}</span>
    </button>
  );

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center">
        <img src="https://i.postimg.cc/XJy7yfJ2/bounceball.png" alt="Laden..." className="w-32 h-auto mx-auto mb-6 animate-bounce" />
        <p className="text-xl font-semibold animate-pulse">Gegevens laden...</p>
      </div>
    </div>
  );

  if (error || players.length === 0) return <SetupGuide error={error || "Geen spelers."} onRetry={fetchData} />;

  return (
    <div className="min-h-screen text-white pb-8">
      <div className="container mx-auto p-4 md:p-6">
        <Header competitionName={competitionName} />
        {notification && <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg max-w-sm animate-fade-in-out whitespace-pre-line ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{notification.message}</div>}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 mb-8 shadow-xl border border-gray-700/50">
          <div className="grid grid-cols-4 gap-x-6 gap-y-6 justify-items-center">
            <NavItem view="main" label="Wedstrijd" icon={<FutbolIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-red-400 to-red-700" />
            <NavItem view="rules" label="Regels" icon={<BookOpenIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-orange-300 to-orange-700" />
            <NavItem view="stats" label="Stats" icon={<UsersIcon className="w-6 h-6" />} isProtected colorClass="bg-gradient-to-br from-yellow-300 to-yellow-600" />
            <NavItem view="history" label="Historie" icon={<ClockIcon className="w-6 h-6" />} colorClass="bg-gradient-to-br from-green-300 to-green-700" />
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
