import React, { useState, useMemo, useEffect } from 'react';
import { Player, NKSession, NKMatch, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import UsersIcon from './icons/UsersIcon';
import FutbolIcon from './icons/FutbolIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  // States
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings'>('schedule');
  
  // Setup States
  const [hallsCount, setHallsCount] = useState(2);
  const [totalRounds, setTotalRounds] = useState(6);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  // Laden uit localStorage bij opstarten
  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) {
      setSession(JSON.parse(saved));
    }
  }, []);

  // Opslaan in localStorage bij wijzigingen
  useEffect(() => {
    if (session) {
      localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
    }
  }, [session]);

  // --- LOGICA ---

  const handleStartTournament = () => {
    const participants = players.filter(p => selectedPlayerIds.has(p.id));
    if (participants.length < (hallsCount * 10)) {
      alert(`Je hebt minimaal ${hallsCount * 10} spelers nodig voor ${hallsCount} zalen.`);
      return;
    }

    const newSession = generateNKSchedule(
      participants,
      hallsCount,
      totalRounds,
      "NK Toernooi"
    );
    setSession(newSession);
  };

  const updateScore = (roundIdx: number, matchIdx: number, team: 1 | 2, score: number) => {
    if (!session) return;

    const newSession = { ...session };
    const match = newSession.rounds[roundIdx].matches[matchIdx];
    
    if (team === 1) match.team1Score = score;
    else match.team2Score = score;

    // Herbereken de stand direct
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();

    // Initialiseer iedereen op 0
    s.standings.forEach(entry => {
      stats.set(entry.playerId, { ...entry, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 });
    });

    // Loop door alle gespeelde wedstrijden
    s.rounds.forEach(round => {
      round.matches.forEach(match => {
        // Alleen tellen als er een score is ingevuld (beide 0-0 telt ook als gespeeld)
        // We gaan ervan uit dat als de scores zijn aangeraakt, de pot gespeeld is.
        const p1 = match.team1Score > match.team2Score ? 3 : match.team1Score === match.team2Score ? 1 : 0;
        const p2 = match.team2Score > match.team1Score ? 3 : match.team1Score === match.team2Score ? 1 : 0;

        match.team1.forEach(player => {
          const st = stats.get(player.id)!;
          st.matchesPlayed++;
          st.points += p1;
          st.goalsFor += match.team1Score;
          st.goalDifference += (match.team1Score - match.team2Score);
        });

        match.team2.forEach(player => {
          const st = stats.get(player.id)!;
          st.matchesPlayed++;
          st.points += p2;
          st.goalsFor += match.team2Score;
          st.goalDifference += (match.team2Score - match.team1Score);
        });
      });
    });

    return Array.from(stats.values()).sort((a, b) => 
      b.points - a.points || 
      b.goalDifference - a.goalDifference || 
      b.goalsFor - a.goalsFor
    );
  };

  const handleReset = () => {
    if (window.confirm("Weet je zeker dat je het hele NK wilt wissen? Dit kan niet ongedaan worden gemaakt.")) {
      localStorage.removeItem('bounceball_nk_session');
      setSession(null);
    }
  };

  // --- RENDER HELPERS ---

  if (!session) {
    // SETUP SCHERM
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-amber-500/30">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/20">
              <TrophyIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">NK Setup</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">Aantal Zalen (wedstrijden tegelijk)</span>
                <input 
                  type="number" 
                  value={hallsCount} 
                  onChange={(e) => setHallsCount(Math.max(1, parseInt(e.target.value)))}
                  className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-lg text-white p-3 focus:ring-amber-500 focus:border-amber-500"
                />
              </label>
              <label className="block">
                <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">Totaal aantal rondes</span>
                <input 
                  type="number" 
                  value={totalRounds} 
                  onChange={(e) => setTotalRounds(Math.max(1, parseInt(e.target.value)))}
                  className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-lg text-white p-3 focus:ring-amber-500 focus:border-amber-500"
                />
              </label>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
              <h4 className="text-amber-400 font-bold mb-2">Toernooi Info</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• {selectedPlayerIds.size} spelers geselecteerd.</li>
                <li>• Per ronde spelen {hallsCount * 10} mensen.</li>
                <li>• Per zaal: 1 scheids + 2 reserves (rustende spelers).</li>
                <li>• Stand: 3pt winst, 1pt gelijkspel.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Selecteer Spelers</h3>
                <button 
                  onClick={() => setSelectedPlayerIds(new Set(players.map(p => p.id)))}
                  className="text-xs text-amber-500 hover:text-amber-400 font-bold uppercase"
                >
                  Selecteer Iedereen
                </button>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 bg-gray-900 rounded-xl">
               {players.map(player => (
                 <button
                   key={player.id}
                   onClick={() => {
                     const next = new Set(selectedPlayerIds);
                     if (next.has(player.id)) next.delete(player.id);
                     else next.add(player.id);
                     setSelectedPlayerIds(next);
                   }}
                   className={`p-2 rounded-lg text-xs font-bold transition-all border ${
                    selectedPlayerIds.has(player.id) 
                      ? 'bg-amber-500 border-amber-400 text-white' 
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                   }`}
                 >
                   {player.name}
                 </button>
               ))}
             </div>
          </div>

          <button
            onClick={handleStartTournament}
            disabled={selectedPlayerIds.size === 0}
            className="w-full mt-8 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50"
          >
            GENEREER NK SCHEMA
          </button>
        </div>
      </div>
    );
  }

  // TOERNOOI DASHBOARD
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Nav */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl shadow-lg border-b-4 border-amber-500">
        <h2 className="text-2xl font-black text-white italic">NK MASTER PLANNER</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'schedule' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}
          >
            SCHEMA
          </button>
          <button 
            onClick={() => setActiveTab('standings')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'standings' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}
          >
            STAND
          </button>
        </div>
        <button onClick={handleReset} className="text-[10px] text-red-500 font-bold uppercase border border-red-500/30 px-2 py-1 rounded">Stop NK</button>
      </div>

      {activeTab === 'schedule' ? (
        <div className="space-y-12">
          {session.rounds.map((round, rIdx) => (
            <div key={rIdx} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-700"></div>
                <h3 className="text-2xl font-black text-amber-500 uppercase tracking-widest">Ronde {round.roundNumber}</h3>
                <div className="h-px flex-1 bg-gray-700"></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {round.matches.map((match, mIdx) => (
                  <div key={match.id} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-700">
                    <div className="bg-gray-700/50 p-3 flex justify-between items-center border-b border-gray-600">
                      <span className="text-xs font-black text-gray-400 uppercase">Zaal {match.hallIndex}</span>
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        <span>Scheids: {match.referee.name}</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        {/* Team 1 */}
                        <div className="flex-1 space-y-1">
                          {match.team1.map(p => (
                            <div key={p.id} className={`text-sm ${p.isKeeper ? 'text-amber-400 font-bold' : 'text-gray-200'}`}>
                              {p.name} {p.isKeeper && '(K)'}
                            </div>
                          ))}
                        </div>

                        {/* Scores */}
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            value={match.team1Score}
                            onChange={(e) => updateScore(rIdx, mIdx, 1, parseInt(e.target.value) || 0)}
                            className="w-14 h-14 bg-gray-900 border-2 border-gray-700 rounded-xl text-center text-2xl font-black text-white focus:border-amber-500 transition-colors"
                          />
                          <span className="text-gray-600 font-black">-</span>
                          <input 
                            type="number"
                            value={match.team2Score}
                            onChange={(e) => updateScore(rIdx, mIdx, 2, parseInt(e.target.value) || 0)}
                            className="w-14 h-14 bg-gray-900 border-2 border-gray-700 rounded-xl text-center text-2xl font-black text-white focus:border-amber-500 transition-colors"
                          />
                        </div>

                        {/* Team 2 */}
                        <div className="flex-1 text-right space-y-1">
                          {match.team2.map(p => (
                            <div key={p.id} className={`text-sm ${p.isKeeper ? 'text-amber-400 font-bold' : 'text-gray-200'}`}>
                              {p.isKeeper && '(K)'} {p.name}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Reserves Onderaan */}
                      <div className="mt-6 pt-4 border-t border-gray-700/50 flex justify-center gap-8">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 uppercase font-black">Reserve High</p>
                          <p className="text-xs font-bold text-gray-300">{match.subHigh.name}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 uppercase font-black">Reserve Low</p>
                          <p className="text-xs font-bold text-gray-300">{match.subLow.name}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Standen Tab */
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black">
              <tr>
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Speler</th>
                <th className="px-6 py-4 text-center">W</th>
                <th className="px-6 py-4 text-center">PTN</th>
                <th className="px-6 py-4 text-center">DS</th>
                <th className="px-6 py-4 text-center">GV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {session.standings.map((entry, idx) => (
                <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                  <td className="px-6 py-4 font-black text-amber-500">{idx + 1}.</td>
                  <td className="px-6 py-4 font-bold text-white">{entry.playerName}</td>
                  <td className="px-6 py-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-700 text-white px-3 py-1 rounded-full font-black">{entry.points}</span>
                  </td>
                  <td className={`px-6 py-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-400">{entry.goalsFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NKManager;
