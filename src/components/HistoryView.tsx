import React, { useState } from 'react';
import type { GameSession, Player } from '../types';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';
import DownloadIcon from './icons/DownloadIcon';
import ArchiveIcon from './icons/ArchiveIcon';
import TrashIcon from './icons/TrashIcon';

interface HistoryViewProps {
  history: GameSession[];
  players: Player[];
  onDeleteSession: (date: string) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, players, onDeleteSession }) => {
  const [expandedSessionDate, setExpandedSessionDate] = useState<string | null>(null);

  const toggleSession = (date: string) => {
    setExpandedSessionDate(expandedSessionDate === date ? null : date);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, date: string) => {
    e.stopPropagation();
    if (window.confirm("⚠️ Weet je het zeker?\n\nJe staat op het punt deze wedstrijd definitief te verwijderen. Dit kan niet ongedaan worden gemaakt.")) {
      onDeleteSession(date);
    }
  };

  // --- 1. EXPORT PER SESSIE (Regel) ---
  const exportSessionToCSV = (session: GameSession) => {
    const playerStats = new Map<number, { goals: number; points: number }>();
    const allMatches = [...session.round1Results, ...session.round2Results];

    allMatches.forEach(match => {
        const team1 = session.teams[match.team1Index];
        const team2 = session.teams[match.team2Index];
        if(!team1 || !team2) return;
        
        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        let team1Points = 0;
        let team2Points = 0;
        if (team1Score > team2Score) team1Points = 3;
        else if (team2Score > team1Score) team2Points = 3;
        else { team1Points = 1; team2Points = 1; }

        team1.forEach(p => {
            const current = playerStats.get(p.id) || { goals: 0, points: 0 };
            const pGoals = match.team1Goals.find(g => g.playerId === p.id)?.count || 0;
            playerStats.set(p.id, { goals: current.goals + pGoals, points: current.points + team1Points });
        });
        team2.forEach(p => {
            const current = playerStats.get(p.id) || { goals: 0, points: 0 };
            const pGoals = match.team2Goals.find(g => g.playerId === p.id)?.count || 0;
            playerStats.set(p.id, { goals: current.goals + pGoals, points: current.points + team2Points });
        });
    });

    let csvContent = "Naam,Rating,Goals,Punten\n";
    const uniquePlayers = new Set<Player>();
    session.teams.flat().forEach(p => uniquePlayers.add(p));

    uniquePlayers.forEach(player => {
        const stats = playerStats.get(player.id) || { goals: 0, points: 0 };
        const rating = typeof player.rating === 'number' ? player.rating.toFixed(2) : player.rating;
        csvContent += `${player.name},${rating},${stats.goals},${stats.points}\n`;
    });

    downloadCSV(csvContent, `Uitslag_${session.date.split('T')[0]}.csv`);
  };

  // --- 2. EXPORT ALLES (Groene knop bovenaan) ---
  const exportAllToCSV = () => {
    const stats = new Map<number, { name: string; rating: number; matches: number; goals: number; points: number }>();

    history.forEach(session => {
        const allMatches = [...session.round1Results, ...session.round2Results];
        allMatches.forEach(match => {
            const team1 = session.teams[match.team1Index];
            const team2 = session.teams[match.team2Index];
            if (!team1 || !team2) return;

            const score1 = match.team1Goals.reduce((a, b) => a + b.count, 0);
            const score2 = match.team2Goals.reduce((a, b) => a + b.count, 0);

            let pts1 = 0; let pts2 = 0;
            if (score1 > score2) pts1 = 3;
            else if (score2 > score1) pts2 = 3;
            else { pts1 = 1; pts2 = 1; }

            team1.forEach(p => {
                const current = stats.get(p.id) || { name: p.name, rating: p.rating, matches: 0, goals: 0, points: 0 };
                const goals = match.team1Goals.find(g => g.playerId === p.id)?.count || 0;
                stats.set(p.id, { ...current, matches: current.matches + 1, goals: current.goals + goals, points: current.points + pts1 });
            });
            team2.forEach(p => {
                const current = stats.get(p.id) || { name: p.name, rating: p.rating, matches: 0, goals: 0, points: 0 };
                const goals = match.team2Goals.find(g => g.playerId === p.id)?.count || 0;
                stats.set(p.id, { ...current, matches: current.matches + 1, goals: current.goals + goals, points: current.points + pts2 });
            });
        });
    });

    let csvContent = "Naam,Rating,Wedstrijden,Doelpunten,Punten,Gem. Punten/Wedstrijd\n";
    Array.from(stats.values())
        .sort((a, b) => b.points - a.points || b.goals - a.goals)
        .forEach(stat => {
            const avgPoints = stat.matches > 0 ? (stat.points / stat.matches).toFixed(2) : "0.00";
            csvContent += `${stat.name},${stat.rating.toFixed(2)},${stat.matches},${stat.goals},${stat.points},${avgPoints}\n`;
        });

    downloadCSV(csvContent, `Totaal_Historie_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      {/* HEADER MET DE GROENE KNOP TERUG */}
      <div className="flex items-center justify-between mb-6">
         <h2 className="text-2xl font-bold text-white">Wedstrijdgeschiedenis</h2>
         
         {/* DEZE KNOP IS HERSTELD */}
         <button 
            onClick={exportAllToCSV}
            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
            title="Download Volledige Historie (CSV)"
         >
            <DownloadIcon className="w-6 h-6" />
         </button>
      </div>
      
      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="text-gray-400 text-center py-4">Nog geen wedstrijden gespeeld.</p>
        ) : (
          history.map((session) => (
            <div key={session.date} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-650 transition-colors"
                onClick={() => toggleSession(session.date)}
              >
                <div>
                  <h3 className="text-lg font-bold text-white capitalize">{formatDate(session.date)}</h3>
                  <p className="text-sm text-gray-400">{session.date.split('T')[0]}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* CSV Button PER SESSIE */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); exportSessionToCSV(session); }}
                    className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-full text-white transition-colors"
                    title="Download CSV van deze avond"
                  >
                    <ArchiveIcon className="w-4 h-4" />
                  </button>

                  {/* Verwijder Knop */}
                  <button 
                    onClick={(e) => handleDeleteClick(e, session.date)}
                    className="p-2 bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white rounded-full transition-all duration-200"
                    title="Verwijder Wedstrijd"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>

                  <div className="ml-2 text-gray-400">
                    {expandedSessionDate === session.date ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
                  </div>
                </div>
              </div>

              {expandedSessionDate === session.date && (
                <div className="p-4 border-t border-gray-600 bg-gray-800/50 text-sm text-gray-300">
                    <div className="mb-4">
                        <h4 className="font-bold text-white mb-2">Uitslagen</h4>
                        {session.round1Results && session.round1Results.length > 0 ? (
                            <ul className="space-y-1">
                                {[...session.round1Results, ...session.round2Results].map((r: any, idx: number) => {
                                    const score1 = r.team1Goals.reduce((a:any, b:any) => a + b.count, 0);
                                    const score2 = r.team2Goals.reduce((a:any, b:any) => a + b.count, 0);
                                    return (
                                        <li key={idx} className="flex justify-between max-w-xs">
                                            <span>Team {r.team1Index + 1} vs Team {r.team2Index + 1}</span>
                                            <span className="font-mono font-bold text-white">{score1} - {score2}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                           <p className="italic text-gray-500">Geen details beschikbaar</p>
                        )}
                    </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;
