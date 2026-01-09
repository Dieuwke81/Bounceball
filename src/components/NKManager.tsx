import React, { useState, useEffect } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings'>('schedule');
  const [hallsCount, setHallsCount] = useState(2);
  const [totalRounds, setTotalRounds] = useState(6);
  const [playersPerTeam, setPlayersPerTeam] = useState(5); // Keuze 4 of 5
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
  }, [session]);

  const handleStartTournament = () => {
    const participants = players.filter(p => selectedPlayerIds.has(p.id));
    const minNeeded = hallsCount * playersPerTeam * 2;
    if (participants.length < minNeeded) {
      alert(`Je hebt minimaal ${minNeeded} spelers nodig voor ${hallsCount} zalen met ${playersPerTeam} spelers per team.`);
      return;
    }
    const newSession = generateNKSchedule(participants, hallsCount, totalRounds, playersPerTeam, "NK Toernooi");
    setSession(newSession);
  };

  const updateScore = (roundIdx: number, matchIdx: number, team: 1 | 2, score: number) => {
    if (!session) return;
    const newSession = { ...session };
    const match = newSession.rounds[roundIdx].matches[matchIdx];
    if (team === 1) match.team1Score = score;
    else match.team2Score = score;
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();
    s.standings.forEach(entry => stats.set(entry.playerId, { ...entry, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 }));

    s.rounds.forEach(round => {
      round.matches.forEach(match => {
        const p1 = match.team1Score > match.team2Score ? 3 : match.team1Score === match.team2Score ? 1 : 0;
        const p2 = match.team2Score > match.team1Score ? 3 : match.team1Score === match.team2Score ? 1 : 0;
        match.team1.forEach(player => {
          const st = stats.get(player.id)!;
          st.matchesPlayed++; st.points += p1; st.goalsFor += match.team1Score; st.goalDifference += (match.team1Score - match.team2Score);
        });
        match.team2.forEach(player => {
          const st = stats.get(player.id)!;
          st.matchesPlayed++; st.points += p2; st.goalsFor += match.team2Score; st.goalDifference += (match.team2Score - match.team1Score);
        });
      });
    });
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    if (window.confirm("NK wissen?")) {
      localStorage.removeItem('bounceball_nk_session');
      setSession(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-amber-500/30">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-500 rounded-xl"><TrophyIcon className="w-8 h-8 text-white" /></div>
            <h2 className="text-3xl font-extrabold text-white">NK Toernooi Setup</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-400 text-sm font-bold uppercase">Zalen</span>
                <input type="number" value={hallsCount} onChange={(e) => setHallsCount(Math.max(1, parseInt(e.target.value)))} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-lg text-white p-3" />
              </label>
              <label className="block">
                <span className="text-gray-400 text-sm font-bold uppercase">Rondes</span>
                <input type="number" value={totalRounds} onChange={(e) => setTotalRounds(Math.max(1, parseInt(e.target.value)))} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-lg text-white p-3" />
              </label>
              <label className="block">
                <span className="text-gray-400 text-sm font-bold uppercase">Spelers per team</span>
                <div className="flex gap-4 mt-2">
                  {[4, 5].map(num => (
                    <button key={num} onClick={() => setPlayersPerTeam(num)} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${playersPerTeam === num ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>
                      {num} Spelers
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 text-sm text-gray-400 space-y-2">
              <p className="text-amber-400 font-bold uppercase">Huidige selectie:</p>
              <p>• {selectedPlayerIds.size} spelers geselecteerd.</p>
              <p>• Nodig per ronde: {hallsCount * playersPerTeam * 2} man.</p>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-white">Selecteer Spelers</h3><button onClick={() => setSelectedPlayerIds(new Set(players.map(p => p.id)))} className="text-xs text-amber-500 font-bold uppercase">Iedereen</button></div>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-900 rounded-xl">
               {players.map(player => (
                 <button key={player.id} onClick={() => {
                   const next = new Set(selectedPlayerIds);
                   if (next.has(player.id)) next.delete(player.id); else next.add(player.id);
                   setSelectedPlayerIds(next);
                 }} className={`p-2 rounded-lg text-xs font-bold border ${selectedPlayerIds.has(player.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>{player.name}</button>
               ))}
             </div>
          </div>

          <button onClick={handleStartTournament} disabled={selectedPlayerIds.size === 0} className="w-full mt-8 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black py-4 rounded-xl shadow-lg transform hover:scale-[1.02]">GENEREER NK SCHEMA</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; color: black !important; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          .match-card { border: 1px solid black !important; margin-bottom: 10px; padding: 10px; }
        }
      `}</style>

      <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-lg">
        <h2 className="text-2xl font-black text-white italic">NK MANAGER</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          <button onClick={() => setActiveTab('schedule')} className={`px-6 py-2 rounded-lg font-bold text-sm ${activeTab === 'schedule' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>SCHEMA</button>
          <button onClick={() => setActiveTab('standings')} className={`px-6 py-2 rounded-lg font-bold text-sm ${activeTab === 'standings' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>STAND</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-bold">PRINT SCHEMA</button>
          <button onClick={handleReset} className="text-[10px] text-red-500 font-bold border border-red-500/30 px-2 py-1 rounded">STOP NK</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' ? (
          <div className="space-y-10">
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4 page-break">
                <h3 className="text-2xl font-black text-amber-500 uppercase">Ronde {round.roundNumber}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {round.matches.map((match) => (
                    <div key={match.id} className="match-card bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-md">
                      <div className="bg-gray-700/50 p-3 flex justify-between text-xs font-bold">
                        <span className="text-gray-400">ZAAL {match.hallIndex}</span>
                        <span className="text-amber-400">SCHEIDS: {match.referee.name}</span>
                      </div>
                      <div className="p-4 flex items-center justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          {match.team1.map(p => <div key={p.id} className="text-sm text-white">{p.name}</div>)}
                        </div>
                        <div className="no-print flex items-center gap-2">
                          <input type="number" value={match.team1Score} onChange={(e) => updateScore(rIdx, match.hallIndex-1, 1, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-lg text-center font-black text-xl text-white" />
                          <span className="text-gray-600">-</span>
                          <input type="number" value={match.team2Score} onChange={(e) => updateScore(rIdx, match.hallIndex-1, 2, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-lg text-center font-black text-xl text-white" />
                        </div>
                        <div className="flex-1 text-right space-y-1">
                          {match.team2.map(p => <div key={p.id} className="text-sm text-white">{p.name}</div>)}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-6 text-[10px] font-bold text-gray-400">
                        <span>RES HIGH: {match.subHigh.name}</span>
                        <span>RES LOW: {match.subLow.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black">
                <tr><th className="px-6 py-4">#</th><th className="px-6 py-4">Speler</th><th className="px-6 py-4 text-center">W</th><th className="px-6 py-4 text-center">PTN</th><th className="px-6 py-4 text-center">DS</th><th className="px-6 py-4 text-center">GV</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="px-6 py-4 font-black text-amber-500">{idx + 1}.</td>
                    <td className="px-6 py-4 font-bold text-white">{entry.playerName}</td>
                    <td className="px-6 py-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                    <td className="px-6 py-4 text-center"><span className="bg-gray-700 text-white px-3 py-1 rounded-full font-black">{entry.points}</span></td>
                    <td className={`px-6 py-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                    <td className="px-6 py-4 text-center text-gray-400">{entry.goalsFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NKManager;
