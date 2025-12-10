import React, { useState } from 'react';
import type { GameSession, Player, MatchResult } from '../types';
import html2canvas from 'html2canvas';

// --- ICONS ---
const CameraIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
    <path
      fillRule="evenodd"
      d="M9.348 2.818a1.5 1.5 0 0 0-1.414 1.182l-.45 1.795H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25h-2.985l-.45-1.795a1.5 1.5 0 0 0-1.414 1.182l-1.313.131a6.67 6.67 0 0 0-3.376 0l-1.313-.131Z"
      clipRule="evenodd"
    />
  </svg>
);

// Excel-icoon
const ExcelIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14 2H7.5A1.5 1.5 0 0 0 6 3.5v17A1.5 1.5 0 0 0 7.5 22h9A1.5 1.5 0 0 0 18 20.5V8l-4-6Z" opacity="0.7" />
    <path d="M14 2v5.25A.75.75 0 0 0 14.75 8H18L14 2Z" />
    <path
      d="M10.3 10.5a.75.75 0 0 1 .96.28l.74 1.23.74-1.23a.75.75 0 1 1 1.28.76l-1.14 1.88 1.2 1.97a.75.75 0 0 1-1.28.76l-.8-1.32-.8 1.32a.75.75 0 0 1-1.28-.76l1.2-1.97-1.14-1.88a.75.75 0 0 1 .28-1.04Z"
    />
  </svg>
);

// WhatsApp-achtig icoon (rond logo)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="wa-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#25D366" />
        <stop offset="100%" stopColor="#128C7E" />
      </linearGradient>
    </defs>
    <path
      fill="url(#wa-grad)"
      d="M12.04 2.25C6.9 2.25 2.75 6.26 2.75 11.23c0 1.74.47 3.3 1.28 4.66L3 21.25l5.53-1.81c1.32.72 2.82 1.11 4.47 1.11 5.14 0 9.29-4.01 9.29-8.98 0-4.97-4.15-9-9.25-9Z"
    />
    <path
      fill="#fff"
      d="M12.04 3.75c-4.43 0-7.9 3.33-7.9 7.47 0 1.35.41 2.65 1.19 3.84l.21.33-.72 3.17 3.26-1.07.28.16c1.14.68 2.47 1.06 3.93 1.06 4.28 0 7.75-3.35 7.75-7.48 0-4.14-3.47-7.48-7.75-7.48Zm4.22 10.41c-.2.53-1.11 1.01-1.55 1.08-.39.06-.89.08-1.44-.1-.34-.1-.77-.23-1.32-.45-2.35-.92-3.84-3.28-3.96-3.44-.12-.15-.94-1.23-.94-2.35 0-1.12.59-1.67.8-1.9.21-.23.46-.29.61-.29l.45.01c.14.01.34-.05.53.41.2.47.67 1.65.73 1.75.06.1.09.21.02.34-.07.12-.1.2-.2.3-.1.1-.21.23-.29.31-.09.09-.19.2-.08.4.11.2.49.86 1.06 1.39.73.68 1.34.89 1.53.99.19.1.31.08.42-.05.12-.13.49-.6.62-.8.13-.2.26-.17.44-.1.18.07 1.12.57 1.31.67.18.09.29.14.35.24.06.1.06.55-.13 1.08Z"
    />
  </svg>
);

const ArchiveIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
  onDeleteSession: (date: string) => void;
  isAuthenticated?: boolean;
}

// Hulpfunctie voor kleuren
const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  players,
  onDeleteSession,
  isAuthenticated = false,
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // --- 1. EXPORT FUNCTIES (Met Punten) ---
  const handleExportCSV = (
    e: React.MouseEvent,
    sessionsToExport: GameSession[],
    filenamePrefix: string
  ) => {
    e.stopPropagation();

    const headers = [
      'Datum',
      'Ronde',
      'Wedstrijd Nr',
      'Team Kleur',
      'Speler ID',
      'Naam',
      'Doelpunten',
      'Punten',
    ];
    const rows: string[][] = [];

    sessionsToExport.forEach(session => {
      const dateStr = new Date(session.date).toLocaleDateString('nl-NL');

      const processMatches = (results: MatchResult[], roundName: string) => {
        results.forEach((match, index) => {
          const matchNumber = (index + 1).toString();
          const score1 = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
          const score2 = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

          let pts1 = 0,
            pts2 = 0;
          if (score1 > score2) {
            pts1 = 3;
            pts2 = 0;
          } else if (score2 > score1) {
            pts1 = 0;
            pts2 = 3;
          } else {
            pts1 = 1;
            pts2 = 1;
          }

          const addTeamRows = (
            teamIndex: number,
            goalsArray: any[],
            teamColor: 'Blauw' | 'Geel',
            points: number
          ) => {
            const teamPlayers = session.teams[teamIndex] || [];
            teamPlayers.forEach(player => {
              const playerGoalData = goalsArray.find(g => g.playerId === player.id);
              const goalsScored = playerGoalData ? playerGoalData.count : 0;
              rows.push([
                dateStr,
                roundName,
                matchNumber,
                teamColor,
                player.id.toString(),
                player.name,
                goalsScored.toString(),
                points.toString(),
              ]);
            });
          };

          addTeamRows(match.team1Index, match.team1Goals, 'Blauw', pts1);
          addTeamRows(match.team2Index, match.team2Goals, 'Geel', pts2);
        });
      };

      processMatches(session.round1Results, 'Ronde 1');
      processMatches(session.round2Results, 'Ronde 2');
    });

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `bounceball_stats_${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // --- 2. SCREENSHOT FUNCTIE ---
  const handleShareImage = async (e: React.MouseEvent, sessionDate: string) => {
    e.stopPropagation();
    if (expandedDate !== sessionDate) {
      setExpandedDate(sessionDate);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const elementId = `session-content-${sessionDate}`;
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsGeneratingImage(true);
    try {
      const fixedWidth = 700;
      const canvas = await html2canvas(element, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        width: fixedWidth,
        windowWidth: fixedWidth,
        onclone: clonedDoc => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            clonedElement.style.width = `${fixedWidth}px`;
            clonedElement.style.minWidth = `${fixedWidth}px`;
            clonedElement.style.maxWidth = `${fixedWidth}px`;
            clonedElement.style.height = 'auto';
            clonedElement.style.padding = '2rem';
          }
        },
      });
      canvas.toBlob(async blob => {
        if (!blob) return;
        const file = new File([blob], `Uitslagen-${sessionDate}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Bounceball',
              text: `Uitslagen ${formatDate(sessionDate)}`,
            });
          } catch (e) {
            console.log(e);
          }
        } else {
          const link = document.createElement('a');
          link.download = `Uitslagen-${sessionDate}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
        setIsGeneratingImage(false);
      }, 'image/png');
    } catch (error) {
      setIsGeneratingImage(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    if (window.confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) {
      onDeleteSession(date);
    }
  };

  // --- 3. UITSLAG WEERGAVE COMPONENT ---
  const MatchResultDisplay: React.FC<{ result: MatchResult; teams: Player[][] }> = ({
    result,
    teams,
  }) => {
    const score1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
    const score2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);

    const color1 = getBaseColor(result.team1Index);
    const color2 = getBaseColor(result.team2Index);

    let leftTeamIdx = result.team1Index;
    let rightTeamIdx = result.team2Index;
    let leftScore = score1;
    let rightScore = score2;
    let leftGoals = result.team1Goals;
    let rightGoals = result.team2Goals;

    if (color1 === 'yellow' && color2 === 'blue') {
      leftTeamIdx = result.team2Index;
      rightTeamIdx = result.team1Index;
      leftScore = score2;
      rightScore = score1;
      leftGoals = result.team2Goals;
      rightGoals = result.team1Goals;
    }

    const leftColorClass = 'text-cyan-400';
    const rightColorClass = 'text-amber-400';

    const team1Players = teams[leftTeamIdx] || [];
    const team2Players = teams[rightTeamIdx] || [];
    const team1GoalsMap = new Map(leftGoals.map(g => [g.playerId, g.count]));
    const team2GoalsMap = new Map(rightGoals.map(g => [g.playerId, g.count]));

    const PlayerListWithGoals: React.FC<{
      players: Player[];
      goalsMap: Map<number, number>;
      scoreColorClass: string;
    }> = ({ players, goalsMap, scoreColorClass }) => (
      <ul className="space-y-1 mt-3">
        {players.map(player => {
          const goals = goalsMap.get(player.id) || 0;
          return (
            <li
              key={player.id}
              className="flex justify-between items-center pr-2 py-0.5 border-b border-gray-600/30 last:border-0"
            >
              <span
                className={`text-sm whitespace-nowrap mr-2 ${
                  goals > 0 ? 'text-gray-100 font-medium' : 'text-gray-400'
                }`}
              >
                {player.name}
              </span>
              <span
                className={`text-base font-bold ${
                  goals > 0 ? scoreColorClass : 'text-gray-600'
                }`}
              >
                {goals}
              </span>
            </li>
          );
        })}
      </ul>
    );

    return (
      <div className="bg-gray-800 p-5 rounded-xl border border-gray-600/50 shadow-md flex flex-col">
        <div className="flex-grow grid grid-cols-2 gap-8">
          <div className="overflow-hidden">
            <h4
              className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 truncate ${leftColorClass}`}
            >
              Team {leftTeamIdx + 1}
            </h4>
            <PlayerListWithGoals
              players={team1Players}
              goalsMap={team1GoalsMap}
              scoreColorClass={leftColorClass}
            />
          </div>
          <div className="overflow-hidden">
            <h4
              className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 truncate ${rightColorClass}`}
            >
              Team {rightTeamIdx + 1}
            </h4>
            <PlayerListWithGoals
              players={team2Players}
              goalsMap={team2GoalsMap}
              scoreColorClass={rightColorClass}
            />
          </div>
        </div>
        <div className="mt-6 pt-2 border-t border-gray-600 text-center flex justify-center items-center gap-4">
          <span className={`text-4xl font-black tracking-widest drop-shadow-md ${leftColorClass}`}>
            {leftScore}
          </span>
          <span className="text-2xl font-bold text-gray-500">-</span>
          <span className={`text-4xl font-black tracking-widest drop-shadow-md ${rightColorClass}`}>
            {rightScore}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Wedstrijdgeschiedenis</h2>
        <button
          onClick={e => handleExportCSV(e, history, 'COMPLETE_HISTORY')}
          className="flex items-center space-x-2 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors shadow-md"
        >
          <ExcelIcon className="w-5 h-5" />
          <span className="hidden sm:inline text-sm font-bold">Alles naar CSV</span>
        </button>
      </div>

      <div className="space-y-4">
        {history.map(session => (
          <div key={session.date} className="bg-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSession(session.date)}
              className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-600 transition-colors"
            >
              <span className="font-bold text-lg text-white">{formatDate(session.date)}</span>
              <div className="flex items-center space-x-3">
                {/* 🔵 Excel-icoon in blauwe knop */}
                <div
                  onClick={e =>
                    handleExportCSV(e, [session], `MATCH_${session.date.split('T')[0]}`)
                  }
                  className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95"
                >
                  <ExcelIcon className="w-4 h-4" />
                </div>

                {/* 🟢 WhatsApp-icoon in groene knop */}
                <div
                  onClick={e => handleShareImage(e, session.date)}
                  className="p-2 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                </div>

                {/* 🔐 Delete-knop alleen tonen als ingelogd */}
                {isAuthenticated && (
                  <div
                    onClick={e => handleDeleteClick(e, session.date)}
                    className="p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </div>
                )}

                <span
                  className={`transform transition-transform ${
                    expandedDate === session.date ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </div>
            </button>

            {expandedDate === session.date && (
              <div
                id={`session-content-${session.date}`}
                className="bg-gray-900 border-t border-gray-600"
              >
                <div className="p-6 w-full">
                  <div className="mb-8 text-center">
                    <h3 className="text-4xl font-black text-green-500 tracking-tight">BOUNCEBALL</h3>
                    <div className="h-1 w-32 bg-green-500 mx-auto my-2 rounded-full" />
                    <p className="text-gray-300 font-medium text-lg mt-1 uppercase tracking-wide">
                      {formatDate(session.date)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    <div>
                      <div className="flex items-center mb-4">
                        <div className="h-8 w-1 bg-green-500 rounded-full mr-3" />
                        <h3 className="text-2xl font-bold text-white uppercase tracking-wider">
                          Ronde 1
                        </h3>
                      </div>
                      <div className="space-y-6">
                        {session.round1Results.map((r, i) => (
                          <MatchResultDisplay key={`r1-${i}`} result={r} teams={session.teams} />
                        ))}
                      </div>
                    </div>
                    {session.round2Results.length > 0 && (
                      <div>
                        <div className="flex items-center mb-4 mt-4">
                          <div className="h-8 w-1 bg-green-500 rounded-full mr-3" />
                          <h3 className="text-2xl font-bold text-white uppercase tracking-wider">
                            Ronde 2
                          </h3>
                        </div>
                        <div className="space-y-6">
                          {session.round2Results.map((r, i) => (
                            <MatchResultDisplay key={`r2-${i}`} result={r} teams={session.teams} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-10 pt-4 border-t border-gray-800 text-center text-gray-500 text-sm font-medium">
                    Gegenereerd door de Bounceball App
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
