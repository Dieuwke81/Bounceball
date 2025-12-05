import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Player, Goal, Match, MatchResult } from '../types';
import EditIcon from './icons/EditIcon';

interface ManualEntryProps {
  allPlayers: Player[];
  onSave: (data: {
    date: string;
    teams: Player[][];
    round1Results: MatchResult[];
    round2Results: MatchResult[];
  }) => void;
  isLoading: boolean;
}

const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const UNSAVED_MANUAL_KEY = 'bounceball_unsaved_manual_entry';

// ============================================================================
// SCORE INPUT COMPONENT
// ============================================================================
const ScoreInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setLocalValue(val);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localValue === '0') {
        setLocalValue('');
    } else {
        e.target.select();
    }
  };

  const handleBlur = () => {
    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 0;
    
    if (num !== value) {
      onChange(num);
    }
    setLocalValue(num.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder="0"
    />
  );
};

// ============================================================================
// HELPER FUNCTIONS & CHIPS
// ============================================================================

const generatePairingsWithoutRematches = (
  sortedTeams: { teamIndex: number; [key: string]: any }[],
  r1Matches: Match[]
): Match[] => {
  const pairings: Match[] = [];
  const available = [...sortedTeams];
  const r1Opponents = new Map<number, number>();
  r1Matches.forEach(match => {
    r1Opponents.set(match.team1Index, match.team2Index);
    r1Opponents.set(match.team2Index, match.team1Index);
  });

  while (available.length > 0) {
    const team1 = available.shift();
    if (!team1) break;

    let team2: { teamIndex: number; [key: string]: any } | undefined;
    let opponentIndexInAvailable = -1;

    for (let i = 0; i < available.length; i++) {
      const potentialOpponent = available[i];
      if (r1Opponents.get(team1.teamIndex) !== potentialOpponent.teamIndex) {
        team2 = potentialOpponent;
        opponentIndexInAvailable = i;
        break;
      }
    }
    
    if (team2 && opponentIndexInAvailable !== -1) {
      available.splice(opponentIndexInAvailable, 1);
    } else {
      team2 = available.shift();
    }

    if (team2) {
      pairings.push({ team1Index: team1.teamIndex, team2Index: team2.teamIndex });
    }
  }
  return pairings;
};


const PlayerChip: React.FC<{player: Player}> = ({ player }) => (
    <div className="bg-green-800/50 flex items-center justify-between text-sm text-green-200 px-2 py-1 rounded">
        <span>{player.name}</span>
    </div>
);

const UnmatchedChip: React.FC<{name: string}> = ({ name }) => (
    <div className="bg-red-800/50 text-sm text-red-200 px-2 py-1 rounded">
        {name}
    </div>
);

const MatchInput: React.FC<{
    match: Match;
    matchIndex: number;
    teams: Player[][];
    onGoalChange: (matchIndex: number, teamIdentifier: 'team1' | 'team2', playerId: number, count: number) => void;
    goalScorers: {[key: string]: Goal[]};
}> = ({ match, matchIndex, teams, onGoalChange, goalScorers }) => {
    
    const team1 = teams[match.team1Index];
    const team2 = teams[match.team2Index];

    const getTeamGoals = (teamIdentifier: 'team1' | 'team2') => goalScorers[`${matchIndex}-${teamIdentifier}`] || [];
    const getTeamScore = (teamIdentifier: 'team1' | 'team2') => getTeamGoals(teamIdentifier).reduce((sum, goal) => sum + goal.count, 0);

    const PlayerGoalInput: React.FC<{player: Player, teamIdentifier: 'team1' | 'team2'}> = ({ player, teamIdentifier }) => {
        const goals = getTeamGoals(teamIdentifier);
        const goalCount = goals.find(g => g.playerId === player.id)?.count || 0;

        return (
            <div className="flex items-center justify-between space-x-2 bg-gray-600 p-2 rounded">
                {/* AANGEPAST: truncate verwijderd, flex-1 toegevoegd zodat de naam de ruimte pakt */}
                <span className="text-gray-200 flex-1 pr-2 text-sm sm:text-base">{player.name}</span>
                <ScoreInput
                    value={goalCount}
                    onChange={(newVal) => onGoalChange(matchIndex, teamIdentifier, player.id, newVal)}
                    className="w-12 bg-gray-700 border border-gray-500 rounded-md py-1 px-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
            </div>
        )
    }

    return (
        <div className="bg-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <div className="text-center">
                        <h4 className={`font-bold text-lg text-cyan-300`}>Team {match.team1Index + 1}</h4>
                        <p className="text-3xl font-bold text-white">{getTeamScore('team1')}</p>
                    </div>
                    <div className="space-y-2 pr-1 max-h-60 overflow-y-auto">
                        {team1 && team1.map(p => <PlayerGoalInput key={p.id} player={p} teamIdentifier="team1" />)}
                    </div>
                </div>
                <div className="space-y-3">
                     <div className="text-center">
                        <h4 className={`font-bold text-lg text-amber-300`}>Team {match.team2Index + 1}</h4>
                        <p className="text-3xl font-bold text-white">{getTeamScore('team2')}</p>
                    </div>
                    <div className="space-y-2 pr-1 max-h-60 overflow-y-auto">
                        {team2 && team2.map(p => <PlayerGoalInput key={p.id} player={p} teamIdentifier="team2" />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MatchResultDisplayCard: React.FC<{
    matchResult: MatchResult;
}> = ({ matchResult }) => {
    const team1Score = matchResult.team1Goals.reduce((sum, goal) => sum + goal.count, 0);
    const team2Score = matchResult.team2Goals.reduce((sum, goal) => sum + goal.count, 0);
    const team1Name = `Team ${matchResult.team1Index + 1}`;
    const team2Name = `Team ${matchResult.team2Index + 1}`;

    return (
        <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center text-center">
                <div className="w-2/5">
                    <h4 className="font-semibold text-base truncate text-gray-400">{team1Name}</h4>
                </div>
                <div className="w-1/5">
                    <p className="text-2xl font-bold text-white/90">
                        {team1Score} - {team2Score}
                    </p>
                </div>
                <div className="w-2/5">
                    <h4 className="font-semibold text-base truncate text-gray-400">{team2Name}</h4>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ManualEntry: React.FC<ManualEntryProps> = ({ allPlayers, onSave, isLoading }) => {
  const [round, setRound] = useState(0); 
  const [teamTextR1, setTeamTextR1] = useState<string[]>(Array(6).fill(''));
  const [teamTextR2, setTeamTextR2] = useState<string[]>(Array(6).fill(''));
  const [round1Teams, setRound1Teams] = useState<Player[][] | null>(null);
  const [numMatches, setNumMatches] = useState(1); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualRound2, setManualRound2] = useState(false);
  const [goalScorers, setGoalScorers] = useState<{ [key: string]: Goal[] }>({});
  const [round1Results, setRound1Results] = useState<MatchResult[]>([]);
  const [round2Pairings, setRound2Pairings] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- LOCAL STORAGE LOGIC ---
  // 1. Load on mount
  useEffect(() => {
    const saved = localStorage.getItem(UNSAVED_MANUAL_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (window.confirm("Er is een niet-opgeslagen handmatige invoer gevonden. Wil je deze herstellen?")) {
            setRound(parsed.round || 0);
            setTeamTextR1(parsed.teamTextR1 || Array(6).fill(''));
            setTeamTextR2(parsed.teamTextR2 || Array(6).fill(''));
            setRound1Teams(parsed.round1Teams || null);
            setNumMatches(parsed.numMatches || 1);
            setDate(parsed.date || new Date().toISOString().split('T')[0]);
            setManualRound2(parsed.manualRound2 || false);
            setGoalScorers(parsed.goalScorers || {});
            setRound1Results(parsed.round1Results || []);
            setRound2Pairings(parsed.round2Pairings || []);
        } else {
            localStorage.removeItem(UNSAVED_MANUAL_KEY);
        }
      } catch (e) {
        console.error("Fout bij laden handmatige invoer", e);
        localStorage.removeItem(UNSAVED_MANUAL_KEY);
      }
    }
  }, []);

  // 2. Save on change
  useEffect(() => {

    const isEmptyState = 
        round === 0 && 
        teamTextR1.every(t => t === '') && 
        teamTextR2.every(t => t === '') &&
        numMatches === 1;

    if (isEmptyState) {
        return; 
    }
    // Alleen opslaan als we niet in de 'init' state zitten om overschrijven bij laden te voorkomen
    // Maar hier is het veilig omdat de load effect 1x draait.
    const stateToSave = {
        round,
        teamTextR1,
        teamTextR2,
        round1Teams,
        numMatches,
        date,
        manualRound2,
        goalScorers,
        round1Results,
        round2Pairings
    };
    localStorage.setItem(UNSAVED_MANUAL_KEY, JSON.stringify(stateToSave));
  }, [round, teamTextR1, teamTextR2, round1Teams, numMatches, date, manualRound2, goalScorers, round1Results, round2Pairings]);
  // ---------------------------
 
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    allPlayers.forEach(p => {
        const normalizedFullName = normalize(p.name);
        const normalizedFirstName = normalizedFullName.split(' ')[0];
        map.set(normalizedFullName, p);
        if (!map.has(normalizedFirstName)) {
            map.set(normalizedFirstName, p);
        }
    });
    return map;
  }, [allPlayers]);

  const parseTeamText = useCallback((textArray: string[]) => {
    const teams: Player[][] = [];
    const unmatched: string[][] = [];
    
    for (let i = 0; i < numMatches * 2; i++) {
        const currentTeam: Player[] = [];
        const currentUnmatched: string[] = [];
        const names = textArray[i].split('\n').map(name => name.trim()).filter(Boolean);
        
        names.forEach(name => {
            const player = playerMap.get(normalize(name));
            if (player) {
                currentTeam.push(player);
            } else {
                currentUnmatched.push(name);
            }
        });
        teams.push(currentTeam);
        unmatched.push(currentUnmatched);
    }
    return { teams, unmatched };
  }, [numMatches, playerMap]);

  const parsedTeamsR1 = useMemo(() => parseTeamText(teamTextR1), [teamTextR1, parseTeamText]);
  const parsedTeamsR2 = useMemo(() => parseTeamText(teamTextR2), [teamTextR2, parseTeamText]);

  const handleTextChange = (round: 1 | 2, index: number, text: string) => {
    const setter = round === 1 ? setTeamTextR1 : setTeamTextR2;
    setter(prev => {
        const newText = [...prev];
        newText[index] = text;
        return newText;
    });
  };

  const handleAddMatch = () => setNumMatches(n => Math.min(3, n + 1));
  const handleRemoveMatch = () => setNumMatches(n => Math.max(1, n - 1));

  const handleStartTournament = () => {
    setError(null);
    const allPlayersEntered = new Set();
    let hasEmptyTeam = false;
    for(let i=0; i < numMatches * 2; i++){
        const team = parsedTeamsR1.teams[i];
        if(team.length === 0) hasEmptyTeam = true;
        team.forEach(p => {
            if(allPlayersEntered.has(p.id)){
                setError(`Speler ${p.name} staat in meerdere teams.`);
            }
            allPlayersEntered.add(p.id);
        });
    }

    if (error) return;
    if (hasEmptyTeam) return setError("Alle teams moeten minimaal één speler hebben.");
    if (parsedTeamsR1.unmatched.some(u => u.length > 0)) return setError("Niet alle spelernamen zijn herkend. Corrigeer de rode namen.");
    
    setRound1Teams(parsedTeamsR1.teams);
    setRound(1);
  }

  const handleGoalChange = useCallback((matchIndex: number, teamIdentifier: 'team1' | 'team2', playerId: number, count: number) => {
    const key = `${matchIndex}-${teamIdentifier}`;
    setGoalScorers(prev => {
        const newGoals = [...(prev[key] || [])];
        const existingGoalIndex = newGoals.findIndex(g => g.playerId === playerId);
        if (count > 0) {
            if (existingGoalIndex > -1) newGoals[existingGoalIndex] = { ...newGoals[existingGoalIndex], count };
            else newGoals.push({ playerId, count });
        } else {
            if (existingGoalIndex > -1) newGoals.splice(existingGoalIndex, 1);
        }
        return { ...prev, [key]: newGoals };
    });
  }, []);

  const handleNextRound = () => {
    const round1MatchesForPairing = Array.from({ length: numMatches }, (_, i) => ({ team1Index: i * 2, team2Index: i * 2 + 1 }));
    const results: MatchResult[] = round1MatchesForPairing.map((match, index): MatchResult => ({
      ...match,
      team1Goals: goalScorers[`${index}-team1`] || [],
      team2Goals: goalScorers[`${index}-team2`] || [],
    }));
    setRound1Results(results);

    if (manualRound2) {
        setGoalScorers({});
        setRound(1.8);
        return;
    }

    // Automatic pairing logic for tournament
    const teamPoints: { teamIndex: number; points: number; goalDifference: number; goalsFor: number }[] = Array.from({length: numMatches * 2}, (_, i) => ({ teamIndex: i, points: 0, goalDifference: 0, goalsFor: 0 }));
    results.forEach(result => {
        const team1Score = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = result.team2Goals.reduce((sum, g) => sum + g.count, 0);
        const team1 = teamPoints.find(t => t.teamIndex === result.team1Index)!;
        const team2 = teamPoints.find(t => t.teamIndex === result.team2Index)!;

        team1.goalDifference += team1Score - team2Score; team1.goalsFor += team1Score;
        team2.goalDifference += team2Score - team1Score; team2.goalsFor += team2Score;
        if (team1Score > team2Score) team1.points += 3;
        else if (team2Score > team1Score) team2.points += 3;
        else { team1.points += 1; team2.points += 1; }
    });
    teamPoints.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamIndex - b.teamIndex);
    const newPairings = generatePairingsWithoutRematches(teamPoints, round1MatchesForPairing);
    setRound2Pairings(newPairings);
    setGoalScorers({});
    setRound(2);
  };

  const handleStartRound2 = () => {
    setError(null);
    if (parsedTeamsR2.unmatched.some(u => u.length > 0)) {
        return setError("Niet alle spelernamen voor ronde 2 zijn herkend. Corrigeer de rode namen.");
    }
    const pairings = Array.from({ length: numMatches }, (_, i) => ({ team1Index: i * 2, team2Index: i * 2 + 1 }));
    setRound2Pairings(pairings);
    setRound(2);
  }

  const handleSave = async () => {
    if (isLoading) return;
    
    if (manualRound2) {
        if (!round1Teams || !parsedTeamsR2.teams.some(t => t.length > 0)) {
            setError("Teamgegevens voor ronde 2 ontbreken."); return;
        }
        const session1 = { date: new Date(date).toISOString(), teams: round1Teams, round1Results, round2Results: [] };
        onSave(session1);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const r2ResultsForSave: MatchResult[] = round2Pairings.map((match, index) => ({
             ...match,
             team1Goals: goalScorers[`${index}-team1`] || [],
             team2Goals: goalScorers[`${index}-team2`] || [],
        }));
        const session2 = { date: new Date().toISOString(), teams: parsedTeamsR2.teams, round1Results: r2ResultsForSave, round2Results: [] };
        onSave(session2);
        
    } else {
        const round2Results: MatchResult[] = round2Pairings.map((match, index) => ({
             ...match,
             team1Goals: goalScorers[`${index}-team1`] || [],
             team2Goals: goalScorers[`${index}-team2`] || [],
        }));
        onSave({ date: new Date(date).toISOString(), teams: round1Teams || parsedTeamsR1.teams, round1Results, round2Results });
    }

    // Clear local storage after successful save
    localStorage.removeItem(UNSAVED_MANUAL_KEY);
  };

  const handleSaveSimpleMatch = () => {
     const results: MatchResult[] = [{
        team1Index: 0, team2Index: 1,
        team1Goals: goalScorers['0-team1'] || [],
        team2Goals: goalScorers['0-team2'] || [],
     }];
     onSave({ date: new Date(date).toISOString(), teams: round1Teams || parsedTeamsR1.teams, round1Results: results, round2Results: [] });
     
     // Clear local storage
     localStorage.removeItem(UNSAVED_MANUAL_KEY);
  }
  

  const renderSetup = (roundNum: 1 | 2) => {
    const isR1 = roundNum === 1;
    const teamText = isR1 ? teamTextR1 : teamTextR2;
    const parsedTeams = isR1 ? parsedTeamsR1 : parsedTeamsR2;
    const title = isR1 ? "Stel Teams voor Ronde 1 Samen" : "Stel Teams voor Ronde 2 Samen";

    return (
        <>
        <h3 className="text-2xl font-bold text-white mb-6">{title}</h3>
        {isR1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
                <div>
                    <label htmlFor="session-date" className="block text-sm font-medium text-gray-300 mb-1">Datum</label>
                    <input type="date" id="session-date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                </div>
                <div className="flex items-center md:justify-end space-x-2">
                    <button onClick={handleRemoveMatch} disabled={numMatches <= 1} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">- Wedstrijd</button>
                    <button onClick={handleAddMatch} disabled={numMatches >= 3} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">+ Wedstrijd</button>
                </div>
                <div className="md:col-span-2 flex items-center">
                    <input id="manual-round-2" type="checkbox" checked={manualRound2} onChange={(e) => setManualRound2(e.target.checked)}
                        className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500" />
                    <label htmlFor="manual-round-2" className="ml-2 text-sm text-gray-300">Volledig nieuwe teams voor ronde 2</label>
                </div>
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Array.from({ length: numMatches }).map((_, matchIndex) => (
                <div key={matchIndex} className="lg:col-span-1 grid grid-cols-2 gap-4 bg-gray-900/50 p-4 rounded-lg">
                    {Array.from({ length: 2 }).map((_, teamInMatchIndex) => {
                        const teamIndex = matchIndex * 2 + teamInMatchIndex;
                        const teamColor = teamInMatchIndex === 0 ? 'text-cyan-400' : 'text-amber-400';
                        return (
                            <div key={teamIndex}>
                                <h3 className={`font-bold mb-2 ${teamColor}`}>Team {teamIndex + 1}</h3>
                                <textarea
                                    value={teamText[teamIndex]}
                                    onChange={e => handleTextChange(roundNum, teamIndex, e.target.value)}
                                    className="w-full h-40 bg-gray-700 border border-gray-600 rounded-md p-2 text-white resize-y"
                                    placeholder="Eén naam per regel..."
                                />
                                <div className="space-y-1 mt-2">
                                    {parsedTeams.teams[teamIndex].map(p => <PlayerChip key={p.id} player={p} />)}
                                    {parsedTeams.unmatched[teamIndex].map(name => <UnmatchedChip key={name} name={name} />)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
        <div className="mt-8">
            <button 
                onClick={isR1 ? handleStartTournament : handleStartRound2} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg" 
                disabled={isLoading}>
                {isR1 ? 'Start Toernooi' : 'Start Ronde 2'}
            </button>
        </div>
        </>
    );
  };

  const renderRound = (currentRound: 1 | 2) => {
    const isFinalRound = currentRound === 2;
    const isSimpleMatch = numMatches === 1;
    const teamsForDisplay = (isFinalRound && manualRound2) ? parsedTeamsR2.teams : (round1Teams || []);
    const currentMatches = isFinalRound ? round2Pairings : Array.from({ length: numMatches }, (_, i) => ({ team1Index: i * 2, team2Index: i * 2 + 1 }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {isFinalRound && round1Results.length > 0 && (
                <div className="lg:col-span-3">
                    <h3 className="text-xl font-bold text-gray-400 mb-4">Resultaten Ronde 1</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {round1Results.map((result, index) => (
                            <MatchResultDisplayCard key={`r1-result-${index}`} matchResult={result} />
                        ))}
                    </div>
                </div>
            )}
            <div className="lg:col-span-3">
                <h3 className="text-xl font-bold text-white mb-4">
                    {isSimpleMatch ? 'Wedstrijduitslag' : `Uitslagen Ronde ${currentRound}`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {currentMatches.map((match, index) => (
                        <MatchInput 
                            key={`${currentRound}-${index}`}
                            match={match}
                            matchIndex={index}
                            teams={teamsForDisplay}
                            goalScorers={goalScorers}
                            onGoalChange={handleGoalChange}
                        />
                    ))}
                </div>
            </div>
            <div className="lg:col-span-3">
                {isSimpleMatch && currentRound === 1 ? (
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleSaveSimpleMatch} disabled={isLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                            {isLoading ? 'Opslaan...' : 'Enkele Wedstrijd Opslaan'}
                        </button>
                        <button onClick={handleNextRound} disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                            Start Ronde 2
                        </button>
                    </div>
                ) : isFinalRound ? (
                    <button onClick={handleSave} disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        {isLoading ? 'Opslaan...' : 'Toernooi Afronden & Sessie Opslaan'}
                    </button>
                ) : (
                    <button onClick={handleNextRound} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        Sla Ronde 1 op & Ga Naar Ronde 2
                    </button>
                )}
            </div>
        </div>
    );
  };
  
  const renderContent = () => {
    switch(round) {
        case 0: return renderSetup(1);
        case 1: return renderRound(1);
        case 1.8: return renderSetup(2);
        case 2: return renderRound(2);
        default: return <p>Ongeldige status</p>
    }
  }


  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <EditIcon className="w-8 h-8 text-green-500" />
        <h2 className="ml-3 text-3xl font-bold txt-white">Handmatige Invoer</h2>
      </div>

      {error && (
        <div className="bg-red-800/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Fout: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-200">&times;</button>
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default ManualEntry;
