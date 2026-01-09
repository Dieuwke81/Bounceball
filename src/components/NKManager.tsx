import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry, NKMatch } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players, onClose }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [availableHalls, setAvailableHalls] = useState(3); 
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
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
    const minRolesPerHall = 3;

    for (let n = playersPerMatch; n <= 100; n++) {
      const totalSpots = n * matchesPerPlayer;
      // Wiskundige eis 1: Matches moeten een heel getal zijn
      if (totalSpots % playersPerMatch === 0) {
        const totalMatches = totalSpots / playersPerMatch;
        
        // Wiskundige eis 2: Hoeveel zalen kunnen we ELKE ronde vullen?
        // Je hebt 'n' mensen. Een volle ronde met 'h' zalen kost h * (spelers + 3 rollen).
        const maxHallsPossible = Math.floor(n / (playersPerMatch + minRolesPerHall));
        const actualHallsToUse = Math.min(availableHalls, maxHallsPossible);

        if (actualHallsToUse > 0) {
          const totalRounds = Math.ceil(totalMatches / actualHallsToUse);
          const fullRounds = Math.floor(totalMatches / actualHallsToUse);
          const lastRoundMatches = totalMatches % actualHallsToUse;

          // We tonen alleen opties waar de zalen bijna altijd vol zijn (max 1 ronde niet vol)
          options.push({
            playerCount: n,
            hallsToUse: actualHallsToUse,
            totalRounds: totalRounds,
            isPerfect: lastRoundMatches === 0
          });
        }
      }
    }
    return options;
  }, [availableHalls, matchesPerPlayer, playersPerTeam]);

  const handleStartTournament = () => {
    const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!chosen) return;
    const participants = players.filter(p => selectedPlayerIds.has(p.id));
    const newSession = generateNKSchedule(participants, chosen.hallsToUse, matchesPerPlayer, playersPerTeam, "NK Schema");
    setSession(newSession);
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

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <TrophyIcon className="w-10 h-10 text-amber-500" />
            <h2 className="text-3xl font-black text-white uppercase italic">NK Calculator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
               <div className="space-y-4">
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Zalen Beschikbaar</span>
                    <input type="number" value={availableHalls} onChange={(e) => setAvailableHalls(Number(e.target.value))} className="mt-1 block w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold focus:ring-2 ring-amber-500 outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Wedstrijden p.p.</span>
                    <input type="number" value={matchesPerPlayer} onChange={(e) => setMatchesPerPlayer(Number(e.target.value))} className="mt-1 block w-full bg-gray-800 border-gray-700 rounded-xl text-white p-3 font-bold focus:ring-2 ring-amber-500 outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Team Grootte</span>
                    <div className="flex gap-2 mt-1">
                      {[4, 5].map(n => (
                        <button key={n} onClick={() => setPlayersPerTeam(n)} className={`flex-1 py-3 rounded-xl font-black transition-all border-2 ${playersPerTeam === n ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{n} vs {n}</button>
                      ))}
                    </div>
                  </label>
               </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
               <h3 className="text-white font-bold text-sm uppercase tracking-widest">Geldige opties voor volle zalen:</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {possibilities.map(opt => (
                    <button 
                      key={opt.playerCount}
                      onClick={() => {setTargetPlayerCount(opt.playerCount); setSelectedPlayerIds(new Set());}}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${targetPlayerCount === opt.playerCount ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-2xl font-black text-white">{opt.playerCount} Spelers</span>
                        {opt.isPerfect && <span className="text-[8px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Perfect</span>}
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">Geeft schema voor **{opt.hallsToUse} zalen** ({opt.totalRounds} rondes).</p>
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {targetPlayerCount && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Selecteer {targetPlayerCount} Deelnemers</h3>
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
                    if (next.has(p.id)) next.delete(p.id); 
                    else if (next.size < targetPlayerCount!) next.add(p.id);
                    setSelectedPlayerIds(next);
                  }} className={`p-3 rounded-xl text-xs font-bold border transition-all ${selectedPlayerIds.has(p.id) ? 'bg-amber-500 border-amber-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{p.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard blijft functioneel gelijk aan de eerdere goede versie
  return (
     /* ... Dashboard code ... */
  );
};

export default NKManager;
