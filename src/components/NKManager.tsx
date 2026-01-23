import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import { generateFixedNKSchedule } from '../services/fixedNKGenerator';
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';
import NKPrintViews from './NKPrintViews';

interface NKManagerProps { 
  players: Player[]; 
  introPlayers: Player[]; 
  onClose: () => void; 
}

type PrintType = 'overview' | 'halls' | 'players' | null;
type NKType = 'individual' | 'fixed';

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
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [minTeamRating, setMinTeamRating] = useState(4.0);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');
  const [playerSource, setPlayerSource] = useState<'database' | 'intro'>('database');
  const [nkType, setNkType] = useState<NKType>('individual');

  const [selectedOption, setSelectedOption] = useState<any | null>(null);
  const [manualTimes, setManualTimes] = useState<{start: string, end: string}[]>([]);

  useEffect(() => {
    const savedSession = localStorage.getItem('bounceball_nk_session');
    if (savedSession) setSession(JSON.parse(savedSession));

    const savedSource = localStorage.getItem('bounceball_nk_player_source');
    if (savedSource === 'intro' || savedSource === 'database') {
      setPlayerSource(savedSource as 'database' | 'intro');
    }
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
    }
    localStorage.setItem('bounceball_nk_player_source', playerSource);
  }, [session, playerSource]);

  const activePlayerPool = useMemo(() => {
    return playerSource === 'database' ? players : introPlayers;
  }, [playerSource, players, introPlayers]);

  const ratingColors = useMemo(() => {
    if (playerSource !== 'intro') return new Map();
    const uniqueRatings = Array.from(new Set(activePlayerPool.map(p => p.rating))).sort((a, b) => b - a);
    const colorConfigs = [
      { text: 'text-cyan-400', border: 'border-cyan-500', bg: 'bg-cyan-500/20' },
      { text: 'text-lime-400', border: 'border-lime-500', bg: 'bg-lime-500/20' },
      { text: 'text-fuchsia-400', border: 'border-fuchsia-500', bg: 'bg-fuchsia-500/20' },
      { text: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-500/20' },
    ];
    const map = new Map();
    uniqueRatings.forEach((r, i) => { map.set(r, colorConfigs[i % colorConfigs.length]); });
    return map;
  }, [activePlayerPool, playerSource]);

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
    const normalize = (str: string): string =>
      str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\.$/, '');

    const lines = attendanceText.split('\n');
    const potentialNames = new Set<string>();
    const monthNames = ['feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const nonNameIndicators = ['afgemeld', 'gemeld', 'ja', 'nee', 'ok', 'jup', 'aanwezig', 'present', 'ik ben er', 'ik kan', 'helaas', 'ik ben erbij', 'twijfel', 'later', 'keepen', 'reserve', 'keeper'];

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
    activePlayerPool.forEach((player) => {
      const normalizedFullName = normalize(player.name);
      const normalizedFirstName = normalizedFullName.split(' ')[0];
      playerLookup.set(normalizedFullName, player);
      if (!playerLookup.has(normalizedFirstName)) playerLookup.set(normalizedFirstName, player);
    });

    const newSet = new Set(selectedPlayerIds);
    potentialNames.forEach((originalName) => {
      const normalizedName = normalize(originalName);
      const matchedPlayer = playerLookup.get(normalizedName) || playerLookup.get(normalizedName.split(' ')[0]);
      if (matchedPlayer) newSet.add(matchedPlayer.id);
    });
    setSelectedPlayerIds(newSet);
    setAttendanceText('');
  };

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
        const needs = hUsed * 3;
        let label = "Mogelijk", color = "border-gray-700 bg-gray-800/50", score = 50;
        if (resting >= needs) { label = "Perfecte rust"; color = "border-green-500 bg-green-500/10"; score = 100; }
        else if (resting >= 1) { label = "Weinig rust"; color = "border-amber-500 bg-amber-500/10"; score = 70; }
        else { label = "Geen officials"; color = "border-red-500/50 bg-red-500/5"; score = 10; }
        options.push({ mpp, totalMatches, rounds, resting, label, color, score });
      }
    }
    return options.sort((a, b) => b.score - a.score);
  }, [selectedPlayerIds.size, hallsCount, playersPerTeam, nkType]);

  const currentStandings = useMemo(() => {
    if (!session) return [];
    const isFixed = (session as any).isFixedTeams;

    if (isFixed) {
        const teamStats = new Map<number, any>();
        (session as any).fixedTeams.forEach((t: any) => {
            teamStats.set(t.id, { id: t.id, name: t.name, points: 0, goalDifference: 0, matchesPlayed: 0 });
        });
        session.rounds.forEach(r => r.matches.forEach(m => {
            if (!m.isPlayed) return;
            const t1Id = (session as any).fixedTeams.findIndex((ft: any) => ft.players[0].id === m.team1[0].id);
            const t2Id = (session as any).fixedTeams.findIndex((ft: any) => ft.players[0].id === m.team2[0].id);
            const s1 = teamStats.get(t1Id); const s2 = teamStats.get(t2Id);
            if (s1 && s2) {
                s1.matchesPlayed++; s2.matchesPlayed++;
                s1.goalDifference += (m.team1Score - m.team2Score); s2.goalDifference += (m.team2Score - m.team1Score);
                if (m.team1Score > m.team2Score) s1.points += 3;
                else if (m.team2Score > m.team1Score) s2.points += 3;
                else { s1.points += 1; s2.points += 1; }
            }
        }));
        return Array.from(teamStats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
    } else {
        const stats = new Map<number, NKStandingsEntry>();
        session.rounds.forEach(r => r.matches.forEach(m => {
          [...m.team1, ...m.team2].forEach(p => {
            if (!stats.has(p.id)) {
              stats.set(p.id, { playerId: p.id, playerName: p.name || '?', points: 0, goalDifference: 0, goalsFor: 0, matchesPlayed: 0 });
            }
          });
        }));
        session.rounds.forEach(r => r.matches.forEach(m => {
          if (!m.isPlayed) return;
          const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
          const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
          m.team1.forEach(p => { const st = stats.get(p.id); if (st) { st.matchesPlayed++; st.points += p1; st.goalsFor += m.team1Score; st.goalDifference += (m.team1Score - m.team2Score); }});
          m.team2.forEach(p => { const st = stats.get(p.id); if (st) { st.matchesPlayed++; st.points += p2; st.goalsFor += m.team2Score; st.goalDifference += (m.team2Score - m.team1Score); }});
        }));
        return Array.from(stats.values()).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
    }
  }, [session]);

  const coOpData = useMemo(() => {
    if (!session) return [];
    const participantIds = Array.from(new Set(session.rounds.flatMap(r => r.matches.flatMap(m => [...m.team1, ...m.team2].map(p => p.id))))).sort();
    const pairsMap = new Map<string, { p1: string, p2: string, together: number, against: number }>();
    for (let i = 0; i < participantIds.length; i++) {
      for (let j = i + 1; j < participantIds.length; j++) {
        const id1 = participantIds[i]; const id2 = participantIds[j]; const key = [id1, id2].sort().join('-');
        pairsMap.set(key, { p1: activePlayerPool.find(p => p.id === id1)?.name || '?', p2: activePlayerPool.find(p => p.id === id2)?.name || '?', together: 0, against: 0 });
      }
    }
    session.rounds.forEach(r => r.matches.forEach(m => {
      const add = (id1: number, id2: number, type: 'together' | 'against') => { const d = pairsMap.get([id1, id2].sort().join('-')); if (d) d[type]++; };
      m.team1.forEach((p, idx) => m.team1.slice(idx + 1).forEach(p2 => add(p.id, p2.id, 'together')));
      m.team2.forEach((p, idx) => m.team2.slice(idx + 1).forEach(p2 => add(p.id, p2.id, 'together')));
      m.team1.forEach(p => m.team2.forEach(p2 => add(p.id, p2.id, 'against')));
    }));
    return Array.from(pairsMap.values()).sort((a, b) => (b.together + b.against) - (a.together + a.against));
  }, [session, activePlayerPool]);

  const totalRankings = useMemo(() => {
    const totals = coOpData.map(d => d.together + d.against);
    const uniqueSorted = Array.from(new Set(totals)).filter(n => n > 0).sort((a, b) => b - a);
    return { highest: uniqueSorted[0] || 0, second: uniqueSorted[1] || 0, third: uniqueSorted[2] || 0, fourth: uniqueSorted[3] || 0 };
  }, [coOpData]);

  const maxTournamentDiff = useMemo(() => {
    if (!session) return 0;
    let max = 0;
    session.rounds.forEach(r => r.matches.forEach(m => {
        const avg1 = m.team1.reduce((s, p) => s + p.rating, 0) / m.team1.length;
        const avg2 = m.team2.reduce((s, p) => s + p.rating, 0) / m.team2.length;
        const diff = Math.abs(avg1 - avg2);
        if (diff > max) max = diff;
    }));
    return max;
  }, [session]);

  const playerSchedules = useMemo(() => {
    if (!session) return [];
    const participantIds = Array.from(new Set(session.rounds.flatMap(r => r.matches.flatMap(m => [...m.team1, ...m.team2, m.referee, m.subHigh, m.subLow].filter(p => p).map(p => p!.id))))).sort((a, b) => {
        const nameA = activePlayerPool.find(p => p.id === a)?.name || '';
        const nameB = activePlayerPool.find(p => p.id === b)?.name || '';
        return nameA.localeCompare(nameB);
    });
    return participantIds.map(id => {
        const p = activePlayerPool.find(x => x.id === id);
        const rounds = session.rounds.map(r => {
            const match = r.matches.find(m => [...m.team1, ...m.team2, m.referee, m.subHigh, m.subLow].some(pl => pl?.id === id));
            let role = "RUST";
            if (match?.team1.some(pl => pl.id === id)) role = "BLAUW";
            else if (match?.team2.some(pl => pl.id === id)) role = "GEEL";
            else if (match?.referee?.id === id) role = "REF";
            else if (match?.subHigh?.id === id || match?.subLow?.id === id) role = "RES";
            return { round: r.roundNumber, hall: match?.hallName || '-', role, startTime: (r as any).startTime || '' };
        });
        return { name: p?.name || '?', rounds };
    });
  }, [session, activePlayerPool]);

  const handlePrintAction = (type: PrintType) => {
    setActivePrintType(type); setPrintMenuOpen(false);
    setTimeout(() => { window.print(); setActivePrintType(null); }, 500);
  };

  const handleSelectOption = (opt: any) => {
    setSelectedOption(opt);
    setManualTimes(Array.from({ length: opt.rounds }, () => ({ start: '', end: '' })));
  };

  const updateManualTime = (idx: number, field: 'start' | 'end', val: string) => {
    const newTimes = [...manualTimes];
    newTimes[idx] = { ...newTimes[idx], [field]: val };
    setManualTimes(newTimes);
  };

  const handleStartFixedNK = async () => {
    setIsGenerating(true); setProgressMsg("Optimaliseren (Best of 50.000)...");
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
    newS.rounds.forEach((r: any) => r.matches.forEach((m: any) => {
        if (m.team1[0].id === newS.fixedTeams[teamIdx].players[0].id) m.team1Name = newName;
        if (m.team2[0].id === newS.fixedTeams[teamIdx].players[0].id) m.team2Name = newName;
    }));
    setSession(newS);
  };

  if (isGenerating) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-white text-center font-black">
      <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
      <h2 className="text-3xl font-black uppercase italic tracking-tighter">{progressMsg}</h2>
      <p className="text-gray-500 text-xs mt-2 uppercase font-bold animate-pulse tracking-widest text-center">Berekeningen worden uitgevoerd...</p>
    </div>
  );

  const isHighlighted = (name: string) => highlightName && name.toLowerCase().includes(highlightName.toLowerCase());

  if (!session) return (
    <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-3xl border border-amber-500/20 shadow-2xl space-y-6 text-white font-black">
      <div className="flex justify-between items-center text-white">
        <div className="flex items-center gap-4 text-white font-black">
          <TrophyIcon className="w-10 h-10 text-amber-500" />
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">NK Setup</h2>
        </div>
        <button onClick={onClose} className="bg-gray-700 px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-gray-600 transition-colors tracking-widest text-white">Terug</button>
      </div>

      <div className="flex bg-gray-900 p-1 rounded-2xl w-fit mx-auto border border-gray-700">
        <button 
          onClick={() => { setPlayerSource('database'); setSelectedPlayerIds(new Set()); setMinTeamRating(4.0); }}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${playerSource === 'database' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}
        >
          NK
        </button>
        <button 
          onClick={() => { setPlayerSource('intro'); setSelectedPlayerIds(new Set()); setMinTeamRating(6.25); }}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${playerSource === 'intro' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500'}`}
        >
          Introductie toernooi
        </button>
      </div>

      {playerSource === 'database' && (
        <div className="flex bg-gray-900/50 p-1 rounded-2xl w-fit mx-auto border border-gray-700 mt-2 animate-fade-in">
          <button onClick={() => setNkType('individual')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${nkType === 'individual' ? 'bg-cyan-500 text-white shadow-lg' : 'text-gray-600'}`}>Individueel</button>
          <button onClick={() => setNkType('fixed')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${nkType === 'fixed' ? 'bg-cyan-500 text-white shadow-lg' : 'text-gray-600'}`}>Vaste Teams</button>
        </div>
      )}

      {errorAnalysis && (
        <div className="bg-red-500/10 border-2 border-red-500/50 p-4 rounded-2xl text-white">
          <h3 className="text-red-500 font-black uppercase text-sm">Let op: Analyse Mislukking</h3>
          <p className="text-gray-300 text-[10px] mt-1 leading-relaxed whitespace-pre-line">{errorAnalysis}</p>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-8 text-white font-black">
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 space-y-4 text-white font-black">
          <div><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest font-black">Zalen</span><input type="number" value={hallsCount} onFocus={(e) => e.target.select()} onChange={e => handleHallsCountChange(+e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl font-bold border border-gray-700 focus:border-amber-500 outline-none text-white font-black" /></div>
          <div className="space-y-2 text-white font-black">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest text-white">Zaalnamen</span>
            <div className="grid grid-cols-1 gap-2 text-white font-black">
              {hallNames.map((name, i) => (
                <input key={i} type="text" value={name} onChange={(e) => {
                    const newNames = [...hallNames]; newNames[i] = e.target.value; setHallNames(newNames);
                  }} className="bg-gray-800 p-2 rounded-lg text-xs font-bold border border-gray-700 focus:border-amber-500 outline-none text-white font-black uppercase" placeholder={`Zaal ${i+1}`}
                />
              ))}
            </div>
          </div>
          <div><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest font-black">Min. Team Rating</span><input type="number" step="0.01" value={minTeamRating} onFocus={(e) => e.target.select()} onChange={e => setMinTeamRating(+e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl font-bold border border-gray-700 focus:border-amber-500 outline-none text-white font-black" /></div>
          <div className="flex gap-2 text-white font-black">{[4, 5].map(n => <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>)}</div>
          <textarea value={attendanceText} onChange={e => setAttendanceText(e.target.value)} placeholder="Plak WhatsApp lijst..." className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs outline-none text-white font-black" />
          <button onClick={handleParseAttendance} className="w-full py-3 bg-amber-500 text-white font-black rounded-xl uppercase text-xs hover:bg-amber-400 transition-all tracking-widest shadow-lg">Verwerk Lijst</button>
        </div>
        <div className="lg:col-span-2 space-y-4 text-white font-black">
          <div className="flex justify-between items-end text-white font-black"><h3 className="text-white font-bold uppercase text-xs tracking-widest font-black">Deelnemers ({selectedPlayerIds.size})</h3><button onClick={() => setSelectedPlayerIds(new Set())} className="text-[10px] text-red-500 font-bold uppercase underline">Wis alles</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-black/20 rounded-xl custom-scrollbar">
            {activePlayerPool.map(p => {
                const rConfig = ratingColors.get(p.rating);
                return (
                  <button 
                    key={p.id} 
                    onClick={() => { const n = new Set(selectedPlayerIds); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setSelectedPlayerIds(n); }} 
                    className={`p-2 rounded-lg text-[10px] font-black border transition-all truncate 
                        ${selectedPlayerIds.has(p.id) 
                            ? (playerSource === 'intro' ? (rConfig?.bg || 'bg-amber-500') : 'bg-amber-500') + ' border-white text-white font-black' 
                            : 'bg-gray-800 border-gray-700'}`}
                  >
                    <span className={!selectedPlayerIds.has(p.id) && playerSource === 'intro' ? (rConfig?.text || 'text-white') : 'text-white'}>
                        {p.name}
                    </span>
                  </button>
                );
            })}
          </div>
          
          {(nkType === 'individual' || playerSource === 'intro') ? (
            <div className="pt-4 border-t border-gray-700 space-y-4">
              <h3 className="text-white font-bold uppercase text-xs mb-3 text-amber-500 tracking-widest font-black">1. Kies Toernooivorm:</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {calculatedOptions.map(opt => (
                  <button key={opt.mpp} onClick={() => handleSelectOption(opt)} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedOption?.mpp === opt.mpp ? 'border-amber-500 bg-amber-500/20' : 'border-gray-700 bg-gray-800/40 hover:scale-[1.02]'}`}>
                    <div className="text-xl font-black tracking-tighter text-white">{opt.mpp} Wedstrijden p.p.</div>
                    <div className="mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-white font-black">{opt.rounds} rondes | {opt.resting} rust | {opt.label}</div>
                  </button>
                ))}
              </div>
              {selectedOption && (
                <div className="bg-gray-900/50 p-6 rounded-3xl border-2 border-amber-500/30 animate-fade-in space-y-4">
                  <h3 className="text-white font-bold uppercase text-xs text-amber-500 tracking-widest text-center font-black">2. Voer Tijdschema in (Handmatig):</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-64 overflow-y-auto p-2 custom-scrollbar">
                    {manualTimes.map((time, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded-xl border border-gray-700 text-white text-center font-black">
                        <div className="text-[10px] text-gray-500 font-black mb-2 uppercase">Ronde {idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <input type="text" value={time.start} placeholder="10:00" onChange={e => updateManualTime(idx, 'start', e.target.value)} className="w-full bg-gray-900 text-[10px] p-1.5 rounded border border-gray-700 text-white text-center font-black" />
                          <span className="text-gray-600 font-black">-</span>
                          <input type="text" value={time.end} placeholder="10:20" onChange={e => updateManualTime(idx, 'end', e.target.value)} className="w-full bg-gray-900 text-[10px] p-1.5 rounded border border-gray-700 text-white text-center font-black" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={async () => {
                      setIsGenerating(true); setProgressMsg("Balans optimaliseren..."); setErrorAnalysis(null);
                      try {
                        const p = activePlayerPool.filter(x => selectedPlayerIds.has(x.id));
                        const s = await generateNKSchedule(p, hallNames, selectedOption.mpp, playersPerTeam, "NK", setProgressMsg, manualTimes, minTeamRating, playerSource === 'intro');
                        setSession(s);
                      } catch(e:any) { setErrorAnalysis(e.message); } finally { setIsGenerating(false); }
                    }} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl transition-all font-black">Start Toernooi</button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-4 border-t border-gray-700 space-y-4">
               <div className="bg-amber-500/10 p-6 rounded-3xl border-2 border-amber-500/30 text-center animate-fade-in space-y-2">
                <p className="text-sm font-black uppercase text-amber-500">Vaste teams van {playersPerTeam}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Iedereen speelt 1x tegen elk ander team (Round Robin).</p>
                {selectedPlayerIds.size > 0 && selectedPlayerIds.size % playersPerTeam !== 0 && (
                    <p className="text-red-500 text-[10px] mt-2 font-black italic">LET OP: Selecteer nog {playersPerTeam - (selectedPlayerIds.size % playersPerTeam)} spelers (veelvoud van {playersPerTeam} nodig).</p>
                )}
                {selectedPlayerIds.size > 0 && selectedPlayerIds.size % playersPerTeam === 0 && (
                    <button onClick={() => {
                        const numTeams = selectedPlayerIds.size / playersPerTeam;
                        const roundsCount = numTeams % 2 === 0 ? numTeams - 1 : numTeams;
                        setManualTimes(Array.from({ length: roundsCount }, () => ({ start: '', end: '' })));
                    }} className="mt-4 bg-amber-500 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase shadow-lg hover:scale-105 transition-all font-black">Bevestig Deelnemers</button>
                )}
               </div>
               {manualTimes.length > 0 && (
                <div className="bg-gray-900/50 p-6 rounded-3xl border-2 border-amber-500/30 animate-fade-in space-y-4">
                  <h3 className="text-white font-bold uppercase text-xs text-amber-500 tracking-widest text-center font-black">Voer Tijdschema in (Handmatig):</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-64 overflow-y-auto p-2 custom-scrollbar">
                    {manualTimes.map((time, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded-xl border border-gray-700 text-white text-center font-black">
                        <div className="text-[10px] text-gray-500 font-black mb-2 uppercase">Ronde {idx + 1}</div>
                        <div className="flex items-center gap-1">
                          <input type="text" value={time.start} placeholder="10:00" onChange={e => { const n = [...manualTimes]; n[idx].start = e.target.value; setManualTimes(n); }} className="w-full bg-gray-900 text-[10px] p-1.5 rounded border border-gray-700 text-white text-center font-black" />
                          <span className="text-gray-600 font-black">-</span>
                          <input type="text" value={time.end} placeholder="10:20" onChange={e => { const n = [...manualTimes]; n[idx].end = e.target.value; setManualTimes(n); }} className="w-full bg-gray-900 text-[10px] p-1.5 rounded border border-gray-700 text-white text-center font-black" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleStartFixedNK} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl transition-all font-black">Start Vaste Teams Toernooi</button>
                </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 text-white font-black">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only { visibility: visible !important; display: block !important; position: absolute; left: 0; top: 0; width: 100%; background: white !important; }
          .print-only * { visibility: visible !important; }
          body { background: white !important; color: black !important; padding: 0 !important; }
        }
        .print-only { display: none; }
      `}</style>

      {printMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print text-white font-black">
          <div className="bg-gray-800 border-2 border-amber-500 rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl text-white font-black">
            <h3 className="text-2xl font-black uppercase italic text-center text-white">Print Menu</h3>
            <div className="space-y-3">
              <button onClick={() => handlePrintAction('overview')} className="w-full py-4 bg-gray-700 hover:bg-amber-500 text-white font-bold rounded-2xl transition-all uppercase text-xs font-black">Compleet Overzicht</button>
              <button onClick={() => handlePrintAction('halls')} className="w-full py-4 bg-gray-700 hover:bg-amber-500 text-white font-bold rounded-2xl transition-all uppercase text-xs font-black">Per Zaal</button>
              <button onClick={() => handlePrintAction('players')} className="w-full py-4 bg-gray-700 hover:bg-amber-500 text-white font-bold rounded-2xl transition-all uppercase text-xs font-black">Individuele Spelers</button>
            </div>
            <button onClick={() => setPrintMenuOpen(false)} className="w-full text-gray-500 font-bold uppercase text-[10px] hover:text-white transition-colors font-black">Annuleren</button>
          </div>
        </div>
      )}

      <div className="no-print bg-gray-800 p-6 rounded-3xl border-b-8 border-amber-500 shadow-2xl text-white space-y-6 font-black">
        <h2 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter text-center">NK Manager</h2>
        <div className="flex justify-center text-white font-black">
          <div className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 w-full max-w-md font-black">
            {(['schedule', 'standings', 'analysis'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${activeTab === t ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 font-black'}`}>{t === 'schedule' ? 'Schema' : t === 'standings' ? 'Stand' : 'Check'}</button>
            ))}
          </div>
        </div>
        <div className="flex justify-center gap-4 text-white font-black">
          <button onClick={() => setPrintMenuOpen(true)} className="flex-1 max-w-[200px] bg-gray-700 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-gray-600 transition-colors text-white text-center font-black">Print alleen via PC</button>
          <button onClick={() => { if(confirm("NK Wissen?")) { localStorage.removeItem('bounceball_nk_session'); localStorage.removeItem('bounceball_nk_player_source'); setSession(null); } }} className="flex-1 max-w-[120px] bg-red-900/40 text-red-500 py-2.5 rounded-xl text-[10px] font-black uppercase border border-red-500/20 hover:bg-red-800 hover:text-white transition-all font-black">Reset</button>
        </div>
      </div>

      <div className="no-print space-y-8 text-white font-black font-black">
        {activeTab === 'schedule' && (
          <>
            <input type="text" placeholder="Naam markeren..." value={highlightName} onChange={e => setHighlightName(e.target.value)} className="w-full bg-gray-800 p-4 rounded-2xl text-white border border-gray-700 outline-none focus:ring-2 ring-green-500 transition-all font-black uppercase" />
            
            {(session as any).isFixedTeams && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fade-in font-black font-black">
                    {(session as any).fixedTeams.map((team: any, i: number) => (
                        <div key={i} className="bg-gray-800 p-3 rounded-2xl border border-gray-700 shadow-lg font-black font-black">
                            <div className="flex justify-between items-center mb-1 font-black">
                                <input 
                                    type="text" 
                                    value={team.name} 
                                    onChange={e => updateFixedTeamName(i, e.target.value)} 
                                    className="bg-transparent text-amber-500 text-xs font-black uppercase outline-none focus:ring-1 ring-amber-500 rounded px-1 w-2/3 font-black" 
                                />
                                <span className="text-[9px] text-gray-500 font-mono font-black">avg: {team.avgRating.toFixed(2)}</span>
                            </div>
                            <div className="text-[8px] text-gray-400 uppercase leading-tight font-black">
                                {team.players.map((p: any) => p.name).join(', ')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {! (session as any).isFixedTeams && (
                <div className="bg-gray-800/80 border-l-4 border-amber-500 p-4 rounded-r-2xl flex items-center gap-6 shadow-xl mb-4 text-white font-black font-black">
                <div className="flex-1 flex justify-between items-center text-white">
                    <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none font-black text-white">Maximale rating verschil</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-3xl font-black italic tracking-tighter ${maxTournamentDiff > 0.4 ? 'text-red-500' : maxTournamentDiff > 0.25 ? 'text-amber-500' : 'text-green-500'}`}>
                        {maxTournamentDiff.toFixed(2)}
                        </span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tight text-white font-black">(Beste van 250)</span>
                    </div>
                    </div>
                </div>
                </div>
            )}

            {session.rounds.map((round, rIdx) => (
              <div key={rIdx} className="space-y-4 text-white font-black font-black">
                <div className="flex items-center gap-4 text-white font-black">
                    <h3 className="text-xl font-black text-amber-500 uppercase italic border-l-4 border-amber-500 pl-4 tracking-tighter text-white">Ronde {round.roundNumber}</h3>
                    {(round as any).startTime && (
                        <span className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 text-xs font-black text-gray-400 font-black">
                            {(round as any).startTime} - {(round as any).endTime}
                        </span>
                    )}
                </div>
                <div className="grid lg:grid-cols-2 gap-6 text-white font-black font-black">
                  {round.matches.map((match, mIdx) => {
                    const avg1 = match.team1.reduce((s, p) => s + p.rating, 0) / match.team1.length;
                    const avg2 = match.team2.reduce((s, p) => s + p.rating, 0) / match.team2.length;
                    const isFixed = (session as any).isFixedTeams;

                    return (
                      <div key={match.id} className={`match-card bg-gray-800 rounded-2xl border-2 ${match.isPlayed ? 'border-green-500/50 shadow-lg shadow-green-500/5' : 'border-gray-700'} overflow-hidden text-white font-black font-black`}>
                        <div className="bg-gray-900/50 p-3 flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest text-white font-black font-black">
                          <span>📍 ZAAL <span className="text-red-500 text-sm ml-1 font-black uppercase text-white">{match.hallName}</span></span>
                          {isFixed ? (
                             <span className="text-cyan-400 font-black font-black">Vaste Teams</span>
                          ) : (
                             <span className={`px-2 py-0.5 rounded transition-all ${isHighlighted(match.referee?.name || '') ? 'bg-green-500 text-white font-black scale-110 shadow-lg font-black' : 'text-pink-400 font-black'}`}>Ref: {match.referee?.name}</span>
                          )}
                        </div>
                        <div className="p-5 flex justify-between items-stretch gap-4 text-white font-black font-black">
                          <div className="flex-1 space-y-1 text-left text-white font-black">
                            <div className="text-[9px] text-blue-400 font-black uppercase mb-2 tracking-widest text-white font-black font-black font-black">{(match as any).team1Name || 'Team Blauw'}</div>
                            {match.team1.map(p => {
                                const rColor = ratingColors.get(p.rating);
                                return (
                                    <div key={p.id} className={`text-sm uppercase font-bold border-l-2 pl-2 ${playerSource === 'intro' ? (rColor?.border || 'border-transparent') : 'border-transparent'} transition-all ${isHighlighted(p.name) ? 'bg-green-500 text-white px-1 rounded-sm scale-105 shadow-md' : ''}`}>
                                        {p.name}
                                    </div>
                                );
                            })}
                            <div className="text-[9px] text-gray-500 mt-2 font-black font-black font-black font-black">GEM: {avg1.toFixed(2)}</div>
                          </div>
                          <div className="flex flex-col items-center justify-center gap-3 text-white font-black font-black">
                            <div className="flex items-center gap-2 text-white font-black font-black">
                              <input type="number" value={match.team1Score} onFocus={(e) => e.target.select()} onChange={e => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].team1Score = +e.target.value;
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = true;
                                  setSession(newS);
                                }} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border border-gray-700 text-white outline-none focus:border-amber-500 font-black" />
                              <span className="text-gray-600 font-black font-black">-</span>
                              <input type="number" value={match.team2Score} onFocus={(e) => e.target.select()} onChange={e => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].team2Score = +e.target.value;
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = true;
                                  setSession(newS);
                                }} className="w-12 h-12 bg-gray-900 text-center rounded-xl font-black text-xl border border-gray-700 text-white outline-none focus:border-amber-500 font-black" />
                            </div>
                            <div className="flex flex-col items-center gap-1 text-white font-black font-black font-black font-black">
                              <button onClick={() => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = true;
                                  setSession(newS);
                              }} className={`text-[8px] font-black px-3 py-1.5 rounded-lg transition-all ${match.isPlayed ? 'bg-green-600 text-white shadow-lg font-black' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>{match.isPlayed ? 'VERWERKT' : 'OPSLAAN'}</button>
                              <button onClick={() => {
                                  const newS = JSON.parse(JSON.stringify(session));
                                  newS.rounds[rIdx].matches[mIdx].isPlayed = false;
                                  newS.rounds[rIdx].matches[mIdx].team1Score = 0;
                                  newS.rounds[rIdx].matches[mIdx].team2Score = 0;
                                  setSession(newS);
                              }} className="text-[8px] text-red-500 font-black mt-1 uppercase font-black font-black font-black">Reset</button>
                              <div className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter mt-1 font-black font-black">Verschil: {Math.abs(avg1 - avg2).toFixed(2)}</div>
                            </div>
                          </div>
                          <div className="flex-1 space-y-1 text-right text-white font-black font-black font-black">
                            <div className="text-[9px] text-amber-400 font-black uppercase mb-2 tracking-widest text-white font-black font-black">{(match as any).team2Name || 'Team Geel'}</div>
                            {match.team2.map(p => {
                                const rColor = ratingColors.get(p.rating);
                                return (
                                    <div key={p.id} className={`text-sm uppercase font-bold border-r-2 pr-2 ${playerSource === 'intro' ? (rColor?.border || 'border-transparent') : 'border-transparent'} transition-all ${isHighlighted(p.name) ? 'bg-green-500 text-white px-1 rounded-sm scale-105 shadow-md' : ''}`}>
                                        {p.name}
                                    </div>
                                );
                            })}
                            <div className="text-[9px] text-gray-500 mt-2 font-black font-black font-black font-black">GEM: {avg2.toFixed(2)}</div>
                          </div>
                        </div>
                        {!isFixed && (
                            <div className="p-2.5 bg-gray-900/30 border-t border-gray-700 flex justify-center gap-8 text-[9px] font-black uppercase text-white font-black font-black font-black">
                            <span className={`px-2 rounded transition-all border-l-2 ${playerSource === 'intro' ? (ratingColors.get(match.subHigh?.rating)?.border || 'border-transparent') : 'border-transparent'} ${isHighlighted(match.subHigh?.name || '') ? 'bg-green-500 text-white font-black' : 'text-pink-400/70'}`}>Res 1: {match.subHigh?.name}</span>
                            <span className={`px-2 rounded transition-all border-l-2 ${playerSource === 'intro' ? (ratingColors.get(match.subLow?.rating)?.border || 'border-transparent') : 'border-transparent'} ${isHighlighted(match.subLow?.name || '') ? 'bg-green-500 text-white font-black' : 'text-pink-400/70'}`}>Res 2: {match.subLow?.name}</span>
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden text-white animate-fade-in font-black text-center font-black">
            <table className="w-full text-left font-black text-white uppercase font-black font-black">
              <thead className="bg-gray-900 text-gray-400 text-[10px] font-black tracking-widest uppercase font-black font-black font-black">
                <tr><th className="p-5 w-12 text-center text-white font-black uppercase">#</th><th className="p-5 text-white font-black uppercase text-left">{(session as any).isFixedTeams ? 'Team' : 'Speler'}</th><th className="p-5 text-center text-white font-black uppercase font-black">W</th><th className="p-5 text-center text-white font-black uppercase font-black">DS</th><th className="p-5 text-center text-white font-black uppercase font-black">PTN</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50 uppercase text-white font-black font-black">
                {currentStandings.map((entry, idx) => (
                  <tr key={idx} className={`transition-colors ${idx < 3 ? 'bg-amber-500/5' : 'hover:bg-gray-700/30'} text-white font-black font-black`}>
                    <td className="p-5 text-center font-black text-amber-500 uppercase font-black font-black">{idx + 1}</td>
                    <td className="p-5 font-bold text-sm tracking-tight text-white font-black uppercase text-left font-black">{(entry as any).name || (entry as any).playerName}</td>
                    <td className="p-5 text-center text-gray-400 font-mono text-xs text-white font-black uppercase font-black">
                      {(entry as any).matchesPlayed}
                    </td>
                    <td className={`p-5 text-center font-black font-mono text-xs ${entry.goalDifference > 0 ? 'text-green-500' : entry.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                    <td className="p-5 text-center font-black font-black"><span className="bg-gray-900 text-amber-400 px-4 py-1.5 rounded-full font-black text-sm shadow-inner border border-amber-500/20 font-black">{entry.points}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4 animate-fade-in text-white no-print font-black font-black font-black font-black font-black font-black">
            <input type="text" placeholder="Duo's filteren..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 text-sm outline-none focus:border-amber-500 transition-all text-white font-black uppercase font-black font-black font-black" />
            <div className="bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden max-h-[600px] overflow-y-auto uppercase custom-scrollbar text-white text-center font-black font-black font-black">
              <table className="w-full text-left text-white font-black uppercase text-center font-black font-black font-black font-black">
                <thead className="bg-gray-900 text-gray-400 text-[10px] uppercase font-black sticky top-0 z-20 text-white font-black uppercase font-black font-black font-black font-black font-black">
                  <tr><th className="p-5 text-white font-black uppercase text-left">Duo</th><th className="p-5 text-center text-white font-black uppercase font-black">Samen</th><th className="p-5 text-center text-white font-black uppercase font-black">Tegen</th><th className="p-5 text-center text-white font-black uppercase font-black">Totaal</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50 text-white font-black uppercase font-black font-black font-black font-black font-black">
                  {coOpData.filter(d => d.p1.toLowerCase().includes(searchTerm.toLowerCase()) || d.p2.toLowerCase().includes(searchTerm.toLowerCase())).map((pair, i) => {
                    const total = pair.together + pair.against;
                    let totalColor = "bg-green-500 text-white"; 
                    if (total === 0) totalColor = "bg-transparent text-gray-600";
                    else if (total === totalRankings.highest) totalColor = "bg-red-500 text-white shadow-lg";
                    else if (total === totalRankings.second) totalColor = "bg-orange-500 text-white";
                    else if (total === totalRankings.third) totalColor = "bg-yellow-500 text-black font-black";
                    else if (total === totalRankings.fourth) totalColor = "bg-yellow-200 text-black font-bold";
                    return (
                      <tr key={i} className="hover:bg-gray-700/20 transition-colors text-white font-black uppercase font-black font-black font-black font-black font-black">
                        <td className="p-5 text-xs font-bold tracking-tight text-left uppercase text-white font-black font-black">{pair.p1} + {pair.p2}</td>
                        <td className="p-5 text-center text-xs text-gray-400 font-mono text-white font-black uppercase font-black font-black font-black">{pair.together}x</td>
                        <td className="p-5 text-center text-xs text-gray-400 font-mono text-white font-black uppercase font-black font-black font-black">{pair.against}x</td>
                        <td className="p-5 text-center font-black font-black font-black font-black font-black font-black font-black"><span className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${totalColor}`}>{total}x</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {session && (
        <NKPrintViews 
          session={session} 
          activePrintType={activePrintType} 
          hallNames={hallNames} 
          playerSchedules={playerSchedules} 
        />
      )}
    </div>
  );
};

export default NKManager;
