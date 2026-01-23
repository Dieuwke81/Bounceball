import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import { generateFixedNKSchedule } from '../services/fixedNKGenerator'; // NIEUW
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';
import NKPrintViews from './NKPrintViews';

interface NKManagerProps { 
  players: Player[]; 
  introPlayers: Player[]; 
  onClose: () => void; 
}

type PrintType = 'overview' | 'halls' | 'players' | null;
type NKType = 'individual' | 'fixed'; // NIEUW

const NKManager: React.FC<NKManagerProps> = ({ players, introPlayers = [], onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightName, setHighlightName] = useState(''); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorAnalysis, setErrorAnalysis] = useState<string | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [activePrintType, setActivePrintType] = useState<PrintType>(null);
  
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [playersPerTeam, setPlayersPerTeam] = useState(5); // Standaard nu 5
  const [minTeamRating, setMinTeamRating] = useState(4.0);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');
  const [playerSource, setPlayerSource] = useState<'database' | 'intro'>('database');
  const [nkType, setNkType] = useState<NKType>('individual'); // NIEUW

  const [selectedOption, setSelectedOption] = useState<any | null>(null);
  const [manualTimes, setManualTimes] = useState<{start: string, end: string}[]>([]);

  useEffect(() => {
    const savedSession = localStorage.getItem('bounceball_nk_session');
    if (savedSession) setSession(JSON.parse(savedSession));
    const savedSource = localStorage.getItem('bounceball_nk_player_source');
    if (savedSource) setPlayerSource(savedSource as any);
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
    localStorage.setItem('bounceball_nk_player_source', playerSource);
  }, [session, playerSource]);

  const activePlayerPool = useMemo(() => playerSource === 'database' ? players : introPlayers, [playerSource, players, introPlayers]);

  const handleHallsCountChange = (count: number) => {
    const newCount = Math.max(1, count);
    setHallsCount(newCount);
    setHallNames(prev => {
      const names = [...prev];
      while (names.length < newCount) names.push(String.fromCharCode(65 + names.length));
      return names.slice(0, newCount);
    });
  };

  const handleParseAttendance = () => {
    const normalize = (str: string): string => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const lines = attendanceText.split('\n');
    const potentialNames = new Set<string>();
    lines.forEach((line) => {
      let cleaned = line.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-\–]/)[0].trim();
      if (cleaned.length > 1) potentialNames.add(cleaned);
    });
    const playerLookup = new Map<string, Player>();
    activePlayerPool.forEach((player) => {
      playerLookup.set(normalize(player.name), player);
      playerLookup.set(normalize(player.name).split(' ')[0], player);
    });
    const newSet = new Set(selectedPlayerIds);
    potentialNames.forEach((name) => {
      const matched = playerLookup.get(normalize(name));
      if (matched) newSet.add(matched.id);
    });
    setSelectedPlayerIds(newSet);
    setAttendanceText('');
  };

  // Bereken opties voor Individueel toernooi
  const calculatedOptions = useMemo(() => {
    const n = selectedPlayerIds.size;
    const pPerMatch = playersPerTeam * 2;
    if (n < pPerMatch || nkType === 'fixed') return [];
    const options = [];
    const hUsed = Math.min(hallsCount, Math.floor(n / pPerMatch));
    for (let mpp = 3; mpp <= 12; mpp++) {
      if ((n * mpp) % pPerMatch === 0) {
        const totalMatches = (n * mpp) / pPerMatch;
        const rounds = Math.ceil(totalMatches / hUsed);
        const resting = n - (hUsed * pPerMatch);
        options.push({ mpp, totalMatches, rounds, resting, label: resting >= hUsed * 3 ? "Perfecte rust" : "Mogelijk", score: resting });
      }
    }
    return options.sort((a, b) => b.score - a.score);
  }, [selectedPlayerIds.size, hallsCount, playersPerTeam, nkType]);

  // Bereken stand (Individueel of Team)
  const currentStandings = useMemo(() => {
    if (!session) return [];
    const isFixed = (session as any).isFixedTeams;
    
    if (isFixed) {
      // TEAM STANDING
      const teamStats = new Map<number, any>();
      (session as any).fixedTeams.forEach((t: any) => {
        teamStats.set(t.id, { id: t.id, name: t.name, points: 0, gd: 0, matches: 0 });
      });

      session.rounds.forEach(r => r.matches.forEach(m => {
        if (!m.isPlayed) return;
        const t1Id = (session as any).fixedTeams.findIndex((ft: any) => ft.players[0].id === m.team1[0].id);
        const t2Id = (session as any).fixedTeams.findIndex((ft: any) => ft.players[0].id === m.team2[0].id);
        const s1 = teamStats.get(t1Id); const s2 = teamStats.get(t2Id);
        if (s1 && s2) {
          s1.matches++; s2.matches++;
          s1.gd += (m.team1Score - m.team2Score); s2.gd += (m.team2Score - m.team1Score);
          if (m.team1Score > m.team2Score) s1.points += 3;
          else if (m.team2Score > m.team1Score) s2.points += 3;
          else { s1.points += 1; s2.points += 1; }
        }
      }));
      return Array.from(teamStats.values()).sort((a, b) => b.points - a.points || b.gd - a.gd);
    } else {
      // INDIVIDUELE STANDING (bestaand)
      const stats = new Map<number, NKStandingsEntry>();
      session.rounds.forEach(r => r.matches.forEach(m => {
        if (!m.isPlayed) return;
        [...m.team1, ...m.team2].forEach(p => {
          if (!stats.has(p.id)) stats.set(p.id, { playerId: p.id, playerName: p.name, points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 });
          const st = stats.get(p.id)!; st.matchesPlayed++;
          const isT1 = m.team1.some(tp => tp.id === p.id);
          const ptn = m.team1Score === m.team2Score ? 1 : (isT1 ? (m.team1Score > m.team2Score ? 3 : 0) : (m.team2Score > m.team1Score ? 3 : 0));
          st.points += ptn; st.goalDifference += isT1 ? (m.team1Score - m.team2Score) : (m.team2Score - m.team1Score);
        });
      }));
      return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
    }
  }, [session]);

  const handleStartFixedNK = async () => {
    setIsGenerating(true); setProgressMsg("Teams maken & Schema berekenen...");
    try {
      const p = activePlayerPool.filter(x => selectedPlayerIds.has(x.id));
      const s = await generateFixedNKSchedule(p, hallNames, playersPerTeam, "NK Vaste Teams", manualTimes);
      setSession(s);
    } catch(e:any) { setErrorAnalysis(e.message); } finally { setIsGenerating(false); }
  };

  const updateFixedTeamName = (teamIdx: number, newName: string) => {
    if (!session) return;
    const newS = JSON.parse(JSON.stringify(session));
    newS.fixedTeams[teamIdx].name = newName;
    // Update ook alle matches waar dit team in voorkomt
    newS.rounds.forEach((r: any) => r.matches.forEach((m: any) => {
        if (m.team1[0].id === newS.fixedTeams[teamIdx].players[0].id) m.team1Name = newName;
        if (m.team2[0].id === newS.fixedTeams[teamIdx].players[0].id) m.team2Name = newName;
    }));
    setSession(newS);
  };

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white font-black">
      <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
      <h2 className="text-3xl uppercase italic">{progressMsg}</h2>
    </div>
  );

  if (!session) return (
    <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-3xl border border-amber-500/20 shadow-2xl space-y-6 text-white font-black">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <TrophyIcon className="w-10 h-10 text-amber-500" />
          <h2 className="text-3xl uppercase italic tracking-tighter">NK Setup</h2>
        </div>
        <button onClick={onClose} className="bg-gray-700 px-4 py-2 rounded-xl text-[10px] font-bold uppercase">Terug</button>
      </div>

      <div className="flex bg-gray-900 p-1 rounded-2xl w-fit mx-auto border border-gray-700">
        <button onClick={() => { setNkType('individual'); setPlayerSource('database'); }} className={`px-6 py-2 rounded-xl text-[10px] uppercase transition-all ${nkType === 'individual' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>Individueel</button>
        <button onClick={() => { setNkType('fixed'); setPlayerSource('database'); }} className={`px-6 py-2 rounded-xl text-[10px] uppercase transition-all ${nkType === 'fixed' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>Vaste Teams</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 space-y-4">
          <div><span className="text-[10px] text-gray-500 uppercase tracking-widest">Zalen</span><input type="number" value={hallsCount} onChange={e => handleHallsCountChange(+e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl border border-gray-700 outline-none" /></div>
          <div><span className="text-[10px] text-gray-500 uppercase tracking-widest">Spelers per team</span>
            <div className="flex gap-2 mt-1">{[4, 5].map(n => <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-2 rounded-xl border-2 ${playersPerTeam === n ? 'border-amber-500 bg-amber-500/20' : 'border-gray-700'}`}>{n}</button>)}</div>
          </div>
          <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak WhatsApp lijst..." className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs outline-none" />
          <button onClick={handleParseAttendance} className="w-full py-3 bg-amber-500 text-white rounded-xl uppercase text-xs">Verwerk Lijst</button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end"><h3 className="uppercase text-xs tracking-widest">Deelnemers ({selectedPlayerIds.size})</h3><button onClick={() => setSelectedPlayerIds(new Set())} className="text-[10px] text-red-500 underline">Wis alles</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-black/20 rounded-xl custom-scrollbar">
            {activePlayerPool.map(p => (
              <button key={p.id} onClick={() => { const n = new Set(selectedPlayerIds); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSelectedPlayerIds(n); }} className={`p-2 rounded-lg text-[10px] border truncate ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-white text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>{p.name}</button>
            ))}
          </div>

          {nkType === 'individual' ? (
             <div className="grid sm:grid-cols-2 gap-3 mt-4">
               {calculatedOptions.map(opt => (
                 <button key={opt.mpp} onClick={() => { setSelectedOption(opt); setManualTimes(Array.from({ length: opt.rounds }, () => ({ start: '', end: '' }))); }} className={`p-4 rounded-2xl border-2 text-left ${selectedOption?.mpp === opt.mpp ? 'border-amber-500 bg-amber-500/20' : 'border-gray-700'}`}>
                   <div className="text-xl font-black">{opt.mpp} Wedstrijden p.p.</div>
                   <div className="text-[9px] text-gray-400 uppercase">{opt.rounds} rondes | {opt.resting} rust</div>
                 </button>
               ))}
             </div>
          ) : (
             <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 text-center">
                <p className="text-sm">Vaste teams van {playersPerTeam} spelers.</p>
                <p className="text-[10px] text-gray-400 uppercase">Schema: Iedereen speelt 1x tegen elk ander team.</p>
                {selectedPlayerIds.size > 0 && selectedPlayerIds.size % playersPerTeam !== 0 && (
                    <p className="text-red-500 text-[10px] mt-2 font-bold">LET OP: Selecteer nog {playersPerTeam - (selectedPlayerIds.size % playersPerTeam)} spelers (optie B).</p>
                )}
                {selectedPlayerIds.size > 0 && selectedPlayerIds.size % playersPerTeam === 0 && (
                    <button onClick={() => setManualTimes(Array.from({ length: (selectedPlayerIds.size / playersPerTeam) }, () => ({ start: '', end: '' })))} className="mt-2 bg-amber-500 px-4 py-2 rounded-lg text-xs">Bevestig Deelnemers</button>
                )}
             </div>
          )}

          {manualTimes.length > 0 && (
             <div className="bg-gray-900/50 p-6 rounded-3xl border-2 border-amber-500/30 space-y-4">
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                 {manualTimes.map((time, idx) => (
                   <div key={idx} className="bg-gray-800 p-2 rounded-xl text-center">
                     <div className="text-[10px] text-gray-500 uppercase">Ronde {idx + 1}</div>
                     <div className="flex gap-1 mt-1">
                        <input type="text" placeholder="Start" value={time.start} onChange={e => { const n = [...manualTimes]; n[idx].start = e.target.value; setManualTimes(n); }} className="w-full bg-gray-900 text-[10px] p-1 rounded text-center" />
                        <input type="text" placeholder="Eind" value={time.end} onChange={e => { const n = [...manualTimes]; n[idx].end = e.target.value; setManualTimes(n); }} className="w-full bg-gray-900 text-[10px] p-1 rounded text-center" />
                     </div>
                   </div>
                 ))}
               </div>
               <button onClick={nkType === 'fixed' ? handleStartFixedNK : async () => {
                  setIsGenerating(true); 
                  const p = activePlayerPool.filter(x => selectedPlayerIds.has(x.id));
                  const s = await generateNKSchedule(p, hallNames, selectedOption.mpp, playersPerTeam, "NK", setProgressMsg, manualTimes, minTeamRating, playerSource === 'intro');
                  setSession(s);
                  setIsGenerating(false);
               }} className="w-full py-4 bg-green-600 rounded-2xl uppercase font-black tracking-widest">Start Toernooi</button>
             </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 text-white font-black">
      <div className="bg-gray-800 p-6 rounded-3xl border-b-8 border-amber-500 shadow-2xl space-y-6">
        <h2 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter text-center">NK Manager</h2>
        <div className="flex justify-center">
          <div className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 w-full max-w-md">
            {(['schedule', 'standings', 'analysis'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-4">
           <button onClick={() => setPrintMenuOpen(true)} className="bg-gray-700 px-6 py-2.5 rounded-xl text-[10px] uppercase">Print</button>
           <button onClick={() => { if(confirm("Wissen?")) setSession(null); }} className="bg-red-900/40 text-red-500 px-6 py-2.5 rounded-xl text-[10px] uppercase">Reset</button>
        </div>
      </div>

      <main className="space-y-8">
        {activeTab === 'schedule' && (
          <>
            {(session as any).isFixedTeams && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-800 p-4 rounded-2xl border border-gray-700">
                    {(session as any).fixedTeams.map((team: any, i: number) => (
                        <div key={i} className="space-y-1">
                            <input type="text" value={team.name} onChange={e => updateFixedTeamName(i, e.target.value)} className="bg-gray-900 text-amber-500 text-[10px] font-black uppercase p-1 w-full rounded border border-gray-700" />
                            <div className="text-[8px] text-gray-500 uppercase">{team.players.map((p: any) => p.name).join(', ')}</div>
                        </div>
                    ))}
                </div>
            )}
            
            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl text-amber-500 uppercase italic border-l-4 border-amber-500 pl-4">Ronde {round.roundNumber}</h3>
                    {round.startTime && <span className="bg-gray-800 px-3 py-1 rounded-lg text-xs text-gray-400">{round.startTime} - {round.endTime}</span>}
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  {round.matches.map((match, mIdx) => (
                    <div key={mIdx} className={`bg-gray-800 rounded-2xl border-2 ${match.isPlayed ? 'border-green-500' : 'border-gray-700'} overflow-hidden`}>
                      <div className="bg-gray-900/50 p-3 flex justify-between text-[10px] uppercase text-gray-500 font-black">
                        <span>📍 ZAAL <span className="text-white">{match.hallName}</span></span>
                        {(session as any).isFixedTeams ? <span className="text-cyan-400">Vaste Teams</span> : <span className="text-pink-400">Ref: {match.referee?.name}</span>}
                      </div>
                      <div className="p-5 flex justify-between items-center gap-4">
                        <div className="flex-1 text-left">
                            <div className="text-[9px] text-blue-400 uppercase font-black">{(match as any).team1Name || 'Blauw'}</div>
                            {match.team1.map(p => <div key={p.id} className="text-sm uppercase font-bold">{p.name}</div>)}
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" value={match.team1Score} onChange={e => { const n = JSON.parse(JSON.stringify(session)); n.rounds[rIdx].matches[mIdx].team1Score = +e.target.value; n.rounds[rIdx].matches[mIdx].isPlayed = true; setSession(n); }} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl" />
                          <span className="text-gray-600">-</span>
                          <input type="number" value={match.team2Score} onChange={e => { const n = JSON.parse(JSON.stringify(session)); n.rounds[rIdx].matches[mIdx].team2Score = +e.target.value; n.rounds[rIdx].matches[mIdx].isPlayed = true; setSession(n); }} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl" />
                        </div>
                        <div className="flex-1 text-right">
                            <div className="text-[9px] text-amber-400 uppercase font-black">{(match as any).team2Name || 'Geel'}</div>
                            {match.team2.map(p => <div key={p.id} className="text-sm uppercase font-bold">{p.name}</div>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700">
            <table className="w-full text-left uppercase">
              <thead className="bg-gray-900 text-gray-500 text-[10px] font-black">
                <tr><th className="p-5">#</th><th>{(session as any).isFixedTeams ? 'Team' : 'Speler'}</th><th className="text-center">W</th><th className="text-center">DS</th><th className="p-5 text-center">PTN</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {currentStandings.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/30">
                    <td className="p-5 text-amber-500 font-black">{idx + 1}</td>
                    <td className="font-bold text-sm">{(entry as any).name || (entry as any).playerName}</td>
                    <td className="text-center text-xs text-gray-400">{(entry as any).matches || (entry as any).matchesPlayed}</td>
                    <td className={`text-center font-black text-xs ${(entry as any).gd || (entry as any).goalDifference > 0 ? 'text-green-500' : 'text-red-500'}`}>{(entry as any).gd || (entry as any).goalDifference}</td>
                    <td className="p-5 text-center"><span className="bg-gray-900 text-amber-400 px-4 py-1.5 rounded-full font-black text-sm">{entry.points}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default NKManager;
