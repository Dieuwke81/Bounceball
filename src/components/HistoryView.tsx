import React, { useState } from 'react';
import type { GameSession, Player, MatchResult } from '../types';
import html2canvas from 'html2canvas';

// Camera/Share icon
const CameraIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
    <path fillRule="evenodd" d="M9.348 2.818a1.5 1.5 0 0 0-1.414 1.182l-.45 1.795H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25h-2.985l-.45-1.795a1.5 1.5 0 0 0-1.414-1.182l-1.313.131a6.67 6.67 0 0 0-3.376 0l-1.313-.131Z" clipRule="evenodd" />
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
        const canvas = await html2canvas(element, {
            backgroundColor: '#111827', // Zeer donkere achtergrond (gray-900)
            scale: 2, 
            useCORS: true,
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

    const PlayerListWithGoals: React.FC<{ players: Player[]; goalsMap: Map<number, number> }> = ({ players, goalsMap }) => (
        <ul className="text-sm space-y-2 mt-2">
            {players.map(player => {
                const goals = goalsMap.get(player.id);
                return (
                    <li key={player.id} className="flex justify-between items-center text-gray-100">
                        <span className="truncate font-medium">{player.name}</span>
                        {goals && goals > 0 ? (
                            // HIER ZAT DE FOUT: Nu harde kleuren (Cyan achtergrond, Witte tekst)
                            <span className="ml-3 font-bold text-white bg-cyan-600 text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 border border-cyan-400 shadow-sm">
                                {goals}
                            </span>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );

    return (
        // Lighter gray background for cards for better contrast
        <div className="bg-gray-700/80 p-5 rounded-xl border border-gray-600 shadow-md flex flex-col">
            <div className="flex-grow grid grid-cols-2 gap-6">
                {/* Team 1 */}
                <div>
                    <h4 className="font-bold text-lg text-cyan-400 truncate mb-2 border-b border-gray-500 pb-2">Team {result.team1Index + 1}</h4>
                    <PlayerListWithGoals players={team1Players} goalsMap={team1GoalsMap} />
                </div>
                {/* Team 2 */}
                <div>
                    <h4 className="font-bold text-lg text-cyan-400 truncate mb-2 border-b border-gray-500 pb-2">Team {result.team2Index + 1}</h4>
                    <PlayerListWithGoals players={team2Players} goalsMap={team2GoalsMap} />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-500 text-center bg-gray-800/50 rounded-lg mx-auto w-full">
                <p className="text-4xl font-black text-white tracking-widest drop-shadow-lg py-2">
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
              
              <div className="flex items-center space-x-4">
                <div 
                    onClick={(e) => handleShareImage(e, session.date)}
                    className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white transition-colors cursor-pointer shadow-lg active:scale-95 transform duration-150"
                    title="Deel afbeelding via WhatsApp"
                >
                   {isGeneratingImage && expandedDate === session.date ? (
                       <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : (
                       <CameraIcon className="w-5 h-5" />
                   )}
                </div>
                <span className={`transform transition-transform ${expandedDate === session.date ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>
            
            {/* Dit is het gedeelte dat op de foto komt */}
            {expandedDate === session.date && (
              <div id={`session-content-${session.date}`} className="p-6 bg-gray-900 border-t border-gray-600">
                  
                {/* Header op de foto */}
                <div className="mb-8 text-center">
                    <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight" style={{WebkitTextFillColor: '#22d3ee'}}>
                        BOUNCEBALL
                    </h3>
                    <div className="h-1 w-24 bg-cyan-500 mx-auto my-2 rounded-full"></div>
                    <p className="text-gray-300 font-medium text-lg mt-1 uppercase tracking-wide">{formatDate(session.date)}</p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {/* Ronde 1 */}
                  <div>
                    <div className="flex items-center mb-4">
                        <div className="h-8 w-1 bg-cyan-500 rounded-full mr-3"></div>
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
                            <div className="h-8 w-1 bg-fuchsia-500 rounded-full mr-3"></div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-wider">Ronde 2</h3>
                        </div>
                        <div className="space-y-6">
                            {session.round2Results.map((r, i) => <MatchResultDisplay key={`r2-${i}`} result={r} teams={session.teams} />)}
                        </div>
                      </div>
                  )}
                </div>
                
                <div className="mt-10 pt-4 border-t border-gray-800 text-center text-gray-500 text-sm font-medium">
                    Gegenereerd door Bounceball App 🏆
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
