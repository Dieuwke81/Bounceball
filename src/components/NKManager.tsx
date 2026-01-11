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
  
  // Setup States
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');

  useEffect(() => {
    const names = [...hallNames];
    if (hallsCount > names.length) {
      for (let i = names.length; i < hallsCount; i++) names.push(String.fromCharCode(65 + i)); 
    } else {
      names.splice(hallsCount);
    }
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
      const match = players.find(p => normalize(p.name).includes(normalize(cleaned)));
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
        const h = Math.min(hallsCount, Math.floor(n / pPerMatch));
        if (h > 0) options.push({ playerCount: n, hallsToUse: h, totalRounds: Math.ceil(totalMatches / h) });
      }
    }
    return options;
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  const coOpData = useMemo(() => {
    if (!session) return [];
    const pairCounts = new Map<string, { together: number, against: number }>();
    const activePlayers = players.filter(p => session.standings.some(s => s.playerId === p.id));

    session.rounds.forEach(round => {
      round.matches.forEach(match => {
        const processPair = (p1: number, p2: number, type: 'together' | 'against') => {
          const key = [p1, p2].sort().join('-');
          const current = pairCounts.get(key) || { together: 0, against: 0 };
          current[type]++;
          pairCounts.set(key, current);
        };

        match.team1.forEach((p1, i) => match.team1.slice(i+1).forEach(p2 => processPair(p1.id, p2.id, 'together')));
        match.team2.forEach((p1, i) => match.team2.slice(i+1).forEach(p2 => processPair(p1.id, p2.id, 'together')));
        match.team1.forEach(p1 => match.team2.forEach(p2 => processPair(p1.id, p2.id, 'against')));
      });
    });

    return Array.from(pairCounts.entries()).map(([key, counts]) => ({
      p1: players.find(p => p.id === Number(key.split('-')[0]))?.name || '',
      p2: players.find(p => p.id === Number(key.split('-')[1]))?.name || '',
      ...counts
    })).sort((a, b) => b.together - a.together);
  }, [session, players]);

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();
    s.standings.forEach(e => stats.set(e.playerId, { ...e, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 }));
    s.rounds.forEach(r => r.matches.forEach(m => {
      if (!m.isPlayed) return;
      const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      m.team1.forEach(p => { const st = stats.get(p.id)!; st.matchesPlayed++; st.points += p1; st.goalsFor += m.team1Score; st.goalDifference += (m.team1Score - m.team2Score); });
      m.team2.forEach(p => { const st = stats.get(p.id)!; st.matchesPlayed++; st.points += p2; st.goalsFor += m.team2Score; st.goalDifference += (m.team2Score - m.team1Score); });
    }));
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
  };

  const handleStartTournament = async () => {
    const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!chosen) return;
    setIsGenerating(true);
    try {
      const participants = players.filter(p => selectedPlayerIds.has(p.id));
      const newSession = await generateNKSchedule(participants, hallNames.slice(0, chosen.hallsToUse), matchesPerPlayer, playersPerTeam, "NK Schema", setProgressMsg);
      setSession(newSession);
    } catch (e: any) { alert(e.message); }
    finally { setIsGenerating(false); }
  };

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
      <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
      <h2 className="text-3xl font-black italic uppercase">{progressMsg}</h2>
    </div>
  );

  if (!session) return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-amber-500 rounded-2xl"><TrophyIcon className="w-8 h-8 text-white" /></div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic">NK Setup</h2>
            <p className="text-amber-500 text-xs font-bold uppercase">Configureer je toernooi</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="space-y-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
            <label className="block text-gray-500 text-[10px] font-black uppercase">Zalen & Namen</label>
            <input type="number" value={hallsCount} onChange={e => setHallsCount(Number(e.target.value))} className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold" />
            <div className="grid grid-cols-3 gap-2">
              {hallNames.map((n, i) => (
                <input key={i} type="text" value={n} maxLength={1} onChange={e => { const copy = [...hallNames]; copy[i] = e.target.value.toUpperCase(); setHallNames(copy); }} className="bg-gray-700 border-gray-600 rounded text-white text-center p-1 font-bold uppercase" />
              ))}
            </div>
            <label className="block text-gray-500 text-[10px] font-black uppercase">Wedstrijden p.p.</label>
            <input type="number" value={matchesPerPlayer} onChange={e => setMatchesPerPlayer(Number(e.target.value))} className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold" />
            <div className="flex gap-2">
              {[4, 5].map(n => <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>)}
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <h3 className="text-white font-bold text-sm uppercase mb-4 tracking-widest">Geldige Opties:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {possibilities.map(opt => (
                <button key={opt.playerCount} onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}} className={`p-5 rounded-2xl border-2 text-left transition-all ${targetPlayerCount === opt.playerCount ? 'bg-amber-500/20 border-amber-500 shadow-lg' : 'bg-gray-800 border-gray-700'}`}>
                  <span className="text-2xl font-black text-white">{opt.playerCount} Spelers</span>
                  <p className="text-gray-400 text-xs">{opt.totalRounds} rondes nodig.</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {targetPlayerCount && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
              <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak aanwezigheidslijst..." className="w-full h-24 bg-gray-800 border-gray-700 rounded-xl text-white p-3 text-xs outline-none focus:ring-2 ring-amber-500" />
              <button onClick={handleParseAttendance} className="mt-2 w-full bg-gray-700 text-white text-[10px] font-black py-2 rounded-lg uppercase">Verwerk Lijst</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-gray-900 rounded-3xl border border-gray-700">
              {players.map(p => (
                <button key={p.id} onClick={() => {
                  const n = new Set(selectedPlayerIds);
                  if (n.has(p.id)) n.delete(p.id); else if (n.size < targetPlayerCount!) n.add(p.id);
                  setSelectedPlayerIds(n);
                }} className={`p-3 rounded-xl text-xs font-bold border transition-all ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white shadow-inner' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{p.name}</button>
              ))}
            </div>
            {selectedPlayerIds.size === targetPlayerCount && (
              <button onClick={handleStartTournament} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest hover:bg-green-500 transition-colors">Genereer Schema</button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 tracking-tight">
      <style>{`
        @media print {
          body { background: white !important; padding: 0; }
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100%; }
          .match-card { border: 2px solid black !important; margin-bottom: 20px; page-break-inside: avoid; padding: 15px; background: white !important; }
          .match-card * { color: black !important; }
          .round-title { font-size: 24px; font-weight: bold; border-bottom: 3px solid black; margin-top: 30px; margin-bottom: 10px; color: black !important; }
        }
      `}</style>
      
      <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">NK Manager</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {(['schedule', 'standings', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => {if(window.confirm("NK wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-900/50">Reset</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' && (
          <div className="space-y-12">
            <input type="text" placeholder="Zoek naam in schema..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="no-print w-full bg-gray-800 border-gray-700 rounded-xl text-white p-4 outline-none focus:ring-2 ring-amber-500" />
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="round-title text-2xl font-black text-amber-500 uppercase tracking-widest border-b border-gray-700 pb-2 italic text-white">Ronde {round.roundNumber}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => {
                    const avg1 = match.team1.reduce((s, p) => s + p.rating, 0) / match.team1.length;
                    const avg2 = match.team2.reduce((s, p) => s + p.rating, 0) / match.team2.length;
                    return (
                      <div key={match.id} className={`match-card bg-gray-800 rounded-2xl border ${match.isPlayed ? 'border-green-500/50 shadow-green-500/5' : 'border-gray-700'} overflow-hidden`}>
                        <div className="bg-gray-700/50 p-3 flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-white">ZAAL {match.hallName}</span>
                          <span className={`underline ${isHighlighted(match.referee?.name || '') ? 'text-green-400 font-black' : 'text-pink-400'}`}>Scheids: {match.referee?.name}</span>
                        </div>
                        <div className="p-5 flex items-stretch justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-[10px] text-blue-400 font-black uppercase mb-2">Team Blauw</div>
                            {match.team1.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-green-400 scale-105' : 'text-white'}`}>{p.name}</div>)}
                            <div className="text-[9px] text-gray-500 mt-2 font-black">AVG: {avg1.toFixed(1)}</div>
                          </div>
                          <div className="no-print flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2">
                              <input type="number" value={match.team1Score} onChange={e => { const s = {...session}; s.rounds[rIdx].matches[mIdx].team1Score = Number(e.target.value); s.rounds[rIdx].matches[mIdx].isPlayed = true; s.standings = calculateStandings(s); setSession({...s}); }} className="w-12 h-12 bg-gray-900 rounded-xl text-center font-black text-xl text-white border-2 border-gray-700" />
                              <span className="text-gray-600 font-bold">-</span>
                              <input type="number" value={match.team2Score} onChange={e => { const s = {...session}; s.rounds[rIdx].matches[mIdx].team2Score = Number(e.target.value); s.rounds[rIdx].matches[mIdx].isPlayed = true; s.standings = calculateStandings(s); setSession({...s}); }} className="w-12 h-12 bg-gray-900 rounded-xl text-center font-black text-xl text-white border-2 border-gray-700" />
                            </div>
                            <button onClick={() => { const s = {...session}; s.rounds[rIdx].matches[mIdx].isPlayed = !s.rounds[rIdx].matches[mIdx].isPlayed; s.standings = calculateStandings(s); setSession({...s}); }} className={`text-[8px] font-black px-2 py-1 rounded ${match.isPlayed ? 'bg-green-600 text-white' : 'bg-gray-700'}`}>{match.isPlayed ? 'AANPASSEN' : 'BEVESTIG'}</button>
                          </div>
                          <div className="flex-1 text-right">
                            <div className="text-[10px] text-amber-400 font-black uppercase mb-2">Team Geel</div>
                            {match.team2.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-green-400 scale-105' : 'text-white'}`}>{p.name}</div>)}
                            <div className="text-[9px] text-gray-500 mt-2 font-black">AVG: {avg2.toFixed(1)}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-4 text-[8px] font-bold uppercase text-pink-400">
                          <span className={isHighlighted(match.subHigh?.name || '') ? 'text-green-400 font-black' : ''}>Res 1: {match.subHigh?.name}</span>
                          <span className={isHighlighted(match.subLow?.name || '') ? 'text-green-400 font-black' : ''}>Res 2: {match.subLow?.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden animate-fade-in">
            <table className="w-full text-left table-auto">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black">
                <tr><th className="px-4 py-4 w-12">#</th><th className="px-4 py-4">Deelnemer</th><th className="px-4 py-4 text-center">W</th><th className="px-4 py-4 text-center">PTN</th><th className="px-4 py-4 text-center">DS</th><th className="px-4 py-4 text-center">GV</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="px-4 py-4 font-black text-amber-500">{idx + 1}</td>
                    <td className="px-4 py-4 font-bold text-white uppercase text-sm">{entry.playerName}</td>
                    <td className="px-4 py-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                    <td className="px-4 py-4 text-center"><span className="bg-gray-700 text-amber-400 px-3 py-1 rounded-full font-black text-sm">{entry.points}</span></td>
                    <td className={`px-4 py-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : 'text-red-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                    <td className="px-4 py-4 text-center text-gray-500">{entry.goalsFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4 no-print animate-fade-in">
            <input type="text" placeholder="Zoek speler..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-4 text-sm" />
            <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black sticky top-0">
                  <tr><th className="px-4 py-4">Speler 1</th><th className="px-4 py-4">Speler 2</th><th className="px-4 py-4 text-center">Samen</th><th className="px-4 py-4 text-center">Tegen</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {coOpData.filter(d => d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || d.p2.toLowerCase().includes(searchTerm.toLowerCase())).map((pair, i) => (
                    <tr key={i} className={pair.together > 1 ? 'bg-red-500/10' : ''}>
                      <td className="px-4 py-3 text-xs font-bold text-gray-200 uppercase">{pair.p1}</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-200 uppercase">{pair.p2}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-black ${pair.together > 1 ? 'bg-red-500 text-white' : 'bg-green-900 text-green-200'}`}>{pair.together}x</span></td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">{pair.against}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NKManager;
