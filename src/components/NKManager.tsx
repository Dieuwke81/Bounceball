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
  const [errorAnalysis, setErrorAnalysis] = useState<string | null>(null);
  
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');

  // Update hall names array based on count
  const handleHallsCountChange = (count: number) => {
    const newCount = Math.max(1, count);
    setHallsCount(newCount);
    setHallNames(prev => {
      const names = [...prev];
      while (names.length < newCount) {
        names.push(String.fromCharCode(65 + names.length));
      }
      return names.slice(0, newCount);
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
  }, [session]);

  const handleParseAttendance = () => {
    const normalize = (str: string): string =>
      str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\.$/, '');
    const lines = attendanceText.split('\n');
    const potentialNames = new Set<string>();
    const monthNames = ['feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const nonNameIndicators = ['afgemeld', 'gemeld', 'ja', 'nee', 'ok', 'jup', 'aanwezig', 'present', 'helaas', 'keepen', 'keeper'];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      const lowerLine = trimmedLine.toLowerCase();
      if (nonNameIndicators.some((word) => lowerLine.includes(word)) && lowerLine.length > 20) return;
      if (monthNames.some((month) => lowerLine.includes(month)) && (lowerLine.match(/\d/g) || []).length > 1) return;
      let cleaned = trimmedLine.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').replace(/\[.*?\]/, '').replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].replace(/[\(\[].*?[\)\]]/g, '').trim();
      if (cleaned && cleaned.length > 1 && /[a-zA-Z]/.test(cleaned) && cleaned.length < 30) potentialNames.add(cleaned);
    });

    const playerLookup = new Map<string, Player>();
    players.forEach((player) => {
      playerLookup.set(normalize(player.name), player);
      playerLookup.set(normalize(player.name.split(' ')[0]), player);
    });

    const newSelected = new Set(selectedPlayerIds);
    potentialNames.forEach((originalName) => {
      const normalizedName = normalize(originalName);
      const matchedPlayer = playerLookup.get(normalizedName) || playerLookup.get(normalizedName.split(' ')[0]);
      if (matchedPlayer) newSelected.add(matchedPlayer.id);
    });
    setSelectedPlayerIds(newSelected);
    setAttendanceText('');
  };

  const calculatedOptions = useMemo(() => {
    const n = selectedPlayerIds.size;
    if (n === 0) return [];
    const options = [];
    const pPerMatch = playersPerTeam * 2;
    for (let mpp = 3; mpp <= 12; mpp++) {
      if ((n * mpp) % pPerMatch === 0) {
        const totalMatches = (n * mpp) / pPerMatch;
        const rounds = Math.ceil(totalMatches / hallsCount);
        const playingPerRound = Math.min(hallsCount, Math.floor(n / pPerMatch)) * pPerMatch;
        const resting = n - playingPerRound;
        const needs = Math.min(hallsCount, Math.floor(n / pPerMatch)) * 3;
        let label = "Mogelijk", color = "border-gray-700 bg-gray-800/50", score = 50;
        if (resting >= needs) { label = "Perfecte rust"; color = "border-green-500 bg-green-500/10"; score = 100; }
        else if (resting >= 1) { label = "Weinig rust"; color = "border-amber-500 bg-amber-500/10"; score = 70; }
        else { label = "Geen officials"; color = "border-red-500/50 bg-red-500/5"; score = 10; }
        options.push({ mpp, totalMatches, rounds, resting, label, color, score });
      }
    }
    return options.sort((a, b) => b.score - a.score);
  }, [selectedPlayerIds.size, hallsCount, playersPerTeam]);

  const currentStandings = useMemo(() => {
    if (!session) return [];
    const stats = new Map<number, NKStandingsEntry>();
    const allIds = new Set<number>();
    session.rounds.forEach(r => r.matches.forEach(m => [...m.team1, ...m.team2].forEach(p => allIds.add(p.id))));
    allIds.forEach(id => {
      const p = players.find(x => x.id === id);
      stats.set(id, { playerId: id, playerName: p?.name || '?', points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 });
    });
    session.rounds.forEach(r => r.matches.forEach(m => {
      if (!m.isPlayed) return;
      const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      m.team1.forEach(p => { const st = stats.get(p.id); if (st) { st.matchesPlayed++; st.points += p1; st.goalsFor += m.team1Score; st.goalDifference += (m.team1Score - m.team2Score); }});
      m.team2.forEach(p => { const st = stats.get(p.id); if (st) { st.matchesPlayed++; st.points += p2; st.goalsFor += m.team2Score; st.goalDifference += (m.team2Score - m.team1Score); }});
    }));
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  }, [session, players]);

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
    })).sort((a, b) => (b.together + b.against) - (a.together + a.against));
  }, [session, players]);

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white text-center">
      <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
      <h2 className="text-3xl font-black uppercase italic tracking-tighter">{progressMsg}</h2>
      <p className="text-gray-500 text-xs mt-2 uppercase font-bold animate-pulse tracking-widest">Spreiding optimaliseren...</p>
    </div>
  );

  const isHighlighted = (name: string) => highlightName && name.toLowerCase().includes(highlightName.toLowerCase());

  if (!session) return (
    <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-3xl border border-amber-500/20 shadow-2xl space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <TrophyIcon className="w-10 h-10 text-amber-500" />
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">NK Setup</h2>
        </div>
        <button onClick={onClose} className="bg-gray-700 px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-gray-600 transition-colors">Terug</button>
      </div>

      {errorAnalysis && (
        <div className="bg-red-500/10 border-2 border-red-500/50 p-4 rounded-2xl">
          <h3 className="text-red-500 font-black uppercase text-sm">⚠️ Analyse Mislukking:</h3>
          <p className="text-gray-300 text-[10px] mt-1 leading-relaxed whitespace-pre-line">{errorAnalysis}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8 text-white">
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 space-y-4">
          <div>
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Zalen</span>
            <input 
              type="number" 
              value={hallsCount} 
              onFocus={(e) => e.target.select()}
              onChange={e => handleHallsCountChange(+e.target.value)} 
              className="w-full bg-gray-800 p-3 rounded-xl font-bold border border-gray-700" 
            />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Zaalnamen</span>
            <div className="grid grid-cols-1 gap-2">
              {hallNames.map((name, i) => (
                <input 
                  key={i}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const newNames = [...hallNames];
                    newNames[i] = e.target.value;
                    setHallNames(newNames);
                  }}
                  className="bg-gray-800 p-2 rounded-lg text-xs font-bold border border-gray-700 focus:border-amber-500 outline-none"
                  placeholder={`Zaal ${i+1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">{[4, 5].map(n => <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>)}</div>
          <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak WhatsApp lijst..." className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs outline-none" />
          <button onClick={handleParseAttendance} className="w-full py-3 bg-amber-500 text-white font-black rounded-xl uppercase text-xs hover:bg-amber-400 transition-all">Verwerk Lijst</button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end"><h3 className="text-white font-bold uppercase text-xs tracking-widest">Deelnemers ({selectedPlayerIds.size})</h3><button onClick={() => setSelectedPlayerIds(new Set())} className="text-[10px] text-red-500 font-bold uppercase underline">Wis alles</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-black/20 rounded-xl">
            {players.map(p => (
              <button key={p.id} onClick={() => { const n = new Set(selectedPlayerIds); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setSelectedPlayerIds(n); }} className={`p-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{p.name}</button>
            ))}
          </div>

          {selectedPlayerIds.size > 0 && (
            <div className="pt-4 border-t border-gray-700">
              <h3 className="text-white font-bold uppercase text-xs mb-3 text-amber-500 tracking-widest">Gevalideerde Opties:</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {calculatedOptions.map(opt => (
                  <button key={opt.mpp} onClick={async () => {
                      setIsGenerating(true); setProgressMsg("Backtracking schema..."); setErrorAnalysis(null);
                      try {
                        const p = players.filter(x => selectedPlayerIds.has(x.id));
                        const s = await generateNKSchedule(p, hallNames, opt.mpp, playersPerTeam, "NK", setProgressMsg);
                        setSession(s);
                      } catch(e:any) { setErrorAnalysis(e.message); } finally { setIsGenerating(false); }
                    }} className={`p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${opt.color}`}>
                    <div className="text-xl font-black tracking-tighter">{opt.mpp} Wedstrijden p.p.</div>
                    <div className="mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">{opt.rounds} rondes | {opt.resting} rust | {opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="no-print flex justify-between items-center bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl text-white">
        <h2 className="text-xl font-black italic uppercase tracking-tighter">NK Manager</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl gap-1">
          {(['schedule', 'standings', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-gray-600 transition-colors">Print</button>
          <button onClick={() => {if(confirm("NK Wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-800 transition-colors">Reset</button>
        </div>
      </div>

      <div className="space-y-8">
        {activeTab === 'schedule' && (
          <>
            <input type="text" placeholder="Naam markeren..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="no-print w-full bg-gray-800 p-4 rounded-2xl text-white border border-gray-700 outline-none focus:ring-2 ring-green-500" />
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="text-xl font-black text-amber-500 uppercase italic border-l-4 border-amber-500 pl-4 tracking-tighter">Ronde {round.roundNumber}</h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => {
                    const avg1 = match.team1.reduce((s, p) => s + p.rating, 0) / match.team1.length;
                    const avg2 = match.team2.reduce((s, p) => s + p.rating, 0) / match.team2.length;
                    return (
                      <div key={match.id} className={`match-card bg-gray-800 rounded-2xl border-2 ${match.isPlayed ? 'border-green-500/50 shadow-lg shadow-green-500/5' : 'border-gray-700'} overflow-hidden`}>
                        <div className="bg-gray-900/50 p-3 flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest">
                          <span>📍 ZAAL {match.hallName}</span>
                          <span className={`px-2 py-0.5 rounded transition-all ${isHighlighted(match.referee?.name || '') ? 'bg-green-500 text-white font-black scale-110 shadow-lg' : 'text-pink-400'}`}>Ref: {match.referee?.name}</span>
                        </div>
                        <div className="p-5 flex justify-between items-stretch gap-4 text-white">
                          <div className="flex-1 space-y-1">
                            <div className="text-[9px] text-blue-400 font-black uppercase mb-2 tracking-widest">Team Blauw</div>
                            {match.team1.map(p => <div key={p.id} className={`text-sm uppercase font-bold transition-all ${isHighlighted(p.name) ? 'bg-green-500 text-white px-1 rounded-sm scale-105 shadow-md' : ''}`}>{p.name}</div>)}
                            <div className="text-[9px] text-gray-500 mt-2 font-black">GEM: {avg1.toFixed(2)}</div>
                          </div>
                          <div className="no-print flex flex-col items-center justify-center gap-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={match.team1Score} 
                                onFocus={(e) => e.target.select()}
                                onChange={e => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].team1Score = +e.target.value;
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = true;
                                  setSession(newS);
                                }} 
                                className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border-2 border-gray-700 text-white outline-none focus:border-amber-500" 
                              />
                              <span className="text-gray-600 font-bold">-</span>
                              <input 
                                type="number" 
                                value={match.team2Score} 
                                onFocus={(e) => e.target.select()}
                                onChange={e => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].team2Score = +e.target.value;
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = true;
                                  setSession(newS);
                                }} 
                                className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border-2 border-gray-700 text-white outline-none focus:border-amber-500" 
                              />
                            </div>
                            <button onClick={() => {
                                const newS = JSON.parse(JSON.stringify(session));
                                newS.rounds[rIdx].matches[mIdx].isPlayed = !match.isPlayed;
                                setSession(newS);
                            }} className={`text-[8px] font-black px-3 py-1.5 rounded-lg transition-all ${match.isPlayed ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>{match.isPlayed ? 'HERSTEL' : 'OPSLAAN'}</button>
                          </div>
                          <div className="flex-1 space-y-1 text-right">
                            <div className="text-[9px] text-amber-400 font-black uppercase mb-2 tracking-widest">Team Geel</div>
                            {match.team2.map(p => <div key={p.id} className={`text-sm uppercase font-bold transition-all ${isHighlighted(p.name) ? 'bg-green-500 text-white px-1 rounded-sm scale-105 shadow-md' : ''}`}>{p.name}</div>)}
                            <div className="text-[9px] text-gray-500 mt-2 font-black">GEM: {avg2.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="p-2.5 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-8 text-[9px] font-black uppercase">
                          <span className={`px-2 rounded transition-all ${isHighlighted(match.subHigh?.name || '') ? 'bg-green-500 text-white font-black' : 'text-pink-400/70'}`}>Res 1: {match.subHigh?.name}</span>
                          <span className={`px-2 rounded transition-all ${isHighlighted(match.subLow?.name || '') ? 'bg-green-500 text-white font-black' : 'text-pink-400/70'}`}>Res 2: {match.subLow?.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden text-white animate-fade-in">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <tr><th className="p-5 w-12 text-center">#</th><th className="p-5">Speler</th><th className="p-5 text-center">W</th><th className="p-5 text-center">DS</th><th className="p-5 text-center">PTN</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50 uppercase">
                {currentStandings.map((entry, idx) => (
                  <tr key={entry.playerId} className={`transition-colors ${idx < 3 ? 'bg-amber-500/5' : 'hover:bg-gray-700/30'}`}>
                    <td className="p-5 text-center font-black text-amber-500">{idx + 1}</td>
                    <td className="p-5 font-bold text-sm tracking-tight">{entry.playerName}</td>
                    <td className="p-5 text-center text-gray-400 font-mono text-xs">{entry.matchesPlayed}</td>
                    <td className={`p-5 text-center font-black font-mono text-xs ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                    <td className="p-5 text-center"><span className="bg-gray-900 text-amber-400 px-4 py-1.5 rounded-full font-black text-sm shadow-inner border border-amber-500/20">{entry.points}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4 animate-fade-in text-white no-print">
            <input type="text" placeholder="Filter duo's..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 text-sm outline-none focus:border-amber-500 transition-all" />
            <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden max-h-[600px] overflow-y-auto uppercase custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black sticky top-0 z-20">
                  <tr><th className="p-5">Duo</th><th className="p-5 text-center">Samen</th><th className="p-5 text-center">Tegen</th><th className="p-5 text-center">Totaal</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {coOpData.filter(d => d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || d.p2.toLowerCase().includes(searchTerm.toLowerCase())).map((pair, i) => (
                    <tr key={i} className={`hover:bg-gray-700/20 transition-colors ${ (pair.together + pair.against) > 3 ? 'bg-red-500/5' : ''}`}>
                      <td className="p-5 text-xs font-bold tracking-tight">{pair.p1} + {pair.p2}</td>
                      <td className="p-5 text-center"><span className={`px-2 py-1 rounded-lg text-[10px] font-black ${pair.together > 1 ? 'bg-red-500/30 text-red-200' : 'bg-gray-900 text-gray-500'}`}>{pair.together}x</span></td>
                      <td className="p-5 text-center text-xs text-gray-400 font-mono">{pair.against}x</td>
                      <td className="p-5 text-center"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${(pair.together + pair.against) > 3 ? 'bg-amber-500 text-white shadow-lg' : 'bg-green-900 text-green-200'}`}>{pair.together + pair.against}x</span></td>
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
