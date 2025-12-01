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

  // --- DE FOTO GENERATOR ---
  const handleShareImage = async (e: React.MouseEvent, sessionDate: string) => {
    e.stopPropagation(); // Voorkom inklappen
    
    // Zorg dat de sessie opengeklapt is, anders kunnen we geen foto maken
    if (expandedDate !== sessionDate) {
        setExpandedDate(sessionDate);
        // Wacht heel even zodat React de DOM kan renderen
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
        // Maak de screenshot met html2canvas
        // We zetten scale op 2 voor scherpere tekst op mobiel (Retina schermen)
        const canvas = await html2canvas(element, {
            backgroundColor: '#1f2937', // De donkere bg-gray-800 kleur
            scale: 2, 
            useCORS: true, // Nodig als er ooit plaatjes van buitenaf in komen
        });

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            // Maak een bestand van de blob
            const file = new File([blob], `Uitslagen-${sessionDate}.png`, { type: 'image/png' });

            // Check of de browser kan delen (Mobiel doet dit bijna altijd)
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
                // Fallback voor PC: Download het bestand
                const link = document.createElement('a');
                link.download = `Uitslagen-${sessionDate}.png`;
                link.href = canvas.toDataURL();
                link.click();
                alert("Afbeelding gedownload! Je kunt hem nu handmatig versturen.");
            }
            setIsGeneratingImage(false);
        }, 'image/png');

    } catch (error) {
        console.error("Fout bij maken afbeelding:", error);
        alert("Er ging iets mis bij het maken van de afbeelding.");
        setIsGeneratingImage(false);
    }
  };
  // -----------------------------

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
                            <span className="ml-2 font-bold text-gray-900 bg-gray-200 text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{goals}</span>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );

    return (
        <div className="bg-slate-700 p-4 rounded-xl shadow-md flex flex-col border border-slate-600">
            <div className="flex-grow grid grid-cols-2 gap-4">
                {/* Team 1 */}
                <div>
                    <h4 className="font-bold text-base text-gray-200 truncate mb-3 border-b border-gray-600 pb-1">Team {result.team1Index + 1}</h4>
                    <PlayerListWithGoals players={team1Players} goalsMap={team1GoalsMap} />
                </div>
                {/* Team 2 */}
                <div>
                    <h4 className="font-bold text-base text-gray-200 truncate mb-3 border-b border-gray-600 pb-1">Team {result.team2Index + 1}</h4>
                    <PlayerListWithGoals players={team2Players} goalsMap={team2GoalsMap} />
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-600 text-center">
                <p className="text-3xl font-black text-white tracking-widest drop-shadow-md">
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
                {/* DE SCREENSHOT SHARE KNOP */}
                <div 
                    onClick={(e) => handleShareImage(e, session.date)}
                    className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white transition-colors cursor-pointer shadow-lg"
                    title="Deel afbeelding via WhatsApp"
                >
                   {isGeneratingImage && expandedDate === session.date ? (
                       <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : (
                       <CameraIcon className="w-5 h-5" />
                   )}
                </div>
                {/* ------------------------- */}
                
                <span className={`transform transition-transform ${expandedDate === session.date ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>
            
            {/* Dit ID gebruiken we om de foto te maken */}
            {expandedDate === session.date && (
              <div id={`session-content-${session.date}`} className="p-6 border-t border-gray-600 bg-gray-800">
                  
                {/* Header speciaal voor de screenshot (zichtbaar in app, maar ziet er cool uit op foto) */}
                <div className="mb-6 text-center border-b border-gray-700 pb-4">
                    <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        BOUNCEBALL
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{formatDate(session.date)}</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Ronde 1 */}
                  <div>
                    <h3 className="text-lg font-bold text-cyan-400 mb-3 uppercase tracking-wider">Ronde 1</h3>
                    <div className="space-y-4">
                        {session.round1Results.map((r, i) => <MatchResultDisplay key={`r1-${i}`} result={r} teams={session.teams} />)}
                    </div>
                  </div>

                  {/* Ronde 2 (alleen als die er is) */}
                  {session.round2Results.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-cyan-400 mb-3 uppercase tracking-wider mt-2">Ronde 2</h3>
                        <div className="space-y-4">
                            {session.round2Results.map((r, i) => <MatchResultDisplay key={`r2-${i}`} result={r} teams={session.teams} />)}
                        </div>
                      </div>
                  )}
                </div>
                
                <div className="mt-8 text-center text-gray-500 text-xs">
                    Gegenereerd door Bounceball App
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
