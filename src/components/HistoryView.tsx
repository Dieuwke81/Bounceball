import React, { useMemo, useState } from 'react';
import type { GameSession, Player, MatchResult } from '../types';
import html2canvas from 'html2canvas';

// ================= ICONS =================

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const ExcelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src="https://i.postimg.cc/rsdSMGLm/microsoft-excel-computer-icons-xls-microsoft-c70a1dabe2e12c80c0a3159b40d70d14.png"
    alt="Excel icoon"
    className={className}
  />
);

const DownloadIcon = ExcelIcon;
const ArchiveIcon = ExcelIcon;

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
  onDeleteSession: (date: string) => void;
  isAuthenticated?: boolean;
}

// even = blauw, oneven = geel
const getBaseColor = (index: number) => (index % 2 === 0 ? 'blue' : 'yellow');

// robuuste helper om een speler-id uit een Goal object te halen
const getGoalPlayerId = (g: any): number | undefined => {
  return g?.playerId ?? g?.id ?? g?.player_id ?? g?.player?.id ?? undefined;
};

const buildGoalsMap = (goals: any[]): Map<string, number> => {
  const map = new Map<string, number>();
  (goals || []).forEach((g) => {
    const pid = getGoalPlayerId(g);
    if (pid == null) return;
    const key = String(pid);
    map.set(key, (map.get(key) || 0) + (Number(g?.count) || 0));
  });
  return map;
};

/**
 * ✅ Parser die ook double-encoded JSON aan kan.
 */
const safeParseMaybeJson = <T,>(v: any, fallback: T): T => {
  if (v == null) return fallback;
  if (Array.isArray(v)) return v as T;
  if (typeof v === 'object') return v as T;
  if (typeof v !== 'string') return fallback;

  let cur: any = v;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (typeof cur !== 'string') break;

    let s = cur.trim();
    if (!s) return fallback;

    if (
      (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
      (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
    ) {
      cur = s.slice(1, -1);
      continue;
    }

    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        cur = JSON.parse(s);
        continue;
      } catch {
        return fallback;
      }
    }

    const idxObj = s.indexOf('{');
    const idxArr = s.indexOf('[');
    const idx =
      idxArr === -1 ? idxObj : idxObj === -1 ? idxArr : Math.min(idxArr, idxObj);

    if (idx > 0) {
      const candidate = s.slice(idx).trim();
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        cur = candidate;
        continue;
      }
    }

    return fallback;
  }

  return (Array.isArray(cur) || typeof cur === 'object') ? (cur as T) : fallback;
};

const resolveTeamsForRound2 = (session: GameSession): Player[][] => {
  const r2 = safeParseMaybeJson<Player[][]>((session as any).round2Teams, []);
  if (Array.isArray(r2) && r2.length > 0) return r2;

  const r1 = safeParseMaybeJson<Player[][]>((session as any).teams, []);
  return Array.isArray(r1) ? r1 : [];
};

const resolveTeamsForRound1 = (session: GameSession): Player[][] => {
  const r1 = safeParseMaybeJson<Player[][]>((session as any).teams, []);
  return Array.isArray(r1) ? r1 : [];
};

const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  players,
  onDeleteSession,
  isAuthenticated = false,
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const playersById = useMemo(() => {
    const m = new Map<number, Player>();
    (players || []).forEach((p) => {
      if (p?.id != null) m.set(Number(p.id), p);
    });
    return m;
  }, [players]);

  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Geschiedenis</h2>
        <p className="text-gray-400">
          Sla je eerste toernooi af om hier de geschiedenis te zien.
        </p>
      </div>
    );
  }

  const toggleSession = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ================= EXPORT NAAR CSV =================

  const handleExportCSV = (
    e: React.MouseEvent,
    sessionsToExport: GameSession[],
    filenamePrefix: string
  ) => {
    e.stopPropagation();

    const headers = [
      'Datum',
      'Ronde',
      'Team Kleur',
      'excelID',
      'Speler ID',
      'Naam',
      'Doelpunten',
      'Punten',
    ];
    const rows: string[][] = [];

    sessionsToExport.forEach((session) => {
      const dateStr = new Date(session.date).toLocaleDateString('nl-NL');

      const processMatches = (
        results: MatchResult[],
        roundName: string,
        teamsForRound: Player[][]
      ) => {
        (results || []).forEach((match) => {
          const score1 = (match.team1Goals || []).reduce(
            (sum, g) => sum + (Number(g?.count) || 0),
            0
          );
          const score2 = (match.team2Goals || []).reduce(
            (sum, g) => sum + (Number(g?.count) || 0),
            0
          );

          let pts1 = 0;
          let pts2 = 0;
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
            const teamPlayers = teamsForRound?.[teamIndex] || [];

            teamPlayers.forEach((player) => {
              const playerGoalData = (goalsArray || []).find((g: any) => {
                const pid = getGoalPlayerId(g);
                return pid != null && String(pid) === String(player.id);
              });

              const goalsScored = playerGoalData ? Number(playerGoalData.count) || 0 : 0;
              const excelId = (player as any).excelID ?? (player as any).excelId ?? '';

              rows.push([
                dateStr,
                roundName,
                teamColor,
                String(excelId ?? ''),
                String(player.id),
                String(player.name),
                String(goalsScored),
                String(points),
              ]);
            });
          };

          addTeamRows(match.team1Index, match.team1Goals, 'Blauw', pts1);
          addTeamRows(match.team2Index, match.team2Goals, 'Geel', pts2);
        });
      };

      const teamsR1 = resolveTeamsForRound1(session);
      const teamsR2 = resolveTeamsForRound2(session);

      processMatches(session.round1Results, 'Ronde 1', teamsR1);
      processMatches(session.round2Results, 'Ronde 2', teamsR2);
    });

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

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

  // ================= SCREENSHOT / SHARE (AANGEPAST VOOR WITTE ACHTERGROND) =================

  const handleShareImage = async (e: React.MouseEvent, sessionDate: string) => {
    e.stopPropagation();

    if (expandedDate !== sessionDate) {
      setExpandedDate(sessionDate);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const elementId = `session-content-${sessionDate}`;
    const element = document.getElementById(elementId);
    if (!element) return;

    setIsGeneratingImage(true);
    try {
      const fixedWidth = 700;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff', // ✅ Forceer witte achtergrond in de afbeelding
        scale: 2,
        useCORS: true,
        width: fixedWidth,
        windowWidth: fixedWidth,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            clonedElement.style.width = `${fixedWidth}px`;
            clonedElement.style.minWidth = `${fixedWidth}px`;
            clonedElement.style.maxWidth = `${fixedWidth}px`;
            clonedElement.style.height = 'auto';
            clonedElement.style.padding = '2rem';
            clonedElement.style.backgroundColor = '#ffffff'; // ✅ Achtergrond container wit
            clonedElement.style.color = '#000000'; // ✅ Hoofdtekst zwart

            // Pas alle titels en teksten aan voor zwart-wit contrast
            const allElements = clonedElement.getElementsByTagName("*");
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              
              // Verander grijze achtergronden van kaarten naar een heel licht grijs of wit met border
              if (el.classList.contains('bg-gray-800') || el.classList.contains('bg-gray-900') || el.classList.contains('bg-gray-700')) {
                el.style.backgroundColor = '#ffffff';
                el.style.borderColor = '#dddddd';
                el.style.borderWidth = '1px';
                el.style.borderStyle = 'solid';
              }

              // Verander witte/grijze teksten naar donkergrijs/zwart
              if (el.classList.contains('text-white') || el.classList.contains('text-gray-100') || el.classList.contains('text-gray-300') || el.classList.contains('text-gray-400')) {
                el.style.color = '#111827';
              }
              
              // Behoud team-kleuren maar maak ze iets donkerder voor leesbaarheid op wit
              if (el.classList.contains('text-cyan-400')) el.style.color = '#0891b2';
              if (el.classList.contains('text-amber-400')) el.style.color = '#d97706';
              if (el.classList.contains('text-green-500')) el.style.color = '#16a34a';
            }
          }
        },
      });

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;

          const file = new File([blob], `Uitslagen-${sessionDate}.png`, {
            type: 'image/png',
          });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: 'Bounceball',
                text: `Uitslagen ${formatDate(sessionDate)}`,
              });
            } catch (err) {
              console.log(err);
            }
          } else {
            const link = document.createElement('a');
            link.download = `Uitslagen-${sessionDate}.png`;
            link.href = canvas.toDataURL();
            link.click();
          }
          setIsGeneratingImage(false);
        },
        'image/png'
      );
    } catch (err) {
      setIsGeneratingImage(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    if (window.confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) {
      onDeleteSession(date);
    }
  };

  // ================= MATCH RESULT WEERGAVE =================

  const MatchResultDisplay: React.FC<{
    result: MatchResult;
    teams: Player[][];
  }> = ({ result, teams }) => {
    const score1 = (result.team1Goals || []).reduce((sum, g) => sum + (Number(g?.count) || 0), 0);
    const score2 = (result.team2Goals || []).reduce((sum, g) => sum + (Number(g?.count) || 0), 0);

    const color1 = getBaseColor(result.team1Index);
    const color2 = getBaseColor(result.team2Index);

    let leftTeamIdx = result.team1Index;
    let rightTeamIdx = result.team2Index;
    let leftScore = score1;
    let rightScore = score2;
    let leftGoals = result.team1Goals || [];
    let rightGoals = result.team2Goals || [];

    if (color1 === 'yellow' && color2 === 'blue') {
      leftTeamIdx = result.team2Index;
      rightTeamIdx = result.team1Index;
      leftScore = score2;
      rightScore = score1;
      leftGoals = result.team2Goals || [];
      rightGoals = result.team1Goals || [];
    }

    const leftColorClass = 'text-cyan-400';
    const rightColorClass = 'text-amber-400';

    const team1Players = teams?.[leftTeamIdx] || [];
    const team2Players = teams?.[rightTeamIdx] || [];

    const team1GoalsMap = buildGoalsMap(leftGoals as any[]);
    const team2GoalsMap = buildGoalsMap(rightGoals as any[]);

    const PlayerListWithGoals: React.FC<{
      players: Player[];
      goalsMap: Map<string, number>;
      scoreColorClass: string;
    }> = ({ players, goalsMap, scoreColorClass }) => (
      <ul className="space-y-1 mt-3">
        {players.map((player) => {
          const goals = goalsMap.get(String(player.id)) || 0;
          return (
            <li
              key={player.id}
              className="flex justify-between items-center pr-2 py-0.5 border-b border-gray-600/30 last:border-0"
            >
              <span
                className={`text-sm mr-2 ${
                  goals > 0 ? 'text-gray-100 font-medium' : 'text-gray-400'
                } max-w-[70%] break-words leading-tight`}
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

  // ================= RENDER =================

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Wedstrijdgeschiedenis</h2>

        <button
          type="button"
          onClick={(e) => handleExportCSV(e, history, 'COMPLETE_HISTORY')}
          className="flex items-center justify-center active:scale-95 hover:opacity-90"
          aria-label="Alle wedstrijden naar CSV"
        >
          <DownloadIcon className="h-7 w-auto" />
        </button>
      </div>

      <div className="space-y-4">
        {history.map((session) => {
          const teamsR1 = resolveTeamsForRound1(session);
          const teamsR2 = resolveTeamsForRound2(session);

          return (
            <div key={session.date} className="bg-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSession(session.date)}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-600 transition-colors"
              >
                <span className="font-bold text-lg text-white">{formatDate(session.date)}</span>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={(e) =>
                      handleExportCSV(e, [session], `MATCH_${session.date.split('T')[0]}`)
                    }
                    className="cursor-pointer active:scale-95 hover:opacity-90 flex items-center"
                    aria-label="Deze wedstrijd naar CSV"
                  >
                    <ArchiveIcon className="h-9 w-auto" />
                  </button>

                  <div
                    onClick={(e) => handleShareImage(e, session.date)}
                    className="p-2 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95"
                    aria-label="Delen"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                  </div>

                  {isAuthenticated && (
                    <div
                      onClick={(e) => handleDeleteClick(e, session.date)}
                      className="p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95"
                      aria-label="Verwijderen"
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
                      <h3 className="text-4xl font-black text-green-500 tracking-tight">
                        BOUNCEBALL
                      </h3>
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
                          {(session.round1Results || []).map((r, i) => (
                            <MatchResultDisplay
                              key={`r1-${i}`}
                              result={r}
                              teams={teamsR1}
                            />
                          ))}
                        </div>
                      </div>

                      {(session.round2Results || []).length > 0 && (
                        <div>
                          <div className="flex items-center mb-4 mt-4">
                            <div className="h-8 w-1 bg-green-500 rounded-full mr-3" />
                            <h3 className="text-2xl font-bold text-white uppercase tracking-wider">
                              Ronde 2
                            </h3>
                          </div>

                          <div className="space-y-6">
                            {(session.round2Results || []).map((r, i) => (
                              <MatchResultDisplay
                                key={`r2-${i}`}
                                result={r}
                                teams={teamsR2}
                              />
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
          );
        })}
      </div>
    </div>
  );
};

export default HistoryView;
