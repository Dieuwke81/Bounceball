

import React, { useState, useMemo } from 'react';
import type { GameSession, Player, MatchResult } from '../types';

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, players }) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Geschiedenis</h2>
        <p className="text-gray-400">Sla je eerste toernooi af om hier de geschiedenis te zien.</p>
      </div>
    );
  }

  const toggleSession = (date: string) => {
    setExpandedDate(prevDate => (prevDate === date ? null : date));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const MatchResultDisplay: React.FC<{ result: MatchResult; teams: Player[][] }> = ({ result, teams }) => {
    const score1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
    const score2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);

    const team1Players = teams[result.team1Index] || [];
    const team2Players = teams[result.team2Index] || [];

    const team1GoalsMap = new Map(result.team1Goals.map(g => [g.playerId, g.count]));
    const team2GoalsMap = new Map(result.team2Goals.map(g => [g.playerId, g.count]));

    const PlayerListWithGoals: React.FC<{ players: Player[]; goalsMap: Map<number, number> }> = ({ players, goalsMap }) => (
        <ul className="text-sm text-gray-300 space-y-1">
            {players.map(player => {
                const goals = goalsMap.get(player.id);
                return (
                    <li key={player.id} className="flex justify-between items-center">
                        <span className="truncate">{player.name}</span>
                        {goals && goals > 0 ? (
                            <span className="ml-2 font-bold text-white bg-gray-500/50 text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{goals}</span>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );

    return (
        <div className="bg-gray-600/50 p-4 rounded-lg flex flex-col">
            <div className="flex-grow grid grid-cols-2 gap-4">
                {/* Team 1 */}
                <div>
                    <h4 className="font-semibold text-base text-gray-300 truncate mb-2">Team {result.team1Index + 1}</h4>
                    <PlayerListWithGoals players={team1Players} goalsMap={team1GoalsMap} />
                </div>
                {/* Team 2 */}
                <div>
                    <h4 className="font-semibold text-base text-gray-300 truncate mb-2">Team {result.team2Index + 1}</h4>
                    <PlayerListWithGoals players={team2Players} goalsMap={team2GoalsMap} />
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-500/50 text-center">
                <p className="text-2xl font-bold text-white">
                    {score1} - {score2}
                </p>
            </div>
        </div>
    );
};


  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-3xl font-bold text-white mb-6">Wedstrijdgeschiedenis</h2>
      <div className="space-y-4">
        {history.map(session => (
          <div key={session.date} className="bg-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSession(session.date)}
              className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-600 transition-colors"
            >
              <span className="font-bold text-lg text-white">{formatDate(session.date)}</span>
              <span className={`transform transition-transform ${expandedDate === session.date ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedDate === session.date && (
              <div className="p-4 border-t border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Teams */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <h3 className="text-xl font-semibold text-cyan-400 mb-3">Teams</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {session.teams.map((team, index) => (
                        <div key={index} className="bg-gray-600 p-3 rounded-md">
                           <h4 className="font-bold text-gray-200 mb-2">Team {index + 1}</h4>
                           <ul className="text-sm text-gray-300 space-y-1">
                            {team.map(p => <li key={p.id}>{p.name}</li>)}
                           </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Results */}
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-400 mb-3">Ronde 1</h3>
                    <div className="space-y-2">
                        {session.round1Results.map((r, i) => <MatchResultDisplay key={`r1-${i}`} result={r} teams={session.teams} />)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-400 mb-3">Ronde 2</h3>
                     <div className="space-y-2">
                        {session.round2Results.map((r, i) => <MatchResultDisplay key={`r2-${i}`} result={r} teams={session.teams} />)}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;