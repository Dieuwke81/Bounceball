import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightName, setHighlightName] = useState(''); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');

  useEffect(() => {
    const names = Array.from({ length: hallsCount }, (_, i) => hallNames[i] || String.fromCharCode(65 + i));
    setHallNames(names);
  }, [hallsCount]);

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
  }, [session]);

  const isHighlighted = (name: string) => highlightName && name.toLowerCase().includes(highlightName.toLowerCase());

  const handleParseAttendance = () => {
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const lines = attendanceText.split('\n');
    const newSelected = new Set<number>();
    
    lines.forEach(line => {
      const cleaned = line.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].trim();
      const match = players.find(p => normalize(p.name).includes(normalize(cleaned)) || normalize(cleaned).includes(normalize(p.name.split(' ')[0])));
      if (match) newSelected.add(match.id);
    });

    setSelectedPlayerIds(newSelected);
    setAttendanceText('');
  };

  const possibilities = useMemo(() => {
    const options = [];
    const pPerMatch = playersPerTeam * 2;
    for (let n = pPerMatch; n <= 100; n++) {
      if ((n * matchesPerPlayer) % pPerMatch === 0) {
        const totalMatches = (n * matchesPerPlayer) / pPerMatch;
        const h = Math.min(hallsCount, Math.floor(n / (pPerMatch)));
        if (h > 0) options.push({ playerCount: n, hallsToUse: h, totalRounds: Math.ceil(totalMatches / h) });
      }
    }
    return options;
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  const handleStartTournament = async () => {
    const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!chosen || selectedPlayerIds.size !== targetPlayerCount) return;
    
    setIsGenerating(true);
    try {
      const participants = players.filter(p => selectedPlayerIds.has(p.id));
      const newSession = await generateNKSchedule(participants, hallNames.slice(0, chosen.hallsToUse), matchesPerPlayer, playersPerTeam, "NK", setProgressMsg);
      setSession(newSession);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();
    s.rounds.forEach(r => r.matches.forEach(m => {
      [...m.team1, ...m.team2].forEach(p => {
        if (!stats.has(p.id)) stats.set(p.id, { playerId: p.id, playerName: p.name, points: 0, goalsFor: 0, goalDifference: 0, matchesPlayed: 0 });
      });
      if (!m.isPlayed) return;
      const s1 = m.team1Score, s2 = m.team2Score;
      m.team1.forEach(p => {
        const st = stats.get(p.id)!; st.matchesPlayed++; st.goalsFor += s1; st.goalDifference += (s1 - s2);
        st.points += s1 > s2 ? 3 : s1 === s2 ? 1 : 0;
      });
      m.team2.forEach(p => {
        const st = stats.get(p.id)!; st.matchesPlayed++; st.goalsFor += s2; st.goalDifference += (s2 - s1);
        st.points += s2 > s1 ? 3 : s1 === s2 ? 1 : 0;
      });
    }));
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  };

  const updateScore = (rIdx: number, mIdx: number, t1: number, t2: number) => {
    if (!session) return;
    const next = { ...session };
    const m = next.rounds[rIdx].matches[mIdx];
    m.team1Score = t1; m.team2Score = t2; m.isPlayed = true;
    next.standings = calculateStandings(next);
    setSession(next);
  };

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
      <FutbolIcon className="w-16 h-16 text-amber-500 animate-spin mb-6" />
      <h2 className="text-2xl font-black italic uppercase">{progressMsg}</h2>
    </div>
  );

  if (!session) return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-3xl border border-amber-500/30">
      <div className="flex items-center gap-4 mb-8">
        <TrophyIcon className="w-10 h-10 text-amber-500" />
        <h2 className="text-3xl font-black text-white uppercase italic">NK Planner</h2>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="block text-xs font-bold text-gray-400 uppercase">Configuratie</label>
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={hallsCount} onChange={e => setHallsCount(Number(e.target.value))} className="bg-gray-900 text-white p-3 rounded-xl border border-gray-700" placeholder="Zalen" />
            <input type="number" value={matchesPerPlayer} onChange={e => setMatchesPerPlayer(Number(e.target.value))} className="bg-gray-900 text-white p-3 rounded-xl border border-gray-700" placeholder="Wedstrijden p.p." />
          </div>
          <div className="flex gap-2">
            {[4, 5].map(n => (
              <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 p-3 rounded-xl font-bold ${playersPerTeam === n ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{n} vs {n}</button>
            ))}
          </div>
          <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak aanwezigheidslijst..." className="w-full h-32 bg-gray-900 text-white p-3 rounded-xl text-sm border border-gray-700" />
          <button onClick={handleParseAttendance} className="w-full py-2 bg-gray-600 text-white rounded-lg font-bold text-xs uppercase">Check Namen</button>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-4">Selecteer aantal spelers</label>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
            {possibilities.map(opt => (
              <button key={opt.playerCount} onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}} className={`p-4 rounded-xl border-2 text-left ${targetPlayerCount === opt.playerCount ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700'}`}>
                <div className="text-white font-black">{opt.playerCount} Spelers</div>
                <div className="text-gray-500 text-[10px]">{opt.totalRounds} rondes</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {targetPlayerCount && (
        <div className="mt-8 pt-8 border-t border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold">Selectie: {selectedPlayerIds.size} / {targetPlayerCount}</h3>
            {selectedPlayerIds.size === targetPlayerCount && (
              <button onClick={handleStartTournament} className="bg-green-600 px-6 py-2 rounded-xl text-white font-black uppercase shadow-lg hover:bg-green-500 transition-colors">Genereer Schema</button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {players.map(p => (
              <button key={p.id} onClick={() => {
                const n = new Set(selectedPlayerIds);
                if (n.has(p.id)) n.delete(p.id); else if (n.size < targetPlayerCount) n.add(p.id);
                setSelectedPlayerIds(n);
              }} className={`p-2 rounded-lg text-[10px] font-bold border ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-500'}`}>{p.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex justify-between items-center bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {(['schedule', 'standings'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 rounded-lg font-bold text-xs uppercase ${activeTab === t ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : 'Stand'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => { if(confirm("NK Wissen?")) { localStorage.removeItem('bounceball_nk_session'); setSession(null); } }} className="bg-red-900/40 text-red-500 px-4 py-2 rounded-lg text-xs font-bold uppercase">Reset</button>
        </div>
      </div>

      {activeTab === 'schedule' && (
        <div className="space-y-12">
          <input type="text" placeholder="Zoek speler in schema..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="no-print w-full bg-gray-800 p-4 rounded-xl text-white border border-gray-700 outline-none focus:ring-2 ring-amber-500" />
          {session.rounds.map((round, rIdx) => (
            <div key={rIdx} className="space-y-4">
              <h3 className="text-2xl font-black text-amber-500 uppercase italic border-b-2 border-amber-500/20 pb-2">Ronde {round.roundNumber}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {round.matches.map((match, mIdx) => (
                  <div key={match.id} className={`bg-gray-800 rounded-2xl overflow-hidden border ${match.isPlayed ? 'border-green-500/30' : 'border-gray-700'}`}>
                    <div className="bg-gray-900/50 p-2 px-4 flex justify-between items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Zaal {match.hallName}</span>
                      <span className={`text-[10px] font-bold ${isHighlighted(match.referee?.name || '') ? 'text-amber-500' : 'text-gray-500'}`}>REF: {match.referee?.name}</span>
                    </div>
                    <div className="p-4 grid grid-cols-3 items-center gap-4">
                      <div className="space-y-1">
                        {match.team1.map(p => <div key={p.id} className={`text-xs uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-110' : 'text-white'}`}>{p.name}</div>)}
                      </div>
                      <div className="flex flex-col items-center gap-2">
                         <div className="flex items-center gap-1">
                            <input type="number" value={match.team1Score} onChange={e => updateScore(rIdx, mIdx, parseInt(e.target.value) || 0, match.team2Score)} className="w-10 h-10 bg-gray-900 rounded-lg text-center font-black text-white border border-gray-700" />
                            <span className="text-gray-600">-</span>
                            <input type="number" value={match.team2Score} onChange={e => updateScore(rIdx, mIdx, match.team1Score, parseInt(e.target.value) || 0)} className="w-10 h-10 bg-gray-900 rounded-lg text-center font-black text-white border border-gray-700" />
                         </div>
                      </div>
                      <div className="space-y-1 text-right">
                        {match.team2.map(p => <div key={p.id} className={`text-xs uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-110' : 'text-white'}`}>{p.name}</div>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-gray-900 text-[10px] text-gray-400 uppercase font-black">
              <tr>
                <th className="p-4">#</th><th className="p-4">Naam</th><th className="p-4 text-center">W</th><th className="p-4 text-center">Punten</th><th className="p-4 text-center">DS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {session.standings.map((entry, idx) => (
                <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                  <td className="p-4 font-black text-amber-500">{idx + 1}</td>
                  <td className="p-4 text-white font-bold uppercase text-sm">{entry.playerName}</td>
                  <td className="p-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                  <td className="p-4 text-center"><span className="bg-gray-900 px-3 py-1 rounded-full text-amber-500 font-black">{entry.points}</span></td>
                  <td className={`p-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : 'text-red-500'}`}>{entry.goalDifference}</td>
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
