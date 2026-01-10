import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry, NKMatch } from '../types';
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
  
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const names = [...hallNames];
    if (hallsCount > names.length) {
      for (let i = names.length; i < hallsCount; i++) names.push(String.fromCharCode(65 + i)); 
    } else names.splice(hallsCount);
    setHallNames(names);
  }, [hallsCount]);

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) { try { setSession(JSON.parse(saved)); } catch (e) { console.error(e); } }
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
  }, [session]);

  const isHighlighted = (name: string) => highlightName && name.toLowerCase() === highlightName.toLowerCase();

  const possibilities = useMemo(() => {
    const options = [];
    const playersPerMatch = playersPerTeam * 2;
    for (let n = playersPerMatch; n <= 100; n++) {
      const totalSpots = n * matchesPerPlayer;
      if (totalSpots % playersPerMatch === 0) {
        const totalMatches = totalSpots / playersPerMatch;
        const maxHallsPossible = Math.floor(n / (playersPerMatch + 3));
        const actualHallsToUse = Math.min(hallsCount, maxHallsPossible);
        if (actualHallsToUse > 0) {
          options.push({ playerCount: n, hallsToUse: actualHallsToUse, totalRounds: Math.ceil(totalMatches / actualHallsToUse) });
        }
      }
    }
    return options;
  }, [hallsCount, matchesPerPlayer, playersPerTeam]);

  const coOpData = useMemo(() => {
    if (!session) return [];
    const pairCounts = new Map<string, { together: number, against: number }>();
    const participants = players.filter(p => session.standings.some(s => s.playerId === p.id));
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const key = [participants[i].id, participants[j].id].sort().join('-');
        pairCounts.set(key, { together: 0, against: 0 });
      }
    }
    session.rounds.forEach(round => {
      round.matches.forEach(match => {
        const countT = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const key = [team[i].id, team[j].id].sort().join('-');
              if (pairCounts.has(key)) pairCounts.get(key)!.together++;
            }
          }
        };
        countT(match.team1); countT(match.team2);
        match.team1.forEach(p1 => match.team2.forEach(p2 => {
          const key = [p1.id, p2.id].sort().join('-');
          if (pairCounts.has(key)) pairCounts.get(key)!.against++;
        }));
      });
    });
    return Array.from(pairCounts.entries()).map(([key, counts]) => ({
      p1: players.find(p => p.id === Number(key.split('-')[0]))?.name || '?',
      p2: players.find(p => p.id === Number(key.split('-')[1]))?.name || '?',
      together: counts.together, against: counts.against
    })).sort((a, b) => b.together - a.together || b.against - a.against);
  }, [session, players]);

  const handleStartTournament = async () => {
    const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!chosen) return;
    if (selectedPlayerIds.size !== targetPlayerCount) { alert(`Kies ${targetPlayerCount} spelers.`); return; }
    setIsGenerating(true);
    try {
      const participants = players.filter(p => selectedPlayerIds.has(p.id));
      const newSession = await generateNKSchedule(participants, hallNames.slice(0, chosen.hallsToUse), matchesPerPlayer, playersPerTeam, "NK Schema");
      setSession(newSession);
    } catch (error) { console.error(error); alert("Fout bij berekenen."); } finally { setIsGenerating(false); }
  };

  const updateScore = (roundIdx: number, mIdx: number, team: 1 | 2, score: number) => {
    if (!session) return;
    const newSession = { ...session };
    const match = newSession.rounds[roundIdx].matches[mIdx];
    if (team === 1) match.team1Score = score; else match.team2Score = score;
    match.isPlayed = true;
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

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

  const togglePlayed = (roundIdx: number, mIdx: number) => {
    if (!session) return;
    const newSession = { ...session };
    newSession.rounds[roundIdx].matches[mIdx].isPlayed = !newSession.rounds[roundIdx].matches[mIdx].isPlayed;
    newSession.standings = calculateStandings(newSession);
    setSession(newSession);
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
        <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-center">Schema Berekenen...</h2>
        <p className="text-gray-400 animate-pulse mt-2 text-center px-8">Dit duurt een paar seconden. De browser bevriest niet.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20"><TrophyIcon className="w-8 h-8 text-white" /></div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">NK Setup</h2>
              <p className="text-amber-500/80 text-xs font-bold uppercase">Plan de hele dag</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
               <div className="space-y-4">
                  <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest">Zalen</label>
                  <input type="number" value={hallsCount} onChange={(e) => {setHallsCount(Number(e.target.value)); setTargetPlayerCount(null);}} className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold focus:ring-2 ring-amber-500 outline-none" />
                  <div className="grid grid-cols-3 gap-2">
                    {hallNames.map((name, i) => (
                      <input key={i} type="text" value={name} maxLength={1} onChange={(e) => { const n = [...hallNames]; n[i] = e.target.value.toUpperCase(); setHallNames(n); }} className="bg-gray-700 border-gray-600 rounded text-white text-center p-1 text-xs font-bold uppercase" />
                    ))}
                  </div>
                  <label className="block text-gray-500 text-[10px] font-black uppercase">Wedstrijden p.p.</label>
                  <input type="number" value={matchesPerPlayer} onChange={(e) => {setMatchesPerPlayer(Number(e.target.value)); setTargetPlayerCount(null);}} className="w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold" />
                  <div className="flex gap-2 mt-1">
                      {[4, 5].map(n => <button key={n} onClick={() => {setPlayersPerTeam(n); setTargetPlayerCount(null);}} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>)}
                  </div>
               </div>
            </div>
            <div className="lg:col-span-2">
               <h3 className="text-white font-bold text-sm uppercase mb-4 tracking-widest">Kies Spelersaantal:</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {possibilities.map(opt => (
                    <button key={opt.playerCount} onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}} className={`p-5 rounded-2xl border-2 text-left transition-all ${targetPlayerCount === opt.playerCount ? 'bg-amber-500/20 border-amber-500 shadow-lg' : 'bg-gray-800 border-gray-700'}`}>
                      <span className="text-2xl font-black text-white">{opt.playerCount} Spelers</span>
                      <p className="text-gray-400 text-xs tracking-tight">{opt.totalRounds} rondes.</p>
                    </button>
                  ))}
               </div>
            </div>
          </div>
          {targetPlayerCount && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Selecteer {targetPlayerCount} Spelers ({selectedPlayerIds.size})</h3>
                {selectedPlayerIds.size === targetPlayerCount && <button onClick={handleStartTournament} className="bg-green-600 text-white font-black px-8 py-3 rounded-xl shadow-lg uppercase text-sm">Genereer</button>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-gray-900 rounded-3xl border border-gray-700">
                {players.map(p => (
                  <button key={p.id} onClick={() => { const n = new Set(selectedPlayerIds); if (n.has(p.id)) n.delete(p.id); else if (n.size < targetPlayerCount!) n.add(p.id); setSelectedPlayerIds(n); }} className={`p-3 rounded-xl text-xs font-bold border ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 opacity-60'}`}>{p.name}</button>
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
          .print-area { display: block !important; width: 100%; }
          .match-card { border: 2px solid black !important; margin-bottom: 20px; page-break-inside: avoid; padding: 15px; background: white !important; }
          .match-card * { color: black !important; }
          .round-title { font-size: 24px; font-weight: bold; border-bottom: 3px solid black; margin-top: 30px; margin-bottom: 10px; color: black !important; }
        }
      `}</style>
      <div className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border-b-4 border-amber-500 shadow-xl">
        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">NK Manager</h2>
        <div className="flex bg-gray-900 p-1 rounded-xl">
          {['schedule', 'standings', 'analysis'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Print</button>
          <button onClick={() => {if(window.confirm("NK wissen?")) {localStorage.removeItem('bounceball_nk_session'); setSession(null);}}} className="bg-red-900/30 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors hover:bg-red-900/50">Reset</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'schedule' && (
          <div className="space-y-12">
            <div className="no-print bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-6 shadow-inner text-white">
                <input type="text" placeholder="Highlight naam..." value={highlightName} onChange={(e) => setHighlightName(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg text-white p-2 text-sm outline-none transition-all focus:ring-2 ring-green-500" />
            </div>
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
                          <div className="flex items-center gap-4">
                              {match.isPlayed && <span className="text-green-500 font-black">✓ GESPEELD</span>}
                              <span className={`underline ${isHighlighted(match.referee?.name || '') ? 'text-green-400 font-black' : 'text-pink-400'}`}>Scheids: {match.referee?.name}</span>
                          </div>
                        </div>
                        <div className="p-5 flex items-stretch justify-between gap-4">
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2">Team Blauw</div>
                                {match.team1.map(p => <div key={p.id} className={`text-sm uppercase ${isHighlighted(p.name) ? 'text-green-400 font-black scale-105' : 'text-white'}`}>{p.name}</div>)}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-tighter">GEM: {avg1.toFixed(2)}</div>
                          </div>
                          <div className="no-print flex flex-col justify-center items-center gap-2">
                            <div className="flex items-center gap-2">
                              <input type="number" value={match.team1Score} onChange={(e) => updateScore(rIdx, mIdx, 1, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-xl text-center font-black text-xl text-white border-2 border-gray-700 outline-none" />
                              <span className="text-gray-600 font-bold">-</span>
                              <input type="number" value={match.team2Score} onChange={(e) => updateScore(rIdx, mIdx, 2, parseInt(e.target.value) || 0)} className="w-12 h-12 bg-gray-900 rounded-xl text-center font-black text-xl text-white border-2 border-gray-700 outline-none" />
                            </div>
                            <button onClick={() => togglePlayed(rIdx, mIdx)} className={`mt-1 text-[8px] font-black px-2 py-1 rounded ${match.isPlayed ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{match.isPlayed ? 'HERSTEL' : 'GESPEELD'}</button>
                          </div>
                          <div className="flex-1 flex flex-col justify-between text-right">
                            <div>
                                <div className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-2">Team Geel</div>
                                {match.team2.map(p => <div key={p.id} className={`text-sm uppercase ${isHighlighted(p.name) ? 'text-green-400 font-black scale-105' : 'text-white'}`}>{p.name}</div>)}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-tighter">GEM: {avg2.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-4 text-[8px] font-bold uppercase tracking-widest">
                          <span className={isHighlighted(match.subHigh?.name || '') ? 'text-green-400 font-black' : 'text-pink-400'}>Res 1: {match.subHigh?.name}</span>
                          <span className={isHighlighted(match.subLow?.name || '') ? 'text-green-400 font-black' : 'text-pink-400'}>Res 2: {match.subLow?.name}</span>
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
              <thead className="bg-gray-900 text-gray-400 text-[9px] uppercase font-black tracking-tighter sm:tracking-widest">
                <tr><th className="px-2 py-4 text-center w-8 text-white text-xs">#</th><th className="px-2 py-4 text-white text-xs">Deelnemer</th><th className="px-1 py-4 text-center w-8 text-white text-xs">W</th><th className="px-1 py-4 text-center w-12 text-white text-xs">PTN</th><th className="px-1 py-4 text-center w-8 text-white text-xs">DS</th><th className="px-1 py-4 text-center w-8 text-white text-xs">GV</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {session.standings.map((entry, idx) => (
                  <tr key={entry.playerId} className={idx < 3 ? 'bg-amber-500/5' : ''}>
                    <td className="px-2 py-3 text-center font-black text-amber-500 text-sm">{idx + 1}</td>
                    <td className="px-2 py-3 font-bold text-white uppercase text-[11px] truncate max-w-[80px]">{entry.playerName}</td>
                    <td className="px-1 py-3 text-center text-gray-400 text-xs font-black">{entry.matchesPlayed}</td>
                    <td className="px-1 py-3 text-center"><span className="bg-gray-700 text-amber-400 px-2 py-0.5 rounded-full font-black text-xs shadow-inner">{entry.points}</span></td>
                    <td className={`px-1 py-3 text-center font-bold text-xs ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                    <td className="px-1 py-3 text-center text-gray-400 text-xs">{entry.goalsFor}</td>
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
