import React, { useState } from 'react';
import type { GameSession, Player, MatchResult } from '../types';
import html2canvas from 'html2canvas';

const CameraIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
    <path fillRule="evenodd" d="M9.348 2.818a1.5 1.5 0 0 0-1.414 1.182l-.45 1.795H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25h-2.985l-.45-1.795a1.5 1.5 0 0 0-1.414 1.182l-1.313.131a6.67 6.67 0 0 0-3.376 0l-1.313-.131Z" clipRule="evenodd" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, players }) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // --- CSV EXPORT FUNCTIE (AANGEPAST MET PUNTEN) ---
  const handleExportCSV = (e: React.MouseEvent, sessionsToExport: GameSession[], filenamePrefix: string) => {
    e.stopPropagation();

    // AANGEPAST: Header 'Punten' toegevoegd
    const headers = ['Datum', 'Ronde', 'Wedstrijd Nr', 'Team Kleur', 'Speler ID', 'Naam', 'Doelpunten', 'Punten'];
    const rows: string[][] = [];

    sessionsToExport.forEach(session => {
        const dateStr = new Date(session.date).toLocaleDateString('nl-NL');
        
        const processMatches = (results: MatchResult[], roundName: string) => {
            results.forEach((match, index) => {
                const matchNumber = (index + 1).toString();

                // 1. Bereken scores en punten voor deze wedstrijd
                const score1 = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
                const score2 = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

                let points1 = 0;
                let points2 = 0;

                if (score1 > score2) {
                    points1 = 3;
                    points2 = 0;
                } else if (score2 > score1) {
                    points1 = 0;
                    points2 = 3;
                } else {
                    points1 = 1;
                    points2 = 1;
                }

                // Hulpfunctie om spelers van een team toe te voegen
                const addTeamRows = (teamIndex: number, goalsArray: any[], teamColor: 'Blauw' | 'Geel', points: number) => {
                    const teamPlayers = session.teams[teamIndex] || [];
                    
                    teamPlayers.forEach(player => {
                        // Zoek hoeveel goals deze specifieke speler heeft gemaakt
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
                            points.toString() // AANGEPAST: Punten toegevoegd
                        ]);
                    });
                };

                // Verwerk Team Blauw (Team 1)
                addTeamRows(match.team1Index, match.team1Goals, 'Blauw', points1);
                
                // Verwerk Team Geel (Team 2)
                addTeamRows(match.team2Index, match.team2Goals, 'Geel', points2);
            });
        };

        processMatches(session.round1Results, 'Ronde 1');
        processMatches(session.round2Results, 'Ronde 2');
    });

    const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bounceball_stats_${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };
  // -----------------------------------------

  const handleShareImage = async (e: React.MouseEvent, sessionDate: string) => {
    e.stopPropagation();
    
    if (expandedDate !== sessionDate) {
        setExpandedDate(sessionDate);
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    const elementId = `session-content-${sessionDate}`;
    const element = document.getElementById(elementId);

    if (!element) {
        alert("Kan de uitslagen niet vinden om te delen.");
        return;
    }

    setIsGeneratingImage(true);

    try {
        const fixedWidth = 700; 

        const canvas = await html2canvas(element, {
            backgroundColor: '#111827', 
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
                }
            }
        });

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `Uitslagen-${sessionDate}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Bounceball Uitslagen',
                        text: `De uitslagen van ${formatDate(sessionDate)}! ⚽`,
                    });
                } catch (shareError) {
                    console.log('Delen geannuleerd', shareError);
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
        console.error("Fout bij maken afbeelding:", error);
        alert("Er ging iets mis bij het maken van de afbeelding.");
        setIsGeneratingImage(false);
    }
  };

  const MatchResultDisplay: React.FC<{ result: MatchResult; teams: Player[][] }> = ({ result, teams }) => {
    const score1 = result.team1Goals.reduce((sum, g) => sum + g.count, 0);
    const score2 = result.team2Goals.reduce((sum, g) => sum + g.count, 0);

    const team1Players = teams[result.team1Index] || [];
    const team2Players = teams[result.team2Index] || [];

    const team1GoalsMap = new Map(result.team1Goals.map(g => [g.playerId, g.count]));
    const team2GoalsMap = new Map(result.team2Goals.map(g => [g.playerId, g.count]));

    const getBaseColor = (idx: number) => (idx % 2 === 0 ? 'blue' : 'yellow');

    const baseColor1 = getBaseColor(result.team1Index);
    const baseColor2 = getBaseColor(result.team2Index);

    let finalColor1 = baseColor1;
    let finalColor2 = baseColor2;

    if (baseColor1 === baseColor2) {
        finalColor2 = (baseColor2 === 'blue' ? 'yellow' : 'blue');
    }

    const getColorClass = (color: string) => color === 'blue' ? 'text-cyan-400' : 'text-amber-400';
    
    const colorClassTeam1 = getColorClass(finalColor1);
    const colorClassTeam2 = getColorClass(finalColor2);

    const PlayerListWithGoals: React.FC<{ players: Player[]; goalsMap: Map<number, number>; scoreColorClass: string }> = ({ players, goalsMap, scoreColorClass }) => (
        <ul className="space-y-1 mt-3">
            {players.map(player => {
                const goals = goalsMap.get(player.id) || 0;
                const hasScored = goals > 0;

                return (
                    <li key={player.id} className="flex justify-between items-center pr-2 py-0.5 border-b border-gray-600/30 last:border-0">
                        <span className={`text-sm whitespace-nowrap mr-2 ${hasScored ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>
                            {player.name}
                        </span>
                        <span className={`text-base font-bold ${hasScored ? scoreColorClass : 'text-gray-600'}`}>
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
                    <h4 className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 truncate ${colorClassTeam1}`}>
                        Team {result.team1Index + 1}
                    </h4>
                    <PlayerListWithGoals 
                        players={team1Players} 
                        goalsMap={team1GoalsMap} 
                        scoreColorClass={colorClassTeam1} 
                    />
                </div>
                <div className="overflow-hidden">
                    <h4 className={`font-bold text-lg mb-2 border-b border-gray-600 pb-2 truncate ${colorClassTeam2}`}>
                        Team {result.team2Index + 1}
                    </h4>
                    <PlayerListWithGoals 
                        players={team2Players} 
                        goalsMap={team2GoalsMap} 
                        scoreColorClass={colorClassTeam2} 
                    />
                </div>
            </div>

            <div className="mt-6 pt-2 border-t border-gray-600 text-center flex justify-center items-center gap-4">
                <span className={`text-4xl font-black tracking-widest drop-shadow-md ${colorClassTeam1}`}>{score1}</span>
                <span className="text-2xl font-bold text-gray-500">-</span>
                <span className={`text-4xl font-black tracking-widest drop-shadow-md ${colorClassTeam2}`}>{score2}</span>
            </div>
        </div>
    );
};


  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Wedstrijdgeschiedenis</h2>
          
          {/* EXPORT ALL KNOP */}
          <button
            onClick={(e) => handleExportCSV(e, history, 'COMPLETE_HISTORY')}
            className="flex items-center space-x-2 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors shadow-md"
            title="Download complete geschiedenis als CSV"
          >
              <DownloadIcon className="w-5 h-5" />
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
                
                {/* EXPORT SINGLE KNOP */}
                <div 
                    onClick={(e) => handleExportCSV(e, [session], `MATCH_${session.date.split('T')[0]}`)}
                    className="p-2 bg-green-700 hover:bg-green-600 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95 transform duration-150"
                    title="Download deze wedstrijd als CSV"
                >
                    <DownloadIcon className="w-4 h-4" />
                </div>

                {/* DELEN AFBEELDING KNOP */}
                <div 
                    onClick={(e) => handleShareImage(e, session.date)}
                    className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95 transform duration-150"
                    title="Deel afbeelding via WhatsApp"
                >
                   {isGeneratingImage && expandedDate === session.date ? (
                       <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : (
                       <CameraIcon className="w-4 h-4" />
                   )}
                </div>
                
                <span className={`transform transition-transform ${expandedDate === session.date ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>
            
            {expandedDate === session.date && (
              <div id={`session-content-${session.date}`} className="bg-gray-900 border-t border-gray-600">
                <div className="p-6 w-full"> 
                    
                    <div className="mb-8 text-center">
                        <h3 className="text-4xl font-black text-green-500 tracking-tight">
                            BOUNCEBALL
                        </h3>
                        <div className="h-1 w-32 bg-green-500 mx-auto my-2 rounded-full"></div>
                        <p className="text-gray-300 font-medium text-lg mt-1 uppercase tracking-wide">{formatDate(session.date)}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                    {/* Ronde 1 */}
                    <div>
                        <div className="flex items-center mb-4">
                            <div className="h-8 w-1 bg-green-500 rounded-full mr-3"></div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-wider">Ronde 1</h3>
                        </div>
                        <div className="space-y-6">
                            {session.round1Results.map((r, i) => <MatchResultDisplay key={`r1-${i}`} result={r} teams={session.teams} />)}
                        </div>
                    </div>

                    {/* Ronde 2 */}
                    {session.round2Results.length > 0 && (
                        <div>
                            <div className="flex items-center mb-4 mt-4">
                                <div className="h-8 w-1 bg-green-500 rounded-full mr-3"></div>
                                <h3 className="text-2xl font-bold text-white uppercase tracking-wider">Ronde 2</h3>
                            </div>
                            <div className="space-y-6">
                                {session.round2Results.map((r, i) => <MatchResultDisplay key={`r2-${i}`} result={r} teams={session.teams} />)}
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
