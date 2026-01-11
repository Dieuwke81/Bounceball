import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';

interface NKManagerProps { players: Player[]; onClose: () => void; }

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

  const possibilities = useMemo(() => {
    const options = [];
    const pPerMatch = playersPerTeam * 2;
    for (let n = pPerMatch; n <= 100; n++) {
      if ((n * matchesPerPlayer) % pPerMatch === 0) {
        const h = Math.min(hallsCount, Math.floor(n / pPerMatch));
        if (h > 0) {
          const totalMatches = (n * matchesPerPlayer) / pPerMatch;
          const resting = n - (h * pPerMatch);
          const needs = h * 3; // 1 ref + 2 subs per zaal verplicht
          
          let label = "Onmogelijk";
          let color = "border-red-900/50 opacity-40";
          let score = 0;

          if (resting >= needs) {
            score = 100 - (resting - needs) * 5;
            label = score > 90 ? "Perfect" : "Heel Goed";
            color = score > 90 ? "border-green-500 bg-green-500/10 shadow-lg" : "border-amber-500 bg-amber-500/10";
          } else if (resting > 0) {
            label = "Te weinig rust";
            color = "border-gray-700 bg-gray-800";
          }

          if (resting >= needs || n > pPerMatch + 3) {
             options.push({ playerCount: n, hallsToUse: h, totalRounds: Math.ceil(totalMatches / h), resting, needs, label, color, score });
          }
        }
      }
    }
    return options.sort((a, b) => b.score - a.score);
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  const coOpData = useMemo(() => {
    if (!session) return [];
    const pairCounts = new Map<string, { together: number, against: number }>();
    session.rounds.forEach(r => r.matches.forEach(m => {
      const add = (p1: number, p2: number, type: 'together' | 'against') => {
        const key = [p1, p2].sort().join('-');
        const cur = pairCounts.get(key) || { together: 0, against: 0 };
        cur[type]++; pairCounts.set(key, cur);
      };
      m.team1.forEach((p, i) => m.team1.slice(i+1).forEach(p2 => add(p.id, p2.id, 'together')));
      m.team2.forEach((p, i) => m.team2.slice(i+1).forEach(p2 => add(p.id, p2.id, 'together')));
      m.team1.forEach(p1 => m.team2.forEach(p2 => add(p1.id, p2.id, 'against')));
    }));
    return Array.from(pairCounts.entries()).map(([k, v]) => ({
      p1: players.find(p => p.id === +k.split('-')[0])?.name || '',
      p2: players.find(p => p.id === +k.split('-')[1])?.name || '', ...v
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

  const isHighlighted = (name: string) => highlightName && name.toLowerCase().includes(highlightName.toLowerCase());

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
      <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
      <h2 className="text-3xl font-black italic uppercase tracking-tighter">{progressMsg}</h2>
    </div>
  );

  if (!session) return (
    <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-3xl border border-amber-500/20 shadow-2xl space-y-8">
      <div className="flex items-center gap-4">
        <TrophyIcon className="w-10 h-10 text-amber-500" />
        <h2 className="text-3xl font-black text-white uppercase italic">NK Setup</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 space-y-4">
          <label className="block text-[10px] font-black text-gray-500 uppercase">Zalen & Wedstrijden p.p.</label>
          <input type="number" value={hallsCount} onChange={e => setHallsCount(+e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl text-white font-bold border border-gray-700" />
          <input type="number" value={matchesPerPlayer} onChange={e => setMatchesPerPlayer(+e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl text-white font-bold border border-gray-700" />
          <div className="flex gap-2">
            {[4, 5].map(n => <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>)}
          </div>
          <div className="text-[10px] text-amber-500 font-bold bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 italic">
            Let op: Elke zaal vereist verplicht 1 scheidsrechter en 2 reserves uit de rustende spelers.
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-white font-bold uppercase text-xs tracking-widest">Aanbevolen spelersaantallen:</h3>
          <div className="grid sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {possibilities.map(opt => (
              <button key={opt.playerCount} onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}} className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${targetPlayerCount === opt.playerCount ? 'ring-2 ring-white scale-[1.02]' : opt.color}`}>
                <div className="flex justify-between">
                   <div className="text-2xl font-black text-white">{opt.playerCount} <span className="text-xs font-normal opacity-50">Spelers</span></div>
                   <span className="text-[8px] px-2 py-1 rounded-full bg-black/30 font-black text-white uppercase">{opt.label}</span>
                </div>
                <div className="mt-2 flex gap-4 text-[9px] font-bold text-gray-400 uppercase">
                   <span>📅 {opt.totalRounds} Rondes</span>
                   <span className={opt.resting < opt.needs ? 'text-red-500' : 'text-green-500'}>🪑 {opt.resting} Rust (Nodig: {opt.needs})</span>
                </div>
              </button>
            ))}
          </div>

          {targetPlayerCount && (
            <div className="pt-4 space-y-4 animate-fade-in">
               <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak aanwezigheidslijst..." className="w-full h-24 bg-gray-900 border border-gray-700 rounded-xl text-white p-3 text-xs outline-none focus:ring-2 ring-amber-500" />
               <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                 {players.map(p => (
                   <button key={p.id} onClick={() => {
                     const n = new Set(selectedPlayerIds);
                     if (n.has(p.id)) n.delete(p.id); else if (n.size < targetPlayerCount!) n.add(p.id);
                     setSelectedPlayerIds(n);
                   }} className={`p-2 rounded-lg text-[10px] font-bold border ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{p.name}</button>
                 ))}
               </div>
               {selectedPlayerIds.size === targetPlayerCount && (
                 <button onClick={async () => {
                   setIsGenerating(true);
                   try {
                     const p = players.filter(x => selectedPlayerIds.has(x.id));
                     const s = await generateNKSchedule(p, hallNames, matchesPerPlayer, playersPerTeam, "NK", setProgressMsg);
                     setSession(s);
                   } catch(e:any) { alert(e.message); } finally { setIsGenerating(false); }
                 }} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase hover:bg-green-500 tracking-widest">Genereer 0.3 Balans Schema</button>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <style>{`
        @media print { .no-print { display: none !important; } .print-area { display: block !important; } .match-card { page-break-inside: avoid; border: 2px solid black !important; margin-bottom: 20px; color: black !important; } }
      `}</style>
      <div className="no-print flex justify-between items-center bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">NK Manager</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {(['schedule', 'standings', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => {if(confirm("NK wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-900/50">Reset</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' && (
          <div className="space-y-12">
            <input type="text" placeholder="Highlight naam..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="no-print w-full bg-gray-800 p-4 rounded-xl text-white border border-gray-700 outline-none" />
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="text-2xl font-black text-amber-500 uppercase italic border-b-2 border-gray-700 pb-2">Ronde {round.roundNumber}</h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => (
                    <div key={match.id} className={`match-card bg-gray-800 rounded-2xl border ${match.isPlayed ? 'border-green-500/50 shadow-lg' : 'border-gray-700'} overflow-hidden`}>
                      <div className="bg-gray-900/50 p-3 flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-white">ZAAL {match.hallName}</span>
                        <span className={`underline ${isHighlighted(match.referee?.name || '') ? 'text-amber-500 font-black' : 'text-pink-400'}`}>Scheids: {match.referee?.name}</span>
                      </div>
                      <div className="p-5 flex justify-between items-center gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="text-[9px] text-blue-400 font-black uppercase mb-1">Team Blauw</div>
                          {match.team1.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-105' : 'text-white'}`}>{p.name}</div>)}
                        </div>
                        <div className="no-print flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <input type="number" value={match.team1Score} onChange={e => { const s = {...session}; s.rounds[rIdx].matches[mIdx].team1Score = +e.target.value; s.rounds[rIdx].matches[mIdx].isPlayed = true; s.standings = calculateStandings(s); setSession({...s}); }} className="w-12 h-12 bg-gray-900 text-white text-center rounded-xl font-black text-xl border-2 border-gray-700" />
                            <span className="text-gray-600 font-bold">-</span>
                            <input type="number" value={match.team2Score} onChange={e => { const s = {...session}; s.rounds[rIdx].matches[mIdx].team2Score = +e.target.value; s.rounds[rIdx].matches[mIdx].isPlayed = true; s.standings = calculateStandings(s); setSession({...s}); }} className="w-12 h-12 bg-gray-900 text-white text-center rounded-xl font-black text-xl border-2 border-gray-700" />
                          </div>
                        </div>
                        <div className="flex-1 text-right space-y-1">
                          <div className="text-[9px] text-amber-400 font-black uppercase mb-1">Team Geel</div>
                          {match.team2.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-105' : 'text-white'}`}>{p.name}</div>)}
                        </div>
                      </div>
                      <div className="p-2 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-6 text-[9px] font-black uppercase text-pink-400">
                        <span className={isHighlighted(match.subHigh?.name || '') ? 'text-amber-500' : ''}>Res 1: {match.subHigh?.name}</span>
                        <span className={isHighlighted(match.subLow?.name || '') ? 'text-amber-500' : ''}>Res 2: {match.subLow?.name}</span>
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
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black">
                <tr><th className="p-4 w-12">#</th><th className="p-4">Deelnemer</th><th className="p-4 text-center">W</th><th className="p-4 text-center">PTN</th><th className="p-4 text-center">DS</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="p-4 font-black text-amber-500">{idx + 1}</td>
                    <td className="p-4 font-bold text-white uppercase text-sm">{entry.playerName}</td>
                    <td className="p-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                    <td className="p-4 text-center"><span className="bg-gray-900 text-amber-400 px-3 py-1 rounded-full font-black text-sm">{entry.points}</span></td>
                    <td className={`p-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : 'text-red-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
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
                  <tr><th className="p-4">Duo</th><th className="p-4 text-center">Samen</th><th className="p-4 text-center">Tegen</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {coOpData.filter(d => d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || d.p2.toLowerCase().includes(searchTerm.toLowerCase())).map((pair, i) => (
                    <tr key={i} className={pair.together > 1 ? 'bg-red-500/10' : ''}>
                      <td className="p-4 text-xs font-bold text-gray-200 uppercase">{pair.p1} + {pair.p2}</td>
                      <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-black ${pair.together > 1 ? 'bg-red-500 text-white shadow-lg' : 'bg-green-900 text-green-200'}`}>{pair.together}x</span></td>
                      <td className="p-4 text-center text-xs text-gray-400 font-bold">{pair.against}x</td>
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
