import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import UsersIcon from './icons/UsersIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings'>('schedule');
  
  // Calculator & Setup States
  const [hallsCount, setHallsCount] = useState(2);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(6);
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
  }, [session]);

  // --- CALCULATOR LOGICA ---
  // Berekent welke aantallen spelers mogelijk zijn voor een perfect schema
  const possibilities = useMemo(() => {
    const options = [];
    const playersPerMatch = playersPerTeam * 2;
    const minNeededForRoles = hallsCount * (playersPerMatch + 3); // Spelers + 1 scheids + 2 wissels per zaal

    // We checken mogelijke aantallen spelers van minNeeded tot 100
    for (let n = minNeededForRoles; n <= 100; n++) {
      // De rekensom: (Aantal spelers * wedstrijden p.p.) moet deelbaar zijn door (Zalen * spelers per match)
      const totalPlayerSpotsNeeded = n * matchesPerPlayer;
      const spotsAvailablePerRound = hallsCount * playersPerMatch;

      if (totalPlayerSpotsNeeded % spotsAvailablePerRound === 0) {
        const totalRounds = totalPlayerSpotsNeeded / spotsAvailablePerRound;
        options.push({
          playerCount: n,
          totalRounds: totalRounds,
          matchesPerRound: hallsCount
        });
      }
    }
    return options;
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  const handleStartTournament = () => {
    if (selectedPlayerIds.size !== targetPlayerCount) {
      alert(`Je hebt ${targetPlayerCount} spelers nodig volgens je berekening, maar je hebt er nu ${selectedPlayerIds.size} geselecteerd.`);
      return;
    }
    const participants = players.filter(p => selectedPlayerIds.has(p.id));
    const newSession = generateNKSchedule(participants, hallsCount, matchesPerPlayer, playersPerTeam, "NK Toernooi");
    setSession(newSession);
  };

  const updateScore = (roundIdx: number, matchIdx: number, team: 1 | 2, score: number) => {
    if (!session) return;
    const newSession = { ...session };
    const match = newSession.rounds[roundIdx].matches[matchIdx];
    if (team === 1) match.team1Score = score; else match.team2Score = score;
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();
    s.standings.forEach(e => stats.set(e.playerId, { ...e, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 }));
    s.rounds.forEach(r => {
      r.matches.forEach(m => {
        const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
        const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
        m.team1.forEach(p => { const st = stats.get(p.id)!; st.matchesPlayed++; st.points += p1; st.goalsFor += m.team1Score; st.goalDifference += (m.team1Score - m.team2Score); });
        m.team2.forEach(p => { const st = stats.get(p.id)!; st.matchesPlayed++; st.points += p2; st.goalsFor += m.team2Score; st.goalDifference += (m.team2Score - m.team1Score); });
      });
    });
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  };

  const handleReset = () => {
    if (window.confirm("NK wissen?")) {
      localStorage.removeItem('bounceball_nk_session');
      setSession(null);
    }
  };

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
              <TrophyIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">NK Master Planner</h2>
              <p className="text-amber-500/80 text-xs font-bold uppercase tracking-widest">Stap 1: Bereken je toernooi</p>
            </div>
          </div>

          {/* CONFIGURATIE BEREKENING */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
               <h3 className="text-white font-bold text-sm uppercase mb-4 border-b border-gray-700 pb-2">Instellingen</h3>
               <div className="space-y-4">
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase">Zalen</span>
                    <input type="number" value={hallsCount} onChange={(e) => {setHallsCount(Math.max(1, parseInt(e.target.value))); setTargetPlayerCount(null);}} className="mt-1 block w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold focus:ring-2 ring-amber-500 outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase">Wedstrijden p.p.</span>
                    <input type="number" value={matchesPerPlayer} onChange={(e) => {setMatchesPerPlayer(Math.max(1, parseInt(e.target.value))); setTargetPlayerCount(null);}} className="mt-1 block w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold focus:ring-2 ring-amber-500 outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase">Team Grootte</span>
                    <div className="flex gap-2 mt-1">
                      {[4, 5].map(n => (
                        <button key={n} onClick={() => {setPlayersPerTeam(n); setTargetPlayerCount(null);}} className={`flex-1 py-3 rounded-xl font-black transition-all border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>
                      ))}
                    </div>
                  </label>
               </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
               <h3 className="text-white font-bold text-sm uppercase mb-4">Mogelijkheden (Kies er één):</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {possibilities.length > 0 ? possibilities.map(opt => (
                    <button 
                      key={opt.playerCount}
                      onClick={() => {
                        setTargetPlayerCount(opt.playerCount);
                        setSelectedPlayerIds(new Set()); // Reset selectie bij nieuwe keuze
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${targetPlayerCount === opt.playerCount ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-black text-white">{opt.playerCount} Spelers</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${targetPlayerCount === opt.playerCount ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-400'}`}>OPTIMAAL</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">Totaal: {opt.totalRounds} rondes over {hallsCount} zalen.</p>
                    </button>
                  )) : (
                    <p className="text-red-400 text-sm italic">Geen scenario gevonden. Verander de instellingen.</p>
                  )}
               </div>
            </div>
          </div>

          {/* SPELER SELECTIE */}
          {targetPlayerCount && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic">Selectie</h3>
                  <p className={`text-sm font-bold ${selectedPlayerIds.size === targetPlayerCount ? 'text-green-500' : 'text-amber-500'}`}>
                    {selectedPlayerIds.size} van de {targetPlayerCount} spelers geselecteerd
                  </p>
                </div>
                {selectedPlayerIds.size === targetPlayerCount && (
                   <button onClick={handleStartTournament} className="bg-green-600 hover:bg-green-500 text-white font-black px-8 py-3 rounded-xl shadow-lg transition-all transform hover:scale-105 uppercase tracking-widest text-sm">Maak Schema</button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-80 overflow-y-auto p-4 bg-gray-900 rounded-3xl border border-gray-700">
                {players.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => {
                      const next = new Set(selectedPlayerIds);
                      if (next.has(p.id)) next.delete(p.id);
                      else if (next.size < targetPlayerCount!) next.add(p.id);
                      setSelectedPlayerIds(next);
                    }}
                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white scale-95 shadow-inner' : 'bg-gray-800 border-gray-700 text-gray-500 opacity-60'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // TOERNOOI DASHBOARD (Zelfde als voorheen maar zonder (K) markering)
  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body { background: white !important; padding: 0; }
          .no-print { display: none !important; }
          .print-area { display: block !important; color: black !important; }
          .match-card { border: 2px solid black !important; margin-bottom: 20px; page-break-inside: avoid; padding: 15px; color: black !important; background: white !important; }
          .match-card div, .match-card span { color: black !important; }
          .round-title { font-size: 24px; font-weight: bold; border-bottom: 3px solid black; margin-top: 30px; margin-bottom: 10px; }
        }
      `}</style>

      <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <h2 className="text-xl font-black text-white italic">NK MANAGER</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          <button onClick={() => setActiveTab('schedule')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'schedule' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>SCHEMA</button>
          <button onClick={() => setActiveTab('standings')} className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'standings' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>DAG-STAND</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={handleReset} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase">Reset NK</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' ? (
          <div className="space-y-12">
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="round-title text-2xl font-black text-amber-500 uppercase tracking-widest border-b border-gray-700 pb-2">Ronde {round.roundNumber}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => (
                    <div key={match.id} className="match-card bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-lg">
                      <div className="bg-gray-700/50 p-3 flex justify-between text-[10px] font-black uppercase">
                        <span>Zaal {match.hallIndex}</span>
                        <span className="text-amber-400">SCHEIDSRECHTER: {match.referee.name}</span>
                      </div>
                      <div className="p-5 flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          {match.team1.map(p => <div key={p.id} className="text-sm font-bold text-white">{p.name}</div>)}
                        </div>
                        <div className="no-print flex items-center gap-2">
                          <input type="number" value={match.team1Score} onChange={(e) => updateScore(rIdx, mIdx, 1, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-lg text-center font-black text-xl text-white border-2 border-gray-700" />
                          <span className="text-gray-600 font-bold">-</span>
                          <input type="number" value={match.team2Score} onChange={(e) => updateScore(rIdx, mIdx, 2, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-lg text-center font-black text-xl text-white border-2 border-gray-700" />
                        </div>
                        <div className="flex-1 text-right space-y-1">
                          {match.team2.map(p => <div key={p.id} className="text-sm font-bold text-white">{p.name}</div>)}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-8 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                        <span>RESERVE 1: {match.subHigh.name}</span>
                        <span>RESERVE 2: {match.subLow.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden animate-fade-in">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <tr><th className="px-6 py-5">#</th><th className="px-6 py-5">Deelnemer</th><th className="px-6 py-5 text-center">W</th><th className="px-6 py-5 text-center">PTN</th><th className="px-6 py-5 text-center">DS</th><th className="px-6 py-5 text-center">GV</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="px-6 py-4 font-black text-amber-500 text-xl italic">{idx + 1}.</td>
                    <td className="px-6 py-4 font-bold text-white uppercase tracking-tight">{entry.playerName}</td>
                    <td className="px-6 py-4 text-center text-gray-400 font-bold">{entry.matchesPlayed}</td>
                    <td className="px-6 py-4 text-center"><span className="bg-gray-700 text-amber-400 px-4 py-1.5 rounded-full font-black text-lg shadow-inner">{entry.points}</span></td>
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
