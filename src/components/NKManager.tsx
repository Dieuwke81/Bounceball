import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';
import LockIcon from './icons/LockIcon';

interface NKManagerProps { players: Player[]; onClose: () => void; }

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightName, setHighlightName] = useState(''); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [parseFeedback, setParseFeedback] = useState<{success: number, fail: string[]} | null>(null);
  
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
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

      let cleaned = trimmedLine.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].trim();
      if (cleaned && cleaned.length > 1) potentialNames.add(cleaned);
    });

    const playerLookup = new Map<string, Player>();
    players.forEach((player) => {
      playerLookup.set(normalize(player.name), player);
      playerLookup.set(normalize(player.name.split(' ')[0]), player);
    });

    const newSelected = new Set(selectedPlayerIds);
    let successCount = 0;
    let fails: string[] = [];

    potentialNames.forEach((originalName) => {
      const normalizedName = normalize(originalName);
      const matchedPlayer = playerLookup.get(normalizedName) || playerLookup.get(normalizedName.split(' ')[0]);
      if (matchedPlayer) {
        if (!newSelected.has(matchedPlayer.id)) {
          newSelected.add(matchedPlayer.id);
          successCount++;
        }
      } else {
        fails.push(originalName);
      }
    });

    setSelectedPlayerIds(newSelected);
    setAttendanceText('');
    setParseFeedback({ success: successCount, fail: fails });
    setTimeout(() => setParseFeedback(null), 5000);
  };

  // ✅ Berekent welke wedstrijdaantallen mogelijk zijn met de huidige selectie
  const calculatedOptions = useMemo(() => {
    const numPlayers = selectedPlayerIds.size;
    if (numPlayers === 0) return [];

    const options = [];
    const playersPerMatch = playersPerTeam * 2;

    // We kijken naar mogelijke wedstrijden p.p. (van 3 tot 12)
    for (let mpp = 3; mpp <= 12; mpp++) {
      const totalSlots = numPlayers * mpp;
      
      // Check 1: Is het totaal aantal plekken deelbaar door spelers per match?
      if (totalSlots % playersPerMatch === 0) {
        const totalMatches = totalSlots / playersPerMatch;
        const rounds = Math.ceil(totalMatches / hallsCount);
        
        // Check 2: Is er genoeg rust? (minimaal 3 officials per actieve zaal nodig)
        const playersPlayingPerRound = Math.min(hallsCount, Math.floor(numPlayers / playersPerMatch)) * playersPerMatch;
        const resting = numPlayers - playersPlayingPerRound;
        const neededForOfficials = Math.min(hallsCount, Math.floor(numPlayers / playersPerMatch)) * 3;

        let label = "Mogelijk";
        let color = "border-gray-700 bg-gray-800/50";
        let score = 50;

        if (resting >= neededForOfficials) {
          score = 100;
          label = "Perfecte rust";
          color = "border-green-500 bg-green-500/10";
        } else if (resting >= 1) {
          score = 70;
          label = "Weinig rust";
          color = "border-amber-500 bg-amber-500/10";
        } else {
          score = 10;
          label = "Geen officials";
          color = "border-red-500/50 bg-red-500/5";
        }

        options.push({
          matchesPerPlayer: mpp,
          totalMatches,
          rounds,
          resting,
          label,
          color,
          score
        });
      }
    }
    return options.sort((a, b) => b.score - a.score);
  }, [selectedPlayerIds.size, hallsCount, playersPerTeam]);

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const stats = new Map<number, NKStandingsEntry>();
    s.standings.forEach(e => stats.set(e.playerId, { ...e, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 }));
    s.rounds.forEach(r => r.matches.forEach(m => {
      if (!m.isPlayed) return;
      const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
      m.team1.forEach(p => { 
        const st = stats.get(p.id);
        if (st) { st.matchesPlayed++; st.points += p1; st.goalsFor += m.team1Score; st.goalDifference += (m.team1Score - m.team2Score); }
      });
      m.team2.forEach(p => { 
        const st = stats.get(p.id);
        if (st) { st.matchesPlayed++; st.points += p2; st.goalsFor += m.team2Score; st.goalDifference += (m.team2Score - m.team1Score); }
      });
    }));
    return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
  };

  const updateMatch = (roundIdx: number, matchIdx: number, updates: Partial<any>) => {
    if (!session) return;
    const newSession = JSON.parse(JSON.stringify(session));
    newSession.rounds[roundIdx].matches[matchIdx] = { ...newSession.rounds[roundIdx].matches[matchIdx], ...updates };
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

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
      <p className="text-gray-500 text-xs mt-2 uppercase font-bold tracking-widest animate-pulse">Sociale spreiding optimaliseren...</p>
    </div>
  );

  if (!session) return (
    <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-3xl border border-amber-500/20 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <TrophyIcon className="w-10 h-10 text-amber-500" />
          <h2 className="text-3xl font-black text-white uppercase italic">NK Setup</h2>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white font-bold uppercase text-xs">Sluiten</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 text-white">
        {/* Kolom 1: Basis instellingen */}
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 space-y-4">
          <div>
            <span className="text-[10px] text-gray-500 font-black uppercase">Aantal Zalen</span>
            <input type="number" value={hallsCount} onChange={e => setHallsCount(Math.max(1, +e.target.value))} className="w-full bg-gray-800 p-3 rounded-xl font-bold border border-gray-700" />
          </div>
          <div className="flex gap-2">
            {[4, 5].map(n => (
              <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                {n} vs {n}
              </button>
            ))}
          </div>
          <div className="pt-4 border-t border-gray-700">
            <span className="text-[10px] text-gray-500 font-black uppercase">Aanwezigheid plakkken</span>
            <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak lijst uit WhatsApp..." className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs mt-1 outline-none focus:ring-2 ring-amber-500" />
            <button onClick={handleParseAttendance} className="w-full mt-2 py-3 bg-amber-500 text-white font-black rounded-xl uppercase text-xs">Verwerk Lijst</button>
          </div>
        </div>

        {/* Kolom 2: Spelers selectie */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white font-bold uppercase text-xs">Geselecteerde spelers ({selectedPlayerIds.size}):</h3>
            <button onClick={() => setSelectedPlayerIds(new Set())} className="text-[10px] text-red-500 font-bold uppercase">Wis alles</button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-black/20 rounded-xl">
            {players.map(p => (
              <button 
                key={p.id} 
                onClick={() => {
                  const n = new Set(selectedPlayerIds);
                  if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                  setSelectedPlayerIds(n);
                }} 
                className={`p-2 rounded-lg text-[10px] font-bold border transition-all truncate ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Kolom 3: De berekende opties */}
          {selectedPlayerIds.size > 0 && (
            <div className="pt-4 border-t border-gray-700 animate-fade-in">
              <h3 className="text-white font-bold uppercase text-xs mb-3 text-amber-500">Beschikbare schema opties:</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {calculatedOptions.length > 0 ? calculatedOptions.map(opt => (
                  <button 
                    key={opt.matchesPerPlayer}
                    onClick={async () => {
                      setIsGenerating(true); setProgressMsg("Schema berekenen...");
                      try {
                        const p = players.filter(x => selectedPlayerIds.has(x.id));
                        const s = await generateNKSchedule(p, hallNames, opt.matchesPerPlayer, playersPerTeam, "NK", setProgressMsg);
                        setSession(s);
                      } catch(e:any) { alert(e.message); } finally { setIsGenerating(false); }
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${opt.color}`}
                  >
                    <div className="flex justify-between font-black">
                      <div className="text-xl">{opt.matchesPerPlayer} Wedstrijden p.p.</div>
                    </div>
                    <div className="mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      📅 {opt.rounds} rondes | 🪑 {opt.resting} rust/officials | {opt.label}
                    </div>
                  </button>
                )) : (
                  <div className="col-span-2 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                    <p className="text-red-500 text-xs font-bold uppercase">Geen sluitend schema mogelijk met {selectedPlayerIds.size} spelers.</p>
                    <p className="text-gray-500 text-[10px] mt-1">Voeg spelers toe of verwijder er een paar om een match te vinden.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const isHighlighted = (name: string) => highlightName && name.toLowerCase().includes(highlightName.toLowerCase());

  return (
    <div className="space-y-6 pb-20">
      <style>{`@media print { .no-print { display: none !important; } .match-card { page-break-inside: avoid; border: 2px solid black !important; margin-bottom: 20px; } }`}</style>
      <div className="no-print flex justify-between items-center bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl text-white">
        <h2 className="text-xl font-black italic uppercase tracking-tighter">NK Manager</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {(['schedule', 'standings', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => {if(confirm("NK wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">Reset</button>
        </div>
      </div>

      <div className="space-y-12">
        {activeTab === 'schedule' && (
          <>
            <input type="text" placeholder="Highlight naam..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="no-print w-full bg-gray-800 p-4 rounded-xl text-white border border-gray-700 outline-none" />
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <h3 className="text-2xl font-black text-amber-500 uppercase italic border-b-2 border-gray-700 pb-2">Ronde {round.roundNumber}</h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => {
                    const avg1 = match.team1.reduce((s, p) => s + p.rating, 0) / match.team1.length;
                    const avg2 = match.team2.reduce((s, p) => s + p.rating, 0) / match.team2.length;
                    return (
                      <div key={match.id} className={`match-card bg-gray-800 rounded-2xl border ${match.isPlayed ? 'border-green-500/50 shadow-lg' : 'border-gray-700'} overflow-hidden`}>
                        <div className="bg-gray-900/50 p-3 flex justify-between text-[10px] font-black uppercase text-gray-500">
                          <span>ZAAL {match.hallName}</span>
                          <span className={`underline ${isHighlighted(match.referee?.name || '') ? 'text-amber-500 font-black' : 'text-pink-400'}`}>Scheids: {match.referee?.name}</span>
                        </div>
                        <div className="p-5 flex justify-between items-stretch gap-4 text-white">
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="text-[9px] text-blue-400 font-black uppercase mb-1 tracking-widest">Team Blauw</div>
                                {match.team1.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-105' : ''}`}>{p.name}</div>)}
                            </div>
                            <div className="text-[9px] text-gray-500 mt-2 font-black">GEM: {avg1.toFixed(2)}</div>
                          </div>
                          <div className="no-print flex flex-col items-center justify-center gap-2">
                            <div className="flex items-center gap-2">
                              <input type="number" value={match.team1Score} onChange={e => updateMatch(rIdx, mIdx, { team1Score: +e.target.value, isPlayed: true })} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border-2 border-gray-700 text-white outline-none" />
                              <span className="text-gray-600 font-bold">-</span>
                              <input type="number" value={match.team2Score} onChange={e => updateMatch(rIdx, mIdx, { team2Score: +e.target.value, isPlayed: true })} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border-2 border-gray-700 text-white outline-none" />
                            </div>
                            <button onClick={() => updateMatch(rIdx, mIdx, { isPlayed: !match.isPlayed })} className={`text-[8px] font-black px-2 py-1 rounded transition-colors ${match.isPlayed ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400'}`}>
                                {match.isPlayed ? 'HERSTEL' : 'GESPEELD'}
                            </button>
                          </div>
                          <div className="flex-1 text-right flex flex-col justify-between">
                            <div>
                                <div className="text-[9px] text-amber-400 font-black uppercase mb-1 tracking-widest">Team Geel</div>
                                {match.team2.map(p => <div key={p.id} className={`text-sm uppercase font-bold ${isHighlighted(p.name) ? 'text-amber-500 scale-105' : ''}`}>{p.name}</div>)}
                            </div>
                            <div className="text-[9px] text-gray-500 mt-2 font-black text-right">GEM: {avg2.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-6 text-[9px] font-black uppercase text-pink-400">
                          <span className={isHighlighted(match.subHigh?.name || '') ? 'text-amber-500 font-black' : ''}>Res 1: {match.subHigh?.name}</span>
                          <span className={isHighlighted(match.subLow?.name || '') ? 'text-amber-500 font-black' : ''}>Res 2: {match.subLow?.name}</span>
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
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden text-white">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <tr><th className="p-4 w-12">#</th><th className="p-4">Deelnemer</th><th className="p-4 text-center">W</th><th className="p-4 text-center">PTN</th><th className="p-4 text-center">DS</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700 uppercase tracking-tighter sm:tracking-normal">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : 'hover:bg-gray-700/30 transition-colors'}>
                    <td className="p-4 font-black text-amber-500">{idx + 1}</td>
                    <td className="p-4 font-bold text-sm">{entry.playerName}</td>
                    <td className="p-4 text-center text-gray-400">{entry.matchesPlayed}</td>
                    <td className="p-4 text-center"><span className="bg-gray-900 text-amber-400 px-3 py-1 rounded-full font-black text-sm shadow-inner">{entry.points}</span></td>
                    <td className={`p-4 text-center font-bold ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4 no-print animate-fade-in text-white">
            <input type="text" placeholder="Filter duo's..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-sm outline-none focus:ring-2 ring-amber-500" />
            <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden max-h-[600px] overflow-y-auto uppercase">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black sticky top-0 z-10">
                  <tr><th className="p-4">Duo</th><th className="p-4 text-center">Samen</th><th className="p-4 text-center">Tegen</th><th className="p-4 text-center">Totaal</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {coOpData.filter(d => d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || d.p2.toLowerCase().includes(searchTerm.toLowerCase())).map((pair, i) => (
                    <tr key={i} className={(pair.together + pair.against) > 2 ? 'bg-red-500/10' : 'hover:bg-gray-700/20 transition-colors'}>
                      <td className="p-4 text-xs font-bold">{pair.p1} + {pair.p2}</td>
                      <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-black ${pair.together > 1 ? 'bg-red-500/40 text-white' : 'bg-gray-900 text-gray-400'}`}>{pair.together}x</span></td>
                      <td className="p-4 text-center text-xs text-gray-400 font-bold">{pair.against}x</td>
                      <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-black ${(pair.together + pair.against) > 2 ? 'bg-amber-500 text-white shadow-lg' : 'bg-green-900 text-green-200'}`}>{pair.together + pair.against}x</span></td>
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
