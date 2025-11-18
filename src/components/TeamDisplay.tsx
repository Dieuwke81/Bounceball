
import React, { useMemo, useState, useEffect } from 'react';
import type { Player, Match, Goal, MatchResult } from '../types';
import TrophyIcon from './icons/TrophyIcon';

type GameMode = 'simple' | 'tournament' | 'doubleHeader' | null;

interface TeamDisplayProps {
  teams: Player[][];
  teams2: Player[][] | null;
  gameMode: GameMode;
  currentRound: number;
  round1Results: MatchResult[];
  round2Pairings: Match[];
  goalScorers: { [key: string]: Goal[] };
  onGoalChange: (matchIndex: number, teamIdentifier: 'team1' | 'team2', playerId: number, count: number) => void;
  onSaveRound1: (matches: Match[]) => void;
  onSaveFinalResults: (matches: Match[]) => void;
  onSaveSimpleMatch: (match: Match) => void;
  onStartSecondDoubleHeaderMatch: (match1Result: MatchResult) => void;
  onSaveDoubleHeader: (match2Result: MatchResult) => void;
  onRegenerateTeams: () => void;
  actionInProgress: string | null;
}

const Spinner: React.FC<{className?: string}> = ({className}) => (
    <svg className={`animate-spin ${className || 'h-5 w-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const LoadingDots: React.FC = () => {
    const [dots, setDots] = useState('');
    useEffect(() => {
        const timer = setInterval(() => {
            setDots(d => (d.length < 3 ? d + '.' : ''));
        }, 300);
        return () => clearInterval(timer);
    }, []);
    return <span className="w-4 inline-block text-left">{dots}</span>;
};


const MatchInputCard: React.FC<{
    match: Match;
    matchIndex: number;
    teams: Player[][];
    goalScorers: TeamDisplayProps['goalScorers'];
    onGoalChange: TeamDisplayProps['onGoalChange'];
}> = ({ match, matchIndex, teams, goalScorers, onGoalChange }) => {
    
    const team1 = teams[match.team1Index];
    const team2 = teams[match.team2Index];
    
    // Kleurlogica met conflictresolutie
    const team1Color = match.team1Index % 2 === 0 ? 'text-cyan-300' : 'text-amber-300';
    let team2Color = match.team2Index % 2 === 0 ? 'text-cyan-300' : 'text-amber-300';
    if (team1Color === team2Color) {
        team2Color = team1Color === 'text-cyan-300' ? 'text-amber-300' : 'text-cyan-300';
    }


    const getTeamGoals = (teamIdentifier: 'team1' | 'team2') => goalScorers[`${matchIndex}-${teamIdentifier}`] || [];
    const getTeamScore = (teamIdentifier: 'team1' | 'team2') => getTeamGoals(teamIdentifier).reduce((sum, goal) => sum + goal.count, 0);

    const PlayerGoalInput: React.FC<{player: Player, teamIdentifier: 'team1' | 'team2'}> = ({ player, teamIdentifier }) => {
        const goals = getTeamGoals(teamIdentifier);
        const goalCount = goals.find(g => g.playerId === player.id)?.count || '';

        return (
            <div className="flex items-center justify-between space-x-2 bg-gray-600 p-2 rounded">
                <span className="text-gray-200 flex-1 pr-2">{player.name}</span>
                <input
                    type="number"
                    value={goalCount}
                    onChange={(e) => onGoalChange(matchIndex, teamIdentifier, player.id, parseInt(e.target.value, 10) || 0)}
                    min="0"
                    className="w-10 bg-gray-700 border border-gray-500 rounded-md py-1 px-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    aria-label={`Doelpunten voor ${player.name}`}
                    placeholder="0"
                />
            </div>
        )
    }

    return (
        <div className="bg-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Team 1 */}
                <div className="space-y-3">
                    <div className="text-center">
                        <h4 className={`font-bold text-lg ${team1Color}`}>Team {match.team1Index + 1}</h4>
                        <p className="text-3xl font-bold text-white">{getTeamScore('team1')}</p>
                    </div>
                    <div className="space-y-2 pr-1">
                        {team1.map(p => <PlayerGoalInput key={p.id} player={p} teamIdentifier="team1" />)}
                    </div>
                </div>
                {/* Team 2 */}
                <div className="space-y-3">
                     <div className="text-center">
                        <h4 className={`font-bold text-lg ${team2Color}`}>Team {match.team2Index + 1}</h4>
                        <p className="text-3xl font-bold text-white">{getTeamScore('team2')}</p>
                    </div>
                    <div className="space-y-2 pr-1">
                        {team2.map(p => <PlayerGoalInput key={p.id} player={p} teamIdentifier="team2" />)}
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
    
    // Kleurlogica met conflictresolutie
    const team1Color = matchResult.team1Index % 2 === 0 ? 'text-cyan-400/80' : 'text-amber-400/80';
    let team2Color = matchResult.team2Index % 2 === 0 ? 'text-cyan-400/80' : 'text-amber-400/80';
    if (team1Color === team2Color) {
        team2Color = team1Color === 'text-cyan-400/80' ? 'text-amber-400/80' : 'text-cyan-400/80';
    }


    return (
        <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center text-center">
                <div className="w-2/5">
                    <h4 className={`font-semibold text-base truncate ${team1Color}`}>Team {matchResult.team1Index + 1}</h4>
                </div>
                <div className="w-1/5">
                    <p className="text-2xl font-bold text-white/90">
                        {team1Score} - {team2Score}
                    </p>
                </div>
                <div className="w-2/5">
                    <h4 className={`font-semibold text-base truncate ${team2Color}`}>Team {matchResult.team2Index + 1}</h4>
                </div>
            </div>
        </div>
    );
};

const TeamCard: React.FC<{team: Player[], index: number, title: string}> = ({ team, index, title }) => {
    const calculateTeamStats = (team: Player[]) => {
        const totalRating = team.reduce((sum, player) => sum + player.rating, 0);
        const averageRating = team.length > 0 ? (totalRating / team.length).toFixed(2) : '0.00';
        return { totalRating, averageRating };
    };
    const { totalRating, averageRating } = calculateTeamStats(team);
    const isBlueTeam = index % 2 === 0;
    const headerColor = isBlueTeam ? 'text-cyan-400' : 'text-amber-400';
    const borderColor = isBlueTeam ? 'border-cyan-500' : 'border-amber-500';

    return (
         <div className={`bg-gray-700 rounded-lg flex flex-col border-t-4 ${borderColor}`}>
              <h3 className={`text-xl font-bold ${headerColor} mb-2 px-4 pt-3`}>{title} {index + 1}</h3>
              <div className="flex-grow space-y-2 mb-4 px-4">
                {team.map((player) => (
                  <div key={player.id} className="flex justify-between items-center bg-gray-600 p-2 rounded">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-200">{player.name}</span>
                      {player.isKeeper && (
                        <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">
                          K
                        </span>
                      )}
                    </div>
                    {/*   <span className="text-sm font-semibold text-cyan-300">{player.rating}</span> */}
                  </div>
                ))}
              </div>
              <div className="mt-auto border-t border-gray-600 pt-3 text-sm px-4 pb-4">
                <div className="flex justify-between text-gray-300">
                  <span>Totaal spelers:</span>
                  <span className="font-semibold text-white">{team.length}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Totaal rating:</span>
                  <span className="font-semibold text-white">{totalRating.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Gem. rating:</span>
                  <span className="font-semibold text-white">{averageRating}</span>
                </div>
              </div>
            </div>
    )
}


const TeamDisplay: React.FC<TeamDisplayProps> = ({ teams, teams2, gameMode, currentRound, round1Results, round2Pairings, goalScorers, onGoalChange, onSaveRound1, onSaveFinalResults, onSaveSimpleMatch, onStartSecondDoubleHeaderMatch, onSaveDoubleHeader, onRegenerateTeams, actionInProgress }) => {
  if (teams.length === 0) {
    return null;
  }
  
  const isSimpleMatch = gameMode === 'simple';

  const round1Matches: Match[] = useMemo(() => {
    if (gameMode === 'simple' || gameMode === 'doubleHeader') {
        return [{ team1Index: 0, team2Index: 1 }];
    }
    
    if (gameMode === 'tournament') {
        const matches: Match[] = [];
        // Pair teams sequentially: Team 1 vs Team 2, Team 3 vs Team 4, etc.
        for (let i = 0; i < teams.length; i += 2) {
            if (teams[i + 1]) { // Ensure a pair exists
                matches.push({
                    team1Index: i,
                    team2Index: i + 1,
                });
            }
        }
        return matches;
    }
    return [];
  }, [teams, gameMode]);

  const currentMatches = currentRound === 1 ? round1Matches : round2Pairings;

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 mt-8">
      <div className="flex items-center mb-6">
        <TrophyIcon className="w-6 h-6 text-fuchsia-400" />
        <h2 className="ml-3 text-2xl font-bold text-white">Wedstrijdoverzicht</h2>
      </div>

      {/* --- DOUBLE HEADER LOGIC (self-contained) --- */}
      {gameMode === 'doubleHeader' && (
        <>
          {currentRound === 1 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Teams Wedstrijd 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team, index) => (
                  <TeamCard key={index} team={team} index={index} title="Team" />
                ))}
              </div>
              <div className="mt-8 border-t border-gray-600 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">Uitslag Wedstrijd 1</h3>
                <MatchInputCard 
                    match={{team1Index: 0, team2Index: 1}}
                    matchIndex={0}
                    teams={teams}
                    goalScorers={goalScorers}
                    onGoalChange={onGoalChange}
                />
                <button
                    onClick={() => {
                        const matchResult: MatchResult = {
                            team1Index: 0, team2Index: 1,
                            team1Goals: goalScorers['0-team1'] || [],
                            team2Goals: goalScorers['0-team2'] || [],
                        };
                        onStartSecondDoubleHeaderMatch(matchResult);
                    }}
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-blue-800 disabled:cursor-wait"
                    disabled={!!actionInProgress}
                >
                    {actionInProgress === 'generating' ? (
                      <>
                        <Spinner className="mr-3" />
                        <span>Teams Maken...</span>
                      </>
                    ) : (
                      'Sla Wedstrijd 1 op & Start Wedstrijd 2'
                    )}
                </button>
              </div>
            </div>
          )}

          {currentRound === 2 && teams2 && round1Results.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4 opacity-80">Teams Wedstrijd 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {teams.map((team, index) => (
                  <TeamCard key={index} team={team} index={index} title="Team" />
                ))}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Teams Wedstrijd 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams2.map((team, index) => (
                  <TeamCard key={`dh-${index}`} team={team} index={index} title="Team" />
                ))}
              </div>
               <div className="mt-8 border-t border-gray-600 pt-6">
                  <div className="mb-8">
                      <h3 className="text-xl font-bold text-gray-400 mb-4">Resultaat Wedstrijd 1</h3>
                      <MatchResultDisplayCard matchResult={round1Results[0]} />
                  </div>
                   <h3 className="text-xl font-bold text-white mb-4">Uitslag Wedstrijd 2</h3>
                  <MatchInputCard 
                      match={{team1Index: 0, team2Index: 1}}
                      matchIndex={0}
                      teams={teams2}
                      goalScorers={goalScorers}
                      onGoalChange={onGoalChange}
                  />
                   <button
                      onClick={() => {
                          const match2Result: MatchResult = {
                              team1Index: 0, team2Index: 1,
                              team1Goals: goalScorers['0-team1'] || [],
                              team2Goals: goalScorers['0-team2'] || [],
                          };
                          onSaveDoubleHeader(match2Result);
                      }}
                      className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                      disabled={!!actionInProgress}
                  >
                       {actionInProgress === 'savingDouble' ? (
                         <>
                           <Spinner className="mr-3" />
                           <span>Opslaan...</span>
                         </>
                       ) : (
                         'Sla Beide Wedstrijden Op'
                       )}
                  </button>
              </div>
            </div>
          )}
        </>
      )}


      {/* --- SIMPLE MATCH / TOURNAMENT LOGIC --- */}
      {(isSimpleMatch || gameMode === 'tournament') && (
        <>
            {/* Round 1: Show teams */}
            {currentRound === 1 && (
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-4">Gebalanceerde Teams</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team, index) => (
                            <TeamCard key={index} team={team} index={index} title="Team" />
                        ))}
                    </div>
                </div>
            )}
            
            {currentRound > 0 && (
                <div className="mt-8 border-t border-gray-600 pt-6">
                    {/* Round 2 setup: R1 results + R2 teams */}
                    {currentRound === 2 && round1Results.length > 0 && (
                        <>
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-400 mb-4">Resultaten Ronde 1</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {round1Results.map((result, index) => (
                                        <MatchResultDisplayCard
                                            key={`r1-result-${index}`}
                                            matchResult={result}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-white mb-4">Teams voor Ronde 2</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {teams.map((team, index) => (
                                        <TeamCard key={`r2-${index}`} team={team} index={index} title="Team" />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                    
                    <h3 className="text-xl font-bold text-white mb-4">{isSimpleMatch ? 'Wedstrijduitslag' : `Uitslagen Ronde ${currentRound}`}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {currentMatches.map((match, index) => (
                            <MatchInputCard 
                                key={`${currentRound}-${index}`}
                                match={match}
                                matchIndex={index}
                                teams={teams}
                                goalScorers={goalScorers}
                                onGoalChange={onGoalChange}
                            />
                        ))}
                    </div>
                    
                    {isSimpleMatch && currentRound === 1 && (
                         <button
                            onClick={() => onSaveSimpleMatch(round1Matches[0])}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                            disabled={!!actionInProgress}
                            >
                            {actionInProgress === 'savingSimple' ? (
                                <>
                                    <Spinner className="mr-3" />
                                    <span>Opslaan...</span>
                                </>
                            ) : (
                                'Wedstrijd Opslaan'
                            )}
                        </button>
                    )}

                    {!isSimpleMatch && currentRound === 1 && (
                         <button
                            onClick={() => onSaveRound1(round1Matches)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 disabled:bg-blue-800 disabled:cursor-not-allowed"
                            disabled={!!actionInProgress}
                            >
                            Sla Ronde 1 op & Start Ronde 2
                        </button>
                    )}

                    {!isSimpleMatch && currentRound === 2 && (
                        <>
                            <button
                                onClick={() => onSaveFinalResults(round2Pairings)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 flex items-center justify-center disabled:bg-green-800 disabled:cursor-wait"
                                disabled={!!actionInProgress}
                            >
                                 {actionInProgress === 'savingFinal' ? (
                                    <>
                                        <Spinner className="mr-3" />
                                        <span>Afronden...</span>
                                    </>
                                ) : (
                                    'Toernooi Afronden & Sessie Opslaan'
                                )}
                            </button>
                            <button
                                onClick={onRegenerateTeams}
                                className={`w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center disabled:bg-amber-800 disabled:cursor-wait`}
                                disabled={!!actionInProgress}
                            >
                                {actionInProgress === 'regeneratingTeams' ? (
                                    <>
                                        <Spinner className="-ml-1 mr-3 h-5 w-5 text-white" />
                                        <span>Nieuwe teams maken<LoadingDots /></span>
                                    </>
                                ) : (
                                   'Speler geblesseerd? Maak nieuwe teams voor R2'
                                )}
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default TeamDisplay;
