import React, { useState } from 'react';
import type { GameSession, Player, MatchResult } from '../types';
import html2canvas from 'html2canvas';

/* ================= ICONS ================= */

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891..." />
  </svg>
);

const ExcelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src="https://i.postimg.cc/rsdSMGLm/microsoft-excel-computer-icons-xls-microsoft-c70a1dabe2e12c80c0a3159b40d70d14.png"
    alt="Excel"
    className={className}
  />
);

const DownloadIcon = ExcelIcon;
const ArchiveIcon = ExcelIcon;

const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9..." />
  </svg>
);

/* ================= TYPES ================= */

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
  onDeleteSession: (date: string) => void;
  isAuthenticated?: boolean;
}

const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

/* ================= COMPONENT ================= */

const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onDeleteSession,
  isAuthenticated = false,
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const toggleSession = (date: string) => {
    setExpandedDate(prev => (prev === date ? null : date));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /* ================= MATCH DISPLAY ================= */

  const MatchResultDisplay: React.FC<{ result: MatchResult; teams: Player[][] }> = ({ result, teams }) => {
    const score1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
    const score2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);

    let leftTeamIdx = result.team1Index;
    let rightTeamIdx = result.team2Index;
    let leftScore = score1;
    let rightScore = score2;
    let leftGoals = result.team1Goals;
    let rightGoals = result.team2Goals;

    const leftColorClass = 'text-cyan-400';
    const rightColorClass = 'text-amber-400';

    const team1Players = teams[leftTeamIdx] || [];
    const team2Players = teams[rightTeamIdx] || [];

    const PlayerListWithGoals: React.FC<{
      players: Player[];
      teamGoals: { playerId: number; count: number }[];
      opponentGoals: { playerId: number; count: number }[];
      scoreColorClass: string;
    }> = ({ players, teamGoals, opponentGoals, scoreColorClass }) => {
      const goalsForMap = new Map(teamGoals.map(g => [g.playerId, g.count]));
      const oppGoalsMap = new Map(opponentGoals.map(g => [g.playerId, g.count]));

      return (
        <ul className="space-y-1 mt-3">
          {players.map(player => {
            const goalsFor = goalsForMap.get(player.id) || 0;
            const ownGoals = oppGoalsMap.get(player.id) || 0;
            const hasContribution = goalsFor > 0 || ownGoals > 0;

            return (
              <li key={player.id} className="flex items-center pr-2 py-0.5 border-b border-gray-600/30 last:border-0">
                
                {/* ✅ NAAM – max 3 regels */}
                <div className="flex-1 min-w-0 mr-2">
                  <span
                    className={`inline-block text-sm leading-tight ${
                      hasContribution ? 'text-gray-100 font-medium' : 'text-gray-400'
                    }`}
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {player.name}
                  </span>
                </div>

                {/* ✅ DOELPUNTEN + EG */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-base font-bold min-w-[1.5rem] text-right ${
                    goalsFor > 0 ? scoreColorClass : 'text-gray-600'
                  }`}>
                    {goalsFor}
                  </span>

                  {ownGoals > 0 && (
                    <span className="text-[11px] font-bold text-red-400 bg-red-900/40 border border-red-500/60 rounded-full px-2 py-0.5">
                      EG {ownGoals}
                    </span>
                  )}
                </div>

              </li>
            );
          })}
        </ul>
      );
    };

    return (
      <div className="bg-gray-800 p-5 rounded-xl border border-gray-600/50 shadow-md flex flex-col">
        <div className="flex-grow grid grid-cols-2 gap-8">
          <div>
            <h4 className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 ${leftColorClass}`}>
              Team {leftTeamIdx + 1}
            </h4>
            <PlayerListWithGoals players={team1Players} teamGoals={leftGoals} opponentGoals={rightGoals} scoreColorClass={leftColorClass} />
          </div>

          <div>
            <h4 className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 ${rightColorClass}`}>
              Team {rightTeamIdx + 1}
            </h4>
            <PlayerListWithGoals players={team2Players} teamGoals={rightGoals} opponentGoals={leftGoals} scoreColorClass={rightColorClass} />
          </div>
        </div>

        <div className="mt-6 pt-2 border-t border-gray-600 text-center flex justify-center items-center gap-4">
          <span className={`text-4xl font-black ${leftColorClass}`}>{leftScore}</span>
          <span className="text-2xl font-bold text-gray-500">-</span>
          <span className={`text-4xl font-black ${rightColorClass}`}>{rightScore}</span>
        </div>
      </div>
    );
  };

  /* ================= RENDER ================= */

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-3xl font-bold text-white mb-6">Wedstrijdgeschiedenis</h2>

      <div className="space-y-4">
        {history.map(session => (
          <div key={session.date} className="bg-gray-700 rounded-lg overflow-hidden">

            <button onClick={() => toggleSession(session.date)} className="w-full p-4 flex justify-between hover:bg-gray-600">
              <span className="font-bold text-white">{formatDate(session.date)}</span>
            </button>

            {expandedDate === session.date && (
              <div className="bg-gray-900 p-6 space-y-6">
                {session.round1Results.map((r, i) => (
                  <MatchResultDisplay key={i} result={r} teams={session.teams} />
                ))}
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;
