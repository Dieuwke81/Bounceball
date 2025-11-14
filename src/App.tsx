import React, { useState, useEffect, useCallback } from 'react';
import type { Player, Match, MatchResult, Goal, GameSession, NewPlayer, Constraint } from './types';
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
import { getInitialData, saveGameSession, addPlayer, updatePlayer, deletePlayer, setCompetitionName as setCompetitionNameService } from './services/googleSheetService';
import TrophyIcon from './components/icons/TrophyIcon';
import UsersIcon from './components/icons/UsersIcon';
import ClockIcon from './components/icons/ClockIcon';
import EditIcon from './components/icons/EditIcon';
import ArchiveIcon from './components/icons/ArchiveIcon';
import LoadingSpinner from './components/LoadingSpinner';
import LoginScreen from './components/LoginScreen';
import LockIcon from './components/icons/LockIcon';
import FutbolIcon from './components/icons/FutbolIcon';

type View = 'main' | 'stats' | 'history' | 'playerManagement' | 'playerDetail' | 'manualEntry' | 'competitionManagement';
type Notification = { message: string; type: 'success' | 'error' };
type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

// ============================================================================
// WACHTWOORD BEVEILIGING
// Pas hier het wachtwoord aan voor de beveiligde tabbladen.
// ============================================================================
const ADMIN_PASSWORD = 'bounce';
// ============================================================================


const calculateRatingDeltas = (results: MatchResult[], currentTeams: Player[][]): { [key: number]: number } => {
    const ratingChanges: { [key: number]: number } = {};
    const ratingDelta = 0.1;

    results.forEach(match => {
        const team1 = currentTeams[match.team1Index];
        const team2 = currentTeams[match.team2Index];
        if (!team1 || !team2) return;

        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        if (team1Score > team2Score) { // Team 1 wins
            team1.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) + ratingDelta);
            team2.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) - ratingDelta);
        } else if (team2Score > team1Score) { // Team 2 wins
            team1.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) - ratingDelta);
            team2.forEach(p => ratingChanges[p.id] = (ratingChanges[p.id] || 0) + ratingDelta);
        }
    });

    return ratingChanges;
};


const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<GameSession[]>([]);
  const [attendingPlayerIds, setAttendingPlayerIds] = useState<Set<number>>(new Set());
  const [teams, setTeams] = useState<Player[][]>([]);
  const [originalTeams, setOriginalTeams] = useState<Player[][] | null>(null);
  const [teams2, setTeams2] = useState<Player[][] | null>(null);
  const [currentRound, setCurrentRound] = useState(0); // 0: not started, 1: round 1, 2: round 2
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


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { players, history, competitionName: name } = await getInitialData();
      setPlayers(players);
      setHistory(history);
      setCompetitionName(name || null);
    } catch (e: any) {
      setError(e.message || "Er is een onbekende fout opgetreden bij het laden van de gegevens.");
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
    setAttendingPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const handleParseAttendance = (text: string) => {
    const normalize = (str: string): string =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .trim();

    const lines = text.split('\n');
    const parsedNamesAndOriginals = new Map<string, string>();

    lines.forEach(line => {
      const cleanedName = line
        .replace(/^\s*\d+\.?\s*/, '')
        .replace(/[\(\[].*?[\)\]]/g, '')
        .trim();

      if (!cleanedName) {
        return;
      }
      
      // New logic to ignore date lines but allow names with a single number.
      // A date line like "18 november 20:30" will have multiple numbers.
      // A name like "Player 2" will have only one.
      const numberMatches = cleanedName.match(/\d+/g);
      if (numberMatches && numberMatches.length > 1) {
        // Contains multiple numbers, likely a date/time stamp, so ignore it.
        return;
      }

      parsedNamesAndOriginals.set(normalize(cleanedName), cleanedName);
    });

    if (parsedNamesAndOriginals.size === 0) {
      showNotification('Geen geldige namen gevonden in de tekst.', 'error');
      return;
    }

    const playerLookup = new Map<string, Player>();
    players.forEach(player => {
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
    
    parsedNamesAndOriginals.forEach((originalName, normalizedName) => {
      const matchedPlayer = playerLookup.get(normalizedName);
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
        message += `${newlyFoundPlayers.length} speler(s) toegevoegd: ${newlyFoundPlayers.join(', ')}.`;
      }

      if (notFoundOriginalNames.length > 0) {
        message += `${message ? '\n' : ''}Niet herkend: ${notFoundOriginalNames.join(', ')}.`;
        type = 'error';
      }
      showNotification(message, type);
    } else if (parsedNamesAndOriginals.size > 0) {
      showNotification('Alle spelers uit de lijst waren al aangemeld.', 'success');
    }
  };
  
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
  };

  const attendingPlayers = players.filter(p => attendingPlayerIds.has(p.id));

  const handleGenerateTeams = async (mode: GameMode) => {
    resetGameState();
    setGameMode(mode);
    const numberOfTeams = mode === 'simple' || mode === 'doubleHeader' ? 2 : (attendingPlayers.length <= 14 ? 2 : 4);
    
    if (attendingPlayers.length < numberOfTeams) {
        showNotification(`Niet genoeg spelers voor ${numberOfTeams} teams.`, 'error');
        return;
    }

    setActionInProgress('generating');
    try {
        const generated = await generateTeams(attendingPlayers, numberOfTeams, constraints);
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

  const handleGoalChange = (matchIndex: number, teamIdentifier: 'team1' | 'team2', playerId: number, count: number) => {
    const key = `${matchIndex}-${teamIdentifier}`;
    setGoalScorers(prev => {
      const newGoals = [...(prev[key] || [])];
      const existingGoalIndex = newGoals.findIndex(g => g.playerId === playerId);

      if (count > 0) {
        if (existingGoalIndex > -1) {
          newGoals[existingGoalIndex] = { ...newGoals[existingGoalIndex], count };
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
  
  const handleSaveSession = async (sessionData: {
      date: string;
      teams: Player[][];
      round1Results: MatchResult[];
      round2Results: MatchResult[];
  }) => {
      const allResults = [...sessionData.round1Results, ...sessionData.round2Results];
      const ratingChanges = calculateRatingDeltas(allResults, sessionData.teams);
      const updatedRatings = players
          .filter(p => ratingChanges[p.id] !== undefined)
          .map(p => ({
              id: p.id,
              rating: Math.max(1, parseFloat((p.rating + ratingChanges[p.id]).toFixed(2))),
          }));
      
      try {
          await saveGameSession(sessionData, updatedRatings);
          showNotification('Sessie en ratings succesvol opgeslagen!', 'success');
          setPlayers(prevPlayers => prevPlayers.map(p => {
              const update = updatedRatings.find(u => u.id === p.id);
              return update ? { ...p, rating: update.rating } : p;
          }));
          setHistory(prevHistory => [sessionData, ...prevHistory]);
          resetGameState();
          setAttendingPlayerIds(new Set());
      } catch (e: any) {
          showNotification(`Fout bij opslaan: ${e.message}`, 'error');
      }
  };


  const handleSaveRound1 = (matches: Match[]) => {
    const results: MatchResult[] = matches.map((match, index): MatchResult => ({
      ...match,
      team1Goals: goalScorers[`${index}-team1`] || [],
      team2Goals: goalScorers[`${index}-team2`] || [],
    }));
    
    setRound1Results(results);

    const teamPoints: { teamIndex: number; points: number; goalDifference: number; goalsFor: number }[] = [];
    teams.forEach((_, index) => {
        teamPoints.push({ teamIndex: index, points: 0, goalDifference: 0, goalsFor: 0 });
    });

    results.forEach(result => {
        const team1Score = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = result.team2Goals.reduce((sum, g) => sum + g.count, 0);
        const team1 = teamPoints.find(t => t.teamIndex === result.team1Index)!;
        const team2 = teamPoints.find(t => t.teamIndex === result.team2Index)!;

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

    teamPoints.sort((a, b) => 
        b.points - a.points || 
        b.goalDifference - a.goalDifference || 
        b.goalsFor - a.goalsFor ||
        a.teamIndex - b.teamIndex
    );
    
    const newPairings = [];
    for(let i = 0; i < teamPoints.length; i += 2) {
        if(teamPoints[i+1]) {
            newPairings.push({
                team1Index: teamPoints[i].teamIndex,
                team2Index: teamPoints[i+1].teamIndex,
            });
        }
    }

    setRound2Pairings(newPairings);
    setGoalScorers({});
    setCurrentRound(2);
  };
  
  const handleRegenerateTeamsForR2 = async () => {
    if (!originalTeams) return;
    setActionInProgress('regeneratingTeams');

    try {
        const remainingPlayers = attendingPlayers;

        if (remainingPlayers.length < 4) {
            throw new Error("Niet genoeg spelers over om nieuwe teams te maken (minimaal 4).");
        }

        const numTeams = originalTeams.length;
        if (remainingPlayers.length < numTeams) {
            throw new Error(`Te weinig spelers (${remainingPlayers.length}) om de oorspronkelijke ${numTeams} teams te vullen.`);
        }

        const regeneratedTeams = await generateTeams(remainingPlayers, numTeams, constraints);

        const newPairings = [];
        for (let i = 0; i < regeneratedTeams.length; i += 2) {
            if (regeneratedTeams[i+1]) {
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

  const handleSaveFinalResults = async (matches: Match[]) => {
     setActionInProgress('savingFinal');
     const round2Results: MatchResult[] = matches.map((match, index) => ({
      ...match,
      team1Goals: goalScorers[`${index}-team1`] || [],
      team2Goals: goalScorers[`${index}-team2`] || [],
    }));
    
     await handleSaveSession({
        date: new Date().toISOString(),
        teams: teams,
        round1Results: round1Results,
        round2Results: round2Results
    });
    setActionInProgress(null);
  };

  const handleSaveSimpleMatch = async (match: Match) => {
    setActionInProgress('savingSimple');
    const results: MatchResult[] = [{
      ...match,
      team1Goals: goalScorers['0-team1'] || [],
      team2Goals: goalScorers['0-team2'] || [],
    }];
    await handleSaveSession({
        date: new Date().toISOString(),
        teams: teams,
        round1Results: results,
        round2Results: []
    });
    setActionInProgress(null);
  };
  
  const handleStartSecondDoubleHeaderMatch = async (match1Result: MatchResult) => {
    setActionInProgress('generating');
    try {
        const allPlayers = teams.flat();
        const regeneratedTeams = await generateTeams(allPlayers, 2, constraints, teams);
        
        if (!regeneratedTeams || regeneratedTeams.length === 0) {
            throw new Error("Kon geen unieke teamindeling genereren.");
        }
        
        setTeams2(regeneratedTeams);
        setRound1Results([match1Result]);
        setGoalScorers({});
        setCurrentRound(2);
    } catch(e: any) {
        showNotification(e.message, 'error');
    } finally {
        setActionInProgress(null);
    }
  }
  
  const handleSaveDoubleHeader = async (match2Result: MatchResult) => {
      setActionInProgress('savingDouble');
      if (!originalTeams || !teams2) {
          showNotification("Team data ontbreekt.", 'error');
          setActionInProgress(null);
          return;
      }
      await handleSaveSession({
          date: new Date().toISOString(),
          teams: originalTeams,
          round1Results: round1Results,
          round2Results: []
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await handleSaveSession({
          date: new Date().toISOString(),
          teams: teams2,
          round1Results: [match2Result],
          round2Results: []
      });
      setActionInProgress(null);
  }
  
  const handleAddConstraint = (constraint: Constraint) => {
      setConstraints(prev => [...prev, constraint]);
  };

  const handleRemoveConstraint = (index: number) => {
      setConstraints(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleAddPlayer = async (newPlayer: NewPlayer) => {
    try {
        const { newId } = await addPlayer(newPlayer);
        const playerWithId: Player = { ...newPlayer, id: newId };
        setPlayers(prev => [...prev, playerWithId].sort((a,b) => a.name.localeCompare(b.name)));
        showNotification(`${newPlayer.name} succesvol toegevoegd!`, 'success');
    } catch(e: any) {
        showNotification(`Fout bij toevoegen: ${e.message}`, 'error');
    }
  };

  const handleUpdatePlayer = async (updatedPlayer: Player) => {
    try {
        await updatePlayer(updatedPlayer);
        setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
        showNotification(`${updatedPlayer.name} succesvol bijgewerkt!`, 'success');
    } catch(e: any) {
        showNotification(`Fout bij bijwerken: ${e.message}`, 'error');
    }
  };

  const handleDeletePlayer = async (id: number) => {
    try {
        await deletePlayer(id);
        setPlayers(prev => prev.filter(p => p.id !== id));
        setAttendingPlayerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
        showNotification(`Speler succesvol verwijderd.`, 'success');
    } catch(e: any) {
        showNotification(`Fout bij verwijderen: ${e.message}`, 'error');
    }
  };
  
  const handleSelectPlayer = (playerId: number) => {
    setSelectedPlayerId(playerId);
    setCurrentView('playerDetail');
  };
  
  const handleLogin = (password: string): boolean => {
      if (password === ADMIN_PASSWORD) {
          setIsManagementAuthenticated(true);
          return true;
      }
      return false;
  };
  
  const handleSaveManualEntry = async (data: {
    date: string;
    teams: Player[][];
    round1Results: MatchResult[];
    round2Results: MatchResult[];
  }) => {
      setActionInProgress('savingManual');
      await handleSaveSession(data);
      setActionInProgress(null);
  }

  const handleSetCompetitionName = async (name: string) => {
    try {
        await setCompetitionNameService(name);
        setCompetitionName(name);
        showNotification('Competitienaam opgeslagen!', 'success');
    } catch(e: any) {
        showNotification(`Fout bij opslaan: ${e.message}`, 'error');
    }
  };


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
              <h2 className="text-2xl font-bold text-white mb-4">Start Wedstrijd</h2>
               <div className="flex items-center mb-4">
                 <UsersIcon className="w-5 h-5 text-gray-400 mr-2" />
                 <span className="text-lg font-semibold text-white">{attendingPlayers.length}</span>
                 <span className="text-gray-400 ml-1">spelers aanwezig</span>
               </div>
               
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleGenerateTeams('simple')}
                    disabled={actionInProgress === 'generating' || attendingPlayers.length < 2}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                    1 Wedstrijd
                  </button>
                  <button
                    onClick={() => handleGenerateTeams('tournament')}
                    disabled={actionInProgress === 'generating' || attendingPlayers.length < 4}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                    Toernooi
                  </button>
                  <button
                    onClick={() => handleGenerateTeams('doubleHeader')}
                    disabled={actionInProgress === 'generating' || attendingPlayers.length < 2}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                    Twee Wedstrijden
                  </button>
              </div>
               <p className="text-xs text-gray-500 mt-3 text-center">
                   Voor een toernooi zijn minimaal 4 spelers nodig.
               </p>
           </div>
        </div>
      </div>
      
      {actionInProgress === 'generating' ? (
        <div className="mt-8 flex justify-center">
            <LoadingSpinner />
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

    </>
  );

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);
  const activeHistory = viewingArchive || history;

  const renderContent = () => {
    switch(currentView) {
      case 'main':
        return renderMainView();
      case 'stats':
        return isManagementAuthenticated ? (
          <Statistics history={activeHistory} players={players} onSelectPlayer={handleSelectPlayer} />
        ) : <LoginScreen onLogin={handleLogin} />;
      case 'history':
        return <HistoryView history={activeHistory} players={players} />;
      case 'playerManagement':
        return isManagementAuthenticated ? (
            <PlayerManagement players={players} onAdd={handleAddPlayer} onUpdate={handleUpdatePlayer} onDelete={handleDeletePlayer} isLoading={!!actionInProgress} />
        ) : <LoginScreen onLogin={handleLogin} />;
      case 'playerDetail':
          return selectedPlayer ? <PlayerDetail player={selectedPlayer} history={activeHistory} players={players} onBack={() => setCurrentView(viewingArchive ? 'stats' : 'stats')} /> : <p>Speler niet gevonden.</p>;
      case 'manualEntry':
         return <ManualEntry allPlayers={players} onSave={handleSaveManualEntry} isLoading={actionInProgress === 'savingManual'} />;
      case 'competitionManagement':
        return isManagementAuthenticated ? (
            <CompetitionManagement 
                currentHistory={history} 
                onViewArchive={(archive) => {
                    setViewingArchive(archive);
                    setCurrentView('stats');
                    showNotification(`Archief geladen. Statistieken worden nu weergegeven voor dit archief. Ga naar 'Wedstrijd' om terug te keren.`, 'success');
                }}
                onRefresh={() => {
                   showNotification('Gegevens worden opnieuw geladen...', 'success');
                   fetchData();
                   setCurrentView('main');
                }}
                currentCompetitionName={competitionName}
                onSetCompetitionName={handleSetCompetitionName}
            />
        ) : <LoginScreen onLogin={handleLogin} />;
      default:
        return <p>Ongeldige weergave</p>;
    }
  };

  const NavItem: React.FC<{view: View, label: string, icon: React.ReactNode, isProtected?: boolean}> = ({ view, label, icon, isProtected }) => (
    <button
      onClick={() => {
        if (view === 'main') setViewingArchive(null);
        setCurrentView(view);
      }}
      className={`relative flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${currentView === view ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
    >
      {isProtected && <LockIcon className="w-3 h-3 text-amber-400 absolute -top-1 -right-1" />}
      {icon}
      <span>{label}</span>
    </button>
  );

  if (isLoading && players.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
            <FutbolIcon className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold animate-pulse">Gegevens laden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white p-4">
        <div className="bg-red-900/50 border border-red-700 p-8 rounded-lg text-center max-w-2xl">
            <h2 className="text-2xl font-bold text-red-300 mb-4">Oeps! Er is iets misgegaan.</h2>
            <p className="text-red-200 mb-6">{error}</p>
            <button
                onClick={() => fetchData()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
            >
                Probeer opnieuw
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto p-4 md:p-6">
        <Header competitionName={competitionName} />
        
         {notification && (
            <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg max-w-sm animate-fade-in-out whitespace-pre-line ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {notification.message}
            </div>
         )}
         
         {viewingArchive && (
            <div className="bg-amber-800/50 border border-amber-700 text-amber-200 px-4 py-3 rounded-lg relative mb-6 text-center" role="alert">
                <strong className="font-bold">Archiefmodus:</strong>
                <span className="ml-2">Je bekijkt een gearchiveerde competitie. Ga naar het 'Wedstrijd' tabblad om terug te keren naar de live data.</span>
            </div>
         )}

        <nav className="mb-8 p-2 bg-gray-800 rounded-xl shadow-lg flex justify-around items-center flex-wrap gap-2">
          <NavItem view="main" label="Wedstrijd" icon={<TrophyIcon className="w-6 h-6" />} />
          <NavItem view="stats" label="Statistieken" icon={<UsersIcon className="w-6 h-6" />} isProtected />
          <NavItem view="history" label="Geschiedenis" icon={<ClockIcon className="w-6 h-6" />} />
          <NavItem view="playerManagement" label="Spelersbeheer" icon={<EditIcon className="w-6 h-6" />} isProtected />
          <NavItem view="manualEntry" label="Handmatige Invoer" icon={<EditIcon className="w-6 h-6" />} />
          <NavItem view="competitionManagement" label="Competitiebeheer" icon={<ArchiveIcon className="w-6 h-6" />} isProtected />
        </nav>
        
        <main>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;