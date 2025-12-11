import React, { useState, useEffect, useCallback } from 'react';
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
  | 'trophyRoom';

type Notification = { message: string; type: 'success' | 'error' };
type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

const ADMIN_PASSWORD = 'kemmer';
const UNSAVED_GAME_KEY = 'bounceball_unsaved_game';

const calculateRatingDeltas = (
  results: MatchResult[],
  currentTeams: Player[][]
): { [key: number]: number } => {
  const ratingChanges: { [key: number]: number } = {};
  const ratingDelta = 0.1;

  results.forEach((match) => {
    const team1 = currentTeams[match.team1Index];
    const team2 = currentTeams[match.team2Index];
    if (!team1 || !team2) return;

    const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
    const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

    if (team1Score > team2Score) {
      team1.forEach(
        (p) => (ratingChanges[p.id] = (ratingChanges[p.id] || 0) + ratingDelta)
      );
      team2.forEach(
        (p) => (ratingChanges[p.id] = (ratingChanges[p.id] || 0) - ratingDelta)
      );
    } else if (team2Score > team1Score) {
      team1.forEach(
        (p) => (ratingChanges[p.id] = (ratingChanges[p.id] || 0) - ratingDelta)
      );
      team2.forEach(
        (p) => (ratingChanges[p.id] = (ratingChanges[p.id] || 0) + ratingDelta)
      );
    }
  });

  return ratingChanges;
};

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<GameSession[]>([]);
  const [ratingLogs, setRatingLogs] = useState<RatingLogEntry[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [attendingPlayerIds, setAttendingPlayerIds] = useState<Set<number>>(
    new Set()
  );
  const [teams, setTeams] = useState<Player[][]>([]);
  const [originalTeams, setOriginalTeams] = useState<Player[][] | null>(null);
  const [teams2, setTeams2] = useState<Player[][] | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [round1Results, setRound1Results] = useState<MatchResult[]>([]);
  const [round2Pairings, setRound2Pairings] = useState<Match[]>([]);
  const [goalScorers, setGoalScorers] = useState<{ [key: string]: Goal[] }>(
    {}
  );
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('main');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [viewingArchive, setViewingArchive] =
    useState<GameSession[] | null>(null);
  const [isManagementAuthenticated, setIsManagementAuthenticated] =
    useState(false);
  const [competitionName, setCompetitionName] = useState<string | null>(null);

  // —————————————————
  // LocalStorage: on-change opslaan
  // —————————————————
  useEffect(() => {
    if (gameMode) {
      const stateToSave = {
        attendingPlayerIds: Array.from(attendingPlayerIds),
        teams,
        originalTeams,
        teams2,
        currentRound,
        round1Results,
        round2Pairings,
        goalScorers,
        gameMode,
        constraints,
      };
      localStorage.setItem(UNSAVED_GAME_KEY, JSON.stringify(stateToSave));
    }
  }, [
    attendingPlayerIds,
    teams,
    originalTeams,
    teams2,
    currentRound,
    round1Results,
    round2Pairings,
    goalScorers,
    gameMode,
    constraints,
  ]);

  // —————————————————
  // LocalStorage: bij laden herstellen
  // —————————————————
  useEffect(() => {
    const savedGameJSON = localStorage.getItem(UNSAVED_GAME_KEY);
    if (savedGameJSON) {
      try {
        const savedGame = JSON.parse(savedGameJSON);
        if (
          window.confirm(
            'Er is een niet-opgeslagen wedstrijd gevonden. Wil je doorgaan waar je was gebleven?'
          )
        ) {
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
        } else {
          localStorage.removeItem(UNSAVED_GAME_KEY);
        }
      } catch (e) {
        console.error('Kon de opgeslagen wedstrijd niet herstellen:', e);
        localStorage.removeItem(UNSAVED_GAME_KEY);
      }
    }
  }, []);

  // —————————————————
  // Data ophalen vanuit Google Sheet
  // —————————————————
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const {
        players,
        history,
        competitionName: name,
        ratingLogs: logs,
        trophies: fetchedTrophies,
      } = await getInitialData();

      setPlayers(players);
      setHistory(history);
      setCompetitionName(name || null);
      setRatingLogs(logs || []);
      setTrophies(fetchedTrophies || []);
    } catch (e: any) {
      setError(
        e.message ||
          'Er is een onbekende fout opgetreden bij het laden van de gegevens.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // —————————————————
  // Notificaties automatisch laten verdwijnen
  // —————————————————
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ message, type });
  };

  // —————————————————
  // Aanwezigheid toggelen
  // —————————————————
  const handlePlayerToggle = (playerId: number) => {
    setAttendingPlayerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // —————————————————
  // Aanwezigheidsparser
  // —————————————————
  const handleParseAttendance = (text: string) => {
  const normalize = (str: string): string =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      // 👇 extra regel: puntje aan het eind weghalen
      .replace(/\.$/, '');

    const lines = text.split('\n');
    const potentialNames = new Set<string>();
    const monthNames = [
      'feb',
      'mrt',
      'apr',
      'mei',
      'jun',
      'jul',
      'aug',
      'sep',
      'okt',
      'nov',
      'dec',
    ];
    const nonNameIndicators = [
      'afgemeld',
      'gemeld',
      'ja',
      'nee',
      'ok',
      'jup',
      'aanwezig',
      'present',
      'ik ben er',
      'ik kan',
      'helaas',
      'ik ben erbij',
      'twijfel',
      'later',
      'keepen',
      'keeper',
    ];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      const lowerLine = trimmedLine.toLowerCase();

      if (
        nonNameIndicators.some((word) => lowerLine.includes(word)) &&
        lowerLine.length > 20
      )
        return;
      if (
        monthNames.some((month) => lowerLine.includes(month)) &&
        (lowerLine.match(/\d/g) || []).length > 1
      )
        return;

      let cleaned = trimmedLine
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
        .replace(/\[.*?\]/, '')
        .replace(/^\s*\d+[\.\)]?\s*/, '')
        .split(/[:\-\–]/)[0]
        .replace(/[\(\[].*?[\)\]]/g, '')
        .trim();

      if (
        cleaned &&
        cleaned.length > 1 &&
        /[a-zA-Z]/.test(cleaned) &&
        cleaned.length < 30
      ) {
        potentialNames.add(cleaned);
      }
    });

    if (potentialNames.size === 0) {
      showNotification(
        'Geen geldige namen gevonden in de tekst. Probeer de lijst op te schonen.',
        'error'
      );
      return;
    }

    const playerLookup = new Map<string, Player>();
    players.forEach((player) => {
      const normalizedFullName = normalize(player.name);
      const normalizedFirstName = normalizedFullName.split(' ')[0];
      playerLookup.set(normalizedFullName, player);
      if (!playerLookup.has(normalizedFirstName)) {
        playerLookup.set(normalizedFirstName, player);
      }
    });

    const newAttendingPlayerIds = new Set(attendingPlayerIds);
    const newlyFoundPlayers: string[] = [];
    const notFoundOriginalNames: string[] = [];

    potentialNames.forEach((originalName) => {
      const normalizedName = normalize(originalName);
      const matchedPlayer =
        playerLookup.get(normalizedName) ||
        playerLookup.get(normalizedName.split(' ')[0]);
      if (matchedPlayer) {
        if (!newAttendingPlayerIds.has(matchedPlayer.id)) {
          newlyFoundPlayers.push(matchedPlayer.name);
        }
        newAttendingPlayerIds.add(matchedPlayer.id);
      } else {
        notFoundOriginalNames.push(originalName);
      }
    });

    setAttendingPlayerIds(newAttendingPlayerIds);

    if (newlyFoundPlayers.length > 0 || notFoundOriginalNames.length > 0) {
      let message = '';
      let type: 'success' | 'error' = 'success';

      if (newlyFoundPlayers.length > 0) {
        message += `${newlyFoundPlayers.length} speler(s) toegevoegd: ${newlyFoundPlayers.join(
          ', '
        )}.`;
      }

      if (notFoundOriginalNames.length > 0) {
        message += `${message ? '\n' : ''}Niet herkend: ${notFoundOriginalNames.join(
          ', '
        )}.`;
        type = 'error';
      }
      showNotification(message, type);
    } else if (potentialNames.size > 0) {
      showNotification(
        'Alle spelers uit de lijst waren al aangemeld.',
        'success'
      );
    }
  };

  // —————————————————
  // Game state reset
  // —————————————————
  const resetGameState = () => {
    setTeams([]);
    setTeams2(null);
    setOriginalTeams(null);
    setCurrentRound(0);
    setRound1Results([]);
    setRound2Pairings([]);
    setGoalScorers({});
    setGameMode(null);
    setActionInProgress(null);
    setConstraints([]);
    localStorage.removeItem(UNSAVED_GAME_KEY);
  };

  const attendingPlayers = players.filter((p) =>
    attendingPlayerIds.has(p.id)
  );

  // —————————————————
  // Teams genereren
  // —————————————————
  const handleGenerateTeams = async (mode: GameMode) => {
    resetGameState();
    setGameMode(mode);
    const playerCount = attendingPlayers.length;
    let numberOfTeams;

    if (mode === 'simple' || mode === 'doubleHeader') {
      numberOfTeams = 2;
    } else {
      if (playerCount >= 24) numberOfTeams = 6;
      else if (playerCount >= 16) numberOfTeams = 4;
      else numberOfTeams = 2;
    }

    if (attendingPlayers.length < numberOfTeams) {
      showNotification(
        `Niet genoeg spelers voor ${numberOfTeams} teams.`,
        'error'
      );
      return;
    }

    setActionInProgress('generating');
    try {
      const generated = await generateTeams(
        attendingPlayers,
        numberOfTeams,
        constraints
      );
      setTeams(generated);
      setOriginalTeams(JSON.parse(JSON.stringify(generated)));
      setCurrentRound(1);
    } catch (e: any) {
      showNotification(e.message, 'error');
      resetGameState();
    } finally {
      setActionInProgress(null);
    }
  };

  // —————————————————
  // Goals invoer
  // —————————————————
  const handleGoalChange = (
    matchIndex: number,
    teamIdentifier: 'team1' | 'team2',
    playerId: number,
    count: number
  ) => {
    const key = `${matchIndex}-${teamIdentifier}`;
    setGoalScorers((prev) => {
      const newGoals = [...(prev[key] || [])];
      const existingGoalIndex = newGoals.findIndex(
        (g) => g.playerId === playerId
      );

      if (count > 0) {
        if (existingGoalIndex > -1) {
          newGoals[existingGoalIndex] = {
            ...newGoals[existingGoalIndex],
            count,
          };
        } else {
          newGoals.push({ playerId, count });
        }
      } else {
        if (existingGoalIndex > -1) {
          newGoals.splice(existingGoalIndex, 1);
        }
      }
      return { ...prev, [key]: newGoals };
    });
  };

  // —————————————————
  // Sessie opslaan (generiek)
  // —————————————————
  const handleSaveSession = async (sessionData: {
    date: string;
    teams: Player[][];
    round1Results: MatchResult[];
    round2Results: MatchResult[];
  }) => {
    const allResults = [
      ...sessionData.round1Results,
      ...sessionData.round2Results,
    ];
    const ratingChanges = calculateRatingDeltas(allResults, sessionData.teams);
    const updatedRatings = players
      .filter((p) => ratingChanges[p.id] !== undefined)
      .map((p) => ({
        id: p.id,
        rating: Math.max(
          1,
          parseFloat((p.rating + ratingChanges[p.id]).toFixed(2))
        ),
      }));

    try {
      await saveGameSession(sessionData, updatedRatings);
      showNotification('Sessie en ratings succesvol opgeslagen!', 'success');
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) => {
          const update = updatedRatings.find((u) => u.id === p.id);
          return update ? { ...p, rating: update.rating } : p;
        })
      );
      setHistory((prevHistory) => [sessionData, ...prevHistory]);
      resetGameState();
      setAttendingPlayerIds(new Set());
    } catch (e: any) {
      showNotification(`Fout bij opslaan: ${e.message}`, 'error');
    }
  };

  // —————————————————
  // Ronde 1 opslaan & ronde 2 pairings bepalen
  // —————————————————
  const handleSaveRound1 = (matches: Match[]) => {
    const results: MatchResult[] = matches.map(
      (match, index): MatchResult => ({
        ...match,
        team1Goals: goalScorers[`${index}-team1`] || [],
        team2Goals: goalScorers[`${index}-team2`] || [],
      })
    );

    setRound1Results(results);

    const teamPoints: {
      teamIndex: number;
      points: number;
      goalDifference: number;
      goalsFor: number;
    }[] = [];
    teams.forEach((_, index) => {
      teamPoints.push({
        teamIndex: index,
        points: 0,
        goalDifference: 0,
        goalsFor: 0,
      });
    });

    results.forEach((result) => {
      const team1Score = result.team1Goals.reduce(
        (sum, g) => sum + g.count,
        0
      );
      const team2Score = result.team2Goals.reduce(
        (sum, g) => sum + g.count,
        0
      );
      const team1 = teamPoints.find((t) => t.teamIndex === result.team1Index)!;
      const team2 = teamPoints.find((t) => t.teamIndex === result.team2Index)!;

      team1.goalDifference += team1Score - team2Score;
      team1.goalsFor += team1Score;
      team2.goalDifference += team2Score - team1Score;
      team2.goalsFor += team2Score;

      if (team1Score > team2Score) {
        team1.points += 3;
      } else if (team2Score > team1Score) {
        team2.points += 3;
      } else {
        team1.points += 1;
        team2.points += 1;
      }
    });

    teamPoints.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.teamIndex - b.teamIndex
    );

    const newPairings: Match[] = [];
    const availableTeams = [...teamPoints];

    while (availableTeams.length > 0) {
      const teamA = availableTeams.shift();
      if (!teamA) break;

      let teamB: (typeof teamPoints)[number] | null = null;
      let teamBIndex = -1;

      for (let i = 0; i < availableTeams.length; i++) {
        const potentialOpponent = availableTeams[i];
        const alreadyPlayed = results.some(
          (match) =>
            (match.team1Index === teamA.teamIndex &&
              match.team2Index === potentialOpponent.teamIndex) ||
            (match.team1Index === potentialOpponent.teamIndex &&
              match.team2Index === teamA.teamIndex)
        );

        if (!alreadyPlayed) {
          teamB = potentialOpponent;
          teamBIndex = i;
          break;
        }
      }

      if (!teamB) {
        teamB = availableTeams[0];
        teamBIndex = 0;
      }

      if (teamB) {
        availableTeams.splice(teamBIndex, 1);
        newPairings.push({
          team1Index: teamA.teamIndex,
          team2Index: teamB.teamIndex,
        });
      }
    }

    setRound2Pairings(newPairings);
    setGoalScorers({});
    setCurrentRound(2);
  };

  // —————————————————
  // Ronde 2 teams opnieuw genereren (blessures)
  // —————————————————
  const handleRegenerateTeamsForR2 = async () => {
    if (!originalTeams) return;
    setActionInProgress('regeneratingTeams');

    try {
      const remainingPlayers = attendingPlayers;
      if (remainingPlayers.length < 4)
        throw new Error(
          'Niet genoeg spelers over om nieuwe teams te maken (minimaal 4).'
        );
      const numTeams = originalTeams.length;
      if (remainingPlayers.length < numTeams)
        throw new Error(
          `Te weinig spelers (${remainingPlayers.length}) om de oorspronkelijke ${numTeams} teams te vullen.`
        );

      const regeneratedTeams = await generateTeams(
        remainingPlayers,
        numTeams,
        constraints
      );

      const newPairings: Match[] = [];
      for (let i = 0; i < regeneratedTeams.length; i += 2) {
        if (regeneratedTeams[i + 1]) {
          newPairings.push({ team1Index: i, team2Index: i + 1 });
        }
      }

      setTeams(regeneratedTeams);
      setRound2Pairings(newPairings);
      setGoalScorers({});
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // —————————————————
  // Final results (toernooi) opslaan
  // —————————————————
  const handleSaveFinalResults = async (matches: Match[]) => {
    if (!requireAdmin()) return; // 🔐

    setActionInProgress('savingFinal');
    const round2Results: MatchResult[] = matches.map(
      (match, index): MatchResult => ({
        ...match,
        team1Goals: goalScorers[`${index}-team1`] || [],
        team2Goals: goalScorers[`${index}-team2`] || [],
      })
    );

    await handleSaveSession({
      date: new Date().toISOString(),
      teams: teams,
      round1Results: round1Results,
      round2Results: round2Results,
    });
    setActionInProgress(null);
  };

  // —————————————————
  // Simpele match opslaan (1 wedstrijd)
  // —————————————————
  const handleSaveSimpleMatch = async (match: Match) => {
    if (!requireAdmin()) return; // 🔐

    setActionInProgress('savingSimple');
    const results: MatchResult[] = [
      {
        ...match,
        team1Goals: goalScorers['0-team1'] || [],
        team2Goals: goalScorers['0-team2'] || [],
      },
    ];
    await handleSaveSession({
      date: new Date().toISOString(),
      teams: teams,
      round1Results: results,
      round2Results: [],
    });
    setActionInProgress(null);
  };

  // —————————————————
  // Double header: tweede wedstrijd starten
  // —————————————————
  const handleStartSecondDoubleHeaderMatch = async (
    match1Result: MatchResult
  ) => {
    setActionInProgress('generating');
    try {
      const allPlayers = teams.flat();
      const regeneratedTeams = await generateTeams(
        allPlayers,
        2,
        constraints,
        teams
      );

      if (!regeneratedTeams || regeneratedTeams.length === 0) {
        throw new Error('Kon geen unieke teamindeling genereren.');
      }

      setTeams2(regeneratedTeams);
      setRound1Results([match1Result]);
      setGoalScorers({});
      setCurrentRound(2);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // —————————————————
  // Double header opslaan (2 losse sessies)
  // —————————————————
  const handleSaveDoubleHeader = async (match2Result: MatchResult) => {
    if (!requireAdmin()) return; // 🔐

    setActionInProgress('savingDouble');
    if (!originalTeams || !teams2) {
      showNotification('Team data ontbreekt.', 'error');
      setActionInProgress(null);
      return;
    }
    await handleSaveSession({
      date: new Date().toISOString(),
      teams: originalTeams,
      round1Results: round1Results,
      round2Results: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await handleSaveSession({
      date: new Date().toISOString(),
      teams: teams2,
      round1Results: [match2Result],
      round2Results: [],
    });
    setActionInProgress(null);
  };

  // —————————————————
  // Constraints
  // —————————————————
  const handleAddConstraint = (constraint: Constraint) => {
    setConstraints((prev) => [...prev, constraint]);
  };

  const handleRemoveConstraint = (index: number) => {
    setConstraints((prev) => prev.filter((_, i) => i !== index));
  };

  // —————————————————
  // Spelersbeheer
  // —————————————————
  const handleAddPlayer = async (newPlayer: NewPlayer) => {
    try {
      const { newId } = await addPlayer(newPlayer);
      const playerWithId: Player = { ...newPlayer, id: newId };
      setPlayers((prev) =>
        [...prev, playerWithId].sort((a, b) => a.name.localeCompare(b.name))
      );
      showNotification(`${newPlayer.name} succesvol toegevoegd!`, 'success');
    } catch (e: any) {
      showNotification(`Fout bij toevoegen: ${e.message}`, 'error');
    }
  };

  const handleUpdatePlayer = async (updatedPlayer: Player) => {
    try {
      await updatePlayer(updatedPlayer);
      setPlayers((prev) =>
        prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
      );
      showNotification(
        `${updatedPlayer.name} succesvol bijgewerkt!`,
        'success'
      );
    } catch (e: any) {
      showNotification(`Fout bij bijwerken: ${e.message}`, 'error');
    }
  };

  const handleDeletePlayer = async (id: number) => {
    try {
      await deletePlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      setAttendingPlayerIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      showNotification('Speler succesvol verwijderd.', 'success');
    } catch (e: any) {
      showNotification(`Fout bij verwijderen: ${e.message}`, 'error');
    }
  };

  // —————————————————
  // Prijzen
  // —————————————————
  const handleAddTrophy = async (newTrophy: Omit<Trophy, 'id'>) => {
    try {
      await addTrophy(newTrophy);
      showNotification('Prijs succesvol toegevoegd aan de kast! 🏆', 'success');
      fetchData();
    } catch (e: any) {
      showNotification(`Fout bij prijs toevoegen: ${e.message}`, 'error');
      throw e;
    }
  };

  const handleDeleteTrophy = async (id: string) => {
    try {
      await deleteTrophy(id);
      setTrophies((prev) => prev.filter((t) => t.id !== id));
      showNotification('Prijs verwijderd.', 'success');
    } catch (e: any) {
      showNotification(`Fout bij verwijderen: ${e.message}`, 'error');
    }
  };

  // —————————————————
  // View / selectie
  // —————————————————
  const handleSelectPlayer = (playerId: number) => {
    setSelectedPlayerId(playerId);
    setCurrentView('playerDetail');
  };

  // —————————————————
  // Login voor beheer
  // —————————————————
  const handleLogin = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsManagementAuthenticated(true);
      return true;
    }
    return false;
  };

  // 🔐 Alleen bij opslaan om wachtwoord vragen
  const requireAdmin = (): boolean => {
    if (isManagementAuthenticated) return true;

    const password = window.prompt(
      'Voer het beheerderswachtwoord in om deze wedstrijd op te slaan:'
    );

    if (!password) return false;

    if (password === ADMIN_PASSWORD) {
      setIsManagementAuthenticated(true);
      return true;
    }

    alert('Onjuist wachtwoord. Wedstrijd is niet opgeslagen.');
    return false;
  };

  // —————————————————
  // Handmatige invoer opslaan
  // —————————————————
  const handleSaveManualEntry = async (data: {
    date: string;
    teams: Player[][];
    round1Results: MatchResult[];
    round2Results: MatchResult[];
  }) => {
    if (!requireAdmin()) return; // 🔐

    setActionInProgress('savingManual');
    await handleSaveSession(data);
    setActionInProgress(null);
  };

  // —————————————————
  // Competitienaam
  // —————————————————
  const handleSetCompetitionName = async (name: string) => {
    try {
      await setCompetitionNameService(name);
      setCompetitionName(name);
      showNotification('Competitienaam opgeslagen!', 'success');
    } catch (e: any) {
      showNotification(`Fout bij opslaan: ${e.message}`, 'error');
    }
  };

  // —————————————————
  // Hoofd “Wedstrijd”-view
  // —————————————————
  const renderMainView = () => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8">
          <AttendanceParser onParse={handleParseAttendance} />
          <PlayerList
            players={players}
            attendingPlayerIds={attendingPlayerIds}
            onPlayerToggle={handlePlayerToggle}
          />
          <TeamConstraints
            attendingPlayers={attendingPlayers}
            constraints={constraints}
            onAddConstraint={handleAddConstraint}
            onRemoveConstraint={handleRemoveConstraint}
          />
        </div>
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              Start Wedstrijd
            </h2>
            <div className="flex items-center mb-4">
              <UsersIcon className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-lg font-semibold text-white">
                {attendingPlayers.length}
              </span>
              <span className="text-gray-400 ml-1">spelers aanwezig</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleGenerateTeams('simple')}
                disabled={
                  actionInProgress === 'generating' ||
                  attendingPlayers.length < 2
                }
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                1 Wedstrijd
              </button>
              <button
                onClick={() => handleGenerateTeams('tournament')}
                disabled=
                  {actionInProgress === 'generating' ||
                  attendingPlayers.length < 4}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors	duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Toernooi
              </button>
              <button
                onClick={() => handleGenerateTeams('doubleHeader')}
                disabled={
                  actionInProgress === 'generating' ||
                  attendingPlayers.length < 2
                }
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors	duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                2 Wedstrijden
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Klik voor 1x50min op 1 wedstrijd. Voor 8-10 spelers klik op 2
              wedstrijden. Voor 16-30 spelers klik op toernooi.
            </p>
          </div>

          {actionInProgress === 'generating' ? (
            <div className="mt-8 flex justify-center p-8 bg-gray-800 rounded-xl">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative w-16 h-16">
                  <FutbolIcon className="w-16 h-16 text-cyan-400 bounceball-loader" />
                </div>
                <p className="mt-4 text-lg font-semibold text-white animate-pulse">
                  Teams worden gemaakt...
                </p>
                <p className="text-sm text-gray-400">
                  De AI zoekt naar de perfecte balans.
                </p>
              </div>
            </div>
          ) : (
            <TeamDisplay
              teams={teams}
              teams2={teams2}
              gameMode={gameMode}
              currentRound={currentRound}
              round1Results={round1Results}
              round2Pairings={round2Pairings}
              goalScorers={goalScorers}
              onGoalChange={handleGoalChange}
              onSaveRound1={handleSaveRound1}
              onSaveFinalResults={handleSaveFinalResults}
              onSaveSimpleMatch={handleSaveSimpleMatch}
              onStartSecondDoubleHeaderMatch={handleStartSecondDoubleHeaderMatch}
              onSaveDoubleHeader={handleSaveDoubleHeader}
              onRegenerateTeams={handleRegenerateTeamsForR2}
              actionInProgress={actionInProgress}
            />
          )}
        </div>
      </div>
    </>
  );

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const activeHistory = viewingArchive || history;

  // —————————————————
  // Content router
  // —————————————————
  const renderContent = () => {
    switch (currentView) {
      case 'main':
        return renderMainView();
      case 'rules':
        return <Rules />;
      case 'stats':
        return isManagementAuthenticated ? (
          <Statistics
            history={activeHistory}
            players={players}
            onSelectPlayer={handleSelectPlayer}
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        );
      case 'history':
        // 👇 Geschiedenis is altijd zichtbaar,
        // maar HistoryView krijgt te horen of je beheerder bent voor de delete-knop
        return (
          <HistoryView
            history={activeHistory}
            players={players}
            isAuthenticated={isManagementAuthenticated}
            onDeleteSession={(date) =>
              alert(
                'De verwijder-functie is nog niet ingesteld in de backend.'
              )
            }
          />
        );
      case 'playerManagement':
        return isManagementAuthenticated ? (
          <PlayerManagement
            players={players}
            onAdd={handleAddPlayer}
            onUpdate={handleUpdatePlayer}
            onDelete={handleDeletePlayer}
            isLoading={!!actionInProgress}
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        );
      case 'playerDetail':
        return selectedPlayer ? (
          <PlayerDetail
            player={selectedPlayer}
            history={activeHistory}
            players={players}
            ratingLogs={ratingLogs}
            trophies={trophies}
            onBack={() => setCurrentView('stats')}
          />
        ) : (
          <p>Speler niet gevonden.</p>
        );
      case 'manualEntry':
        return (
          <ManualEntry
            allPlayers={players}
            onSave={handleSaveManualEntry}
            isLoading={actionInProgress === 'savingManual'}
          />
        );
      case 'competitionManagement':
        return isManagementAuthenticated ? (
          <CompetitionManagement
            currentHistory={history}
            onViewArchive={(archive) => {
              setViewingArchive(archive);
              setCurrentView('stats');
              showNotification(
                `Archief geladen. Statistieken worden nu weergegeven voor dit archief. Ga naar 'Wedstrijd' om terug te keren.`,
                'success'
              );
            }}
            onRefresh={() => {
              showNotification(
                'Gegevens worden opnieuw geladen...',
                'success'
              );
              fetchData();
              setCurrentView('main');
            }}
            currentCompetitionName={competitionName}
            onSetCompetitionName={handleSetCompetitionName}
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        );
      case 'trophyRoom':
        return (
          <TrophyRoom
            trophies={trophies}
            players={players}
            isAuthenticated={isManagementAuthenticated}
            onAddTrophy={handleAddTrophy}
            onDeleteTrophy={handleDeleteTrophy}
          />
        );
      default:
        return <p>Ongeldige weergave</p>;
    }
  };

  // —————————————————
  // Navigatieknop component
  // —————————————————
  const NavItem: React.FC<{
    view: View;
    label: string;
    icon: React.ReactNode;
    isProtected?: boolean;
    colorClass?: string;
  }> = ({ view, label, icon, isProtected, colorClass = 'bg-gray-700' }) => (
    <button
      onClick={() => {
        if (view === 'main') setViewingArchive(null);
        setCurrentView(view);
      }}
      className={`group flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 active:scale-95 ${
        currentView === view ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
    >
      <div
        className={`relative p-3 rounded-2xl shadow-lg mb-1 transition-transform group-hover:scale-110 ${colorClass}`}
      >
        {isProtected && (
          <LockIcon className="w-3 h-3 text-white absolute top-0 right-0 -mt-1 -mr-1 drop-shadow-md" />
        )}
        <div className="text-white drop-shadow-sm">{icon}</div>
      </div>
      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">
        {label}
      </span>
    </button>
  );

  // —————————————————
  // Loading / error states
  // —————————————————
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <img
            src="https://i.postimg.cc/XJy7yfJ2/bounceball.png"
            alt="Laden..."
            className="w-32 h-auto mx-auto mb-6 animate-bounce"
          />
          <p className="text-xl font-semibold animate-pulse">
            Gegevens laden...
          </p>
        </div>
      </div>
    );
  }

  if (error || players.length === 0) {
    const guideError =
      error ||
      "De app kon verbinding maken, maar heeft geen spelers gevonden. Dit is de meest voorkomende oorzaak van een 'leeg' scherm. Volg de stappen in de Koppelingsassistent om het probleem op te lossen.";
    return <SetupGuide error={guideError} onRetry={fetchData} />;
  }

  // —————————————————
  // Hoofd-render
  // —————————————————
  return (
    <div className="min-h-screen text-white pb-8">
      <div className="container mx-auto p-4 md:p-6">
        <Header competitionName={competitionName} />

        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg max-w-sm animate-fade-in-out whitespace-pre-line ${
              notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {notification.message}
          </div>
        )}

        {viewingArchive && (
          <div
            className="bg-amber-800/50 border border-amber-700 text-amber-200 px-4 py-3 rounded-lg relative mb-6 text-center"
            role="alert"
          >
            <strong className="font-bold">Archiefmodus:</strong>
            <span className="ml-2">
              Je bekijkt een gearchiveerde competitie. Ga naar het 'Wedstrijd'
              tabblad om terug te keren naar de live data.
            </span>
          </div>
        )}

        {/* --- NAVIGATIE: 2 x 4 GRID (RAINBOW COLORS) --- */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 mb-8 shadow-xl border border-gray-700/50">
          <div className="grid grid-cols-4 gap-x-6 gap-y-6 justify-items-center">
            {/* Rood */}
            <NavItem
              view="main"
              label="Wedstrijd"
              icon={<FutbolIcon className="w-6 h-6" />}
              colorClass="bg-gradient-to-br from-red-400 to-red-700"
            />

            {/* Oranje */}
            <NavItem
              view="rules"
              label="Regels"
              icon={<BookOpenIcon className="w-6 h-6" />}
              colorClass="bg-gradient-to-br from-orange-300 to-orange-700"
            />

            {/* Geel */}
            <NavItem
              view="stats"
              label="Statistieken"
              icon={<UsersIcon className="w-6 h-6" />}
              isProtected
              colorClass="bg-gradient-to-br from-yellow-300 to-yellow-600"
            />

            {/* Groen – NIET meer protected */}
            <NavItem
              view="history"
              label="Geschiedenis"
              icon={<ClockIcon className="w-6 h-6" />}
              colorClass="bg-gradient-to-br from-green-300 to-green-700"
            />

            {/* Blauw */}
            <NavItem
              view="trophyRoom"
              label="Prijzen"
              icon={<TrophyIcon className="w-6 h-6" />}
              colorClass="bg-gradient-to-br from-blue-300 to-blue-700"
            />

            {/* Indigo */}
            <NavItem
              view="manualEntry"
              label="Invoer"
              icon={<EditIcon className="w-6 h-6" />}
              colorClass="bg-gradient-to-br from-indigo-300 to-indigo-700"
            />

            {/* Violet */}
            <NavItem
              view="playerManagement"
              label="Spelers"
              icon={<EditIcon className="w-6 h-6" />}
              isProtected
              colorClass="bg-gradient-to-br from-purple-300 to-purple-700"
            />

            {/* Roze */}
            <NavItem
              view="competitionManagement"
              label="Beheer"
              icon={<ArchiveIcon className="w-6 h-6" />}
              isProtected
              colorClass="bg-gradient-to-br from-pink-300 to-pink-700"
            />
          </div>
        </div>

        <main>{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
