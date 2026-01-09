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
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Setup States
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

  const possibilities = useMemo(() => {
    const options = [];
    const playersPerMatch = playersPerTeam * 2;
    const minNeededForRoles = hallsCount * 3; // 1 scheids + 2 wissels per zaal minstens nodig

    for (let n = playersPerMatch; n <= 100; n++) {
      const totalPlayerSpotsNeeded = n * matchesPerPlayer;
      const spotsAvailablePerRound = hallsCount * playersPerMatch;
      if (totalPlayerSpotsNeeded % spotsAvailablePerRound === 0) {
        options.push({
          playerCount: n,
          totalRounds: totalPlayerSpotsNeeded / spotsAvailablePerRound,
        });
      }
    }
    return options;
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  // --- CO-OP ANALYSE LOGICA ---
  const coOpData = useMemo(() => {
    if (!session) return [];
    
    const pairCounts = new Map<string, number>();
    const participants = players.filter(p => session.standings.some(s => s.playerId === p.id));
    
    // Initialiseer alle mogelijke paren op 0
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const key = [participants[i].id, participants[j].id].sort().join('-');
        pairCounts.set(key, 0);
      }
    }

    // Tel combinaties in de gegenereerde rondes
    session.rounds.forEach(round => {
      round.matches.forEach(match => {
        const countPairs = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const key = [team[i].id, team[j].id].sort().join('-');
              if (pairCounts.has(key)) {
                pairCounts.set(key, pairCounts.get(key)! + 1);
              }
            }
          }
        };
        countPairs(match.team1);
        countPairs(match.team2);
      });
    });

    return Array.from(pairCounts.entries()).map(([key, count]) => {
      const [id1, id2] = key.split('-').map(Number);
      return {
        p1: players.find(p => p.id === id1)?.name || '?',
        p2: players.find(p => p.id === id2)?.name || '?',
        count
      };
    }).sort((a, b) => b.count - a.count || a.p1.localeCompare(b.p1));
  }, [session, players]);

  const filteredCoOp = coOpData.filter(d => 
    d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.p2.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartTournament = () => {
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

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20"><TrophyIcon className="w-8 h-8 text-white" /></div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase italic">NK Master Planner</h2>
              <p className="text-amber-500/80 text-xs font-bold uppercase tracking-widest">Stap 1: Bereken je toernooi</p>
            </div>
          </div>

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
               <h3 className="text-white font-bold text-sm uppercase mb-4 tracking-widest">Mogelijkheden:</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {possibilities.map(opt => (
                    <button 
                      key={opt.playerCount}
                      onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${targetPlayerCount === opt.playerCount ? 'bg-amber-500/20 border-amber-500 shadow-lg' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}
                    >
                      <div className="flex justify-between items-center"><span className="text-xl font-black text-white">{opt.playerCount} Spelers</span></div>
                      <p className="text-gray-400 text-xs mt-1">Totaal: {opt.totalRounds} rondes.</p>
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {targetPlayerCount && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic">Selecteer {targetPlayerCount} Spelers</h3>
                  <p className={`text-sm font-bold ${selectedPlayerIds.size === targetPlayerCount ? 'text-green-500' : 'text-amber-500'}`}>{selectedPlayerIds.size} geselecteerd</p>
                </div>
                {selectedPlayerIds.size === targetPlayerCount && (
                   <button onClick={handleStartTournament} className="bg-green-600 hover:bg-green-500 text-white font-black px-8 py-3 rounded-xl shadow-lg transition-all transform hover:scale-105 uppercase text-sm">Genereer Schema</button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-gray-900 rounded-3xl border border-gray-700">
                {players.map(p => (
                  <button key={p.id} onClick={() => {
                    const next = new Set(selectedPlayerIds);
                    if (next.has(p.id)) next.delete(p.id); else if (next.size < targetPlayerCount!) next.add(p.id);
                    setSelectedPlayerIds(next);
                  }} className={`p-3 rounded-xl text-xs font-bold border transition-all ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 opacity-60'}`}>{p.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          .match-card { border: 2px solid black !important; margin-bottom: 20px; page-break-inside: avoid; padding: 15px; background: white !important; }
          .match-card * { color: black !important; }
        }
      `}</style>

      <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <h2 className="text-xl font-black text-white italic uppercase">NK Dashboard</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {['schedule', 'standings', 'analysis'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === tab ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}
            >
              {tab === 'schedule' ? 'Schema' : tab === 'standings' ? 'Dag-Stand' : 'Co-op Check'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => {if(window.confirm("NK wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase">Reset</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' && (
          <div className="space-y-12">
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="text-2xl font-black text-amber-500 uppercase tracking-widest border-b border-gray-700 pb-2">Ronde {round.roundNumber}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => (
                    <div key={match.id} className="match-card bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                      <div className="bg-gray-700/50 p-3 flex justify-between text-[10px] font-black uppercase">
                        <span>Zaal {match.hallIndex}</span>
                        <span className="text-amber-400 underline">Scheids: {match.referee.name}</span>
                      </div>
                      <div className="p-5 flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">{match.team1.map(p => <div key={p.id} className="text-sm font-bold text-white">{p.name}</div>)}</div>
                        <div className="no-print flex items-center gap-2">
                          <input type="number" value={match.team1Score} onChange={(e) => updateScore(rIdx, mIdx, 1, parseInt(e.target.value) || 0)} className="w-10 h-10 bg-gray-900 rounded-lg text-center font-black text-white border border-gray-700" />
                          <span className="text-gray-600 font-bold">-</span>
                          <input type="number" value={match.team2Score} onChange={(e) => updateScore(rIdx, mIdx, 2, parseInt(e.target.value) || 0)} className="w-10 h-10 bg-gray-900 rounded-lg text-center font-black text-white border border-gray-700" />
                        </div>
                        <div className="flex-1 text-right space-y-1">{match.team2.map(p => <div key={p.id} className="text-sm font-bold text-white">{p.name}</div>)}</div>
                      </div>
                      <div className="p-2 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-4 text-[8px] font-bold text-gray-500 uppercase">
                        <span>Res 1: {match.subHigh.name}</span><span>Res 2: {match.subLow.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <tr><th className="px-6 py-5">#</th><th className="px-6 py-5">Naam</th><th className="px-6 py-5 text-center">W</th><th className="px-6 py-5 text-center">PTN</th><th className="px-6 py-5 text-center">DS</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="px-6 py-4 font-black text-amber-500">{idx + 1}.</td>
                    <td className="px-6 py-4 font-bold text-white uppercase">{entry.playerName}</td>
                    <td className="px-6 py-4 text-center text-gray-400 font-bold">{entry.matchesPlayed}</td>
                    <td className="px-6 py-4 text-center"><span className="bg-gray-700 text-amber-400 px-3 py-1 rounded-full font-black">{entry.points}</span></td>
                    <td className={`px-6 py-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : 'text-red-500'}`}>{entry.goalDifference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4 no-print">
            <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700">
              <input 
                type="text" 
                placeholder="Zoek speler om combinaties te checken..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 text-sm focus:ring-2 ring-amber-500 outline-none"
              />
            </div>
            <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black sticky top-0">
                    <tr><th className="px-6 py-4">Speler 1</th><th className="px-6 py-4">Speler 2</th><th className="px-6 py-4 text-center">Samen</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredCoOp.map((pair, i) => (
                      <tr key={i} className={pair.count > 1 ? 'bg-red-500/5' : pair.count === 0 ? 'opacity-40' : ''}>
                        <td className="px-6 py-3 text-sm font-bold text-gray-200">{pair.p1}</td>
                        <td className="px-6 py-3 text-sm font-bold text-gray-200">{pair.p2}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full font-black text-xs ${pair.count === 0 ? 'bg-gray-900 text-gray-600' : pair.count > 1 ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                            {pair.count}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NKManager;
