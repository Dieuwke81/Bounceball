import React, { useState, useEffect, useMemo } from 'react';
import { Player, NKSession, NKStandingsEntry } from '../types';
import { generateNKSchedule } from '../services/nkGenerator';
import TrophyIcon from './icons/TrophyIcon';
import FutbolIcon from './icons/FutbolIcon';

interface NKManagerProps {
  players: Player[];
  onClose: () => void;
}

const NKManager: React.FC<NKManagerProps> = ({ players }) => {
  const [session, setSession] = useState<NKSession | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'analysis'>('schedule');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  /* =====================
     SETUP STATE
  ===================== */

  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);

  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');

  /* =====================
     HALL NAMING
  ===================== */

  useEffect(() => {
    setHallNames(prev => {
      const next = [...prev];
      while (next.length < hallsCount) {
        next.push(String.fromCharCode(65 + next.length));
      }
      return next.slice(0, hallsCount);
    });
  }, [hallsCount]);

  /* =====================
     LOCAL STORAGE
  ===================== */

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        localStorage.removeItem('bounceball_nk_session');
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
    }
  }, [session]);

  /* =====================
     ATTENDANCE PARSER
  ===================== */

  const handleParseAttendance = () => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const map = new Map<string, Player>();
    players.forEach(p => {
      map.set(normalize(p.name), p);
      map.set(normalize(p.name.split(' ')[0]), p);
    });

    const ids = new Set<number>();
    attendanceText.split('\n').forEach(line => {
      const clean = line.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-–]/)[0].trim();
      const match = map.get(normalize(clean));
      if (match) ids.add(match.id);
    });

    setSelectedPlayerIds(ids);
    setAttendanceText('');
    alert(`${ids.size} spelers geselecteerd`);
  };

  /* =====================
     MOGELIJKHEDEN
  ===================== */

  const possibilities = useMemo(() => {
    const options: { playerCount: number; hallsToUse: number; totalRounds: number }[] = [];
    const playersPerMatch = playersPerTeam * 2;

    for (let p = playersPerMatch; p <= players.length; p++) {
      const totalMatches = (p * matchesPerPlayer) / playersPerMatch;
      if (!Number.isInteger(totalMatches)) continue;

      const halls = Math.min(hallsCount, Math.floor(p / playersPerMatch));
      if (halls === 0) continue;

      options.push({
        playerCount: p,
        hallsToUse: halls,
        totalRounds: Math.ceil(totalMatches / halls)
      });
    }
    return options;
  }, [players.length, playersPerTeam, matchesPerPlayer, hallsCount]);

  /* =====================
     START NK
  ===================== */

  const handleStartTournament = async () => {
    if (!targetPlayerCount) return;

    if (selectedPlayerIds.size !== targetPlayerCount) {
      alert(`Selecteer exact ${targetPlayerCount} spelers.`);
      return;
    }

    const option = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!option) return;

    setIsGenerating(true);
    setProgressMsg('Starten...');

    try {
      const participants = players.filter(p => selectedPlayerIds.has(p.id));

      const newSession = await generateNKSchedule(
        participants,
        hallNames.slice(0, option.hallsToUse),
        matchesPerPlayer,
        playersPerTeam,
        'NK Schema',
        msg => setProgressMsg(msg)
      );

      setSession(newSession);
    } catch (e: any) {
      alert(e.message || 'Fout bij genereren');
    } finally {
      setIsGenerating(false);
    }
  };

  /* =====================
     STANDEN
  ===================== */

  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const map = new Map<number, NKStandingsEntry>();

    s.standings.forEach(e =>
      map.set(e.playerId, {
        ...e,
        points: 0,
        goalsFor: 0,
        goalDifference: 0,
        matchesPlayed: 0
      })
    );

    s.rounds.forEach(r =>
      r.matches.forEach(m => {
        if (!m.isPlayed) return;

        const p1 = m.team1Score > m.team2Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;
        const p2 = m.team2Score > m.team1Score ? 3 : m.team1Score === m.team2Score ? 1 : 0;

        m.team1.forEach(p => {
          const st = map.get(p.id)!;
          st.matchesPlayed++;
          st.points += p1;
          st.goalsFor += m.team1Score;
          st.goalDifference += m.team1Score - m.team2Score;
        });

        m.team2.forEach(p => {
          const st = map.get(p.id)!;
          st.matchesPlayed++;
          st.points += p2;
          st.goalsFor += m.team2Score;
          st.goalDifference += m.team2Score - m.team1Score;
        });
      })
    );

    return Array.from(map.values()).sort(
      (a, b) => b.points - a.points || b.goalDifference - a.goalDifference
    );
  };

  const updateScore = (r: number, m: number, team: 1 | 2, score: number) => {
    if (!session) return;
    const copy = structuredClone(session);
    const match = copy.rounds[r].matches[m];

    team === 1 ? (match.team1Score = score) : (match.team2Score = score);
    match.isPlayed = true;

    copy.standings = calculateStandings(copy);
    setSession(copy);
  };

  const togglePlayed = (r: number, m: number) => {
    if (!session) return;
    const copy = structuredClone(session);
    copy.rounds[r].matches[m].isPlayed = !copy.rounds[r].matches[m].isPlayed;
    copy.standings = calculateStandings(copy);
    setSession(copy);
  };

  /* =====================
     RENDER
  ===================== */

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
        <FutbolIcon className="w-20 h-20 text-amber-500 animate-bounce mb-6" />
        <h2 className="text-3xl font-black italic uppercase">NK Planner bezig...</h2>
        <div className="mt-4 bg-gray-900 border border-amber-500/30 px-6 py-3 rounded-2xl shadow-xl text-amber-500 font-mono text-sm">
          {progressMsg}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="bg-gray-800 rounded-3xl p-8 border border-amber-500/30 shadow-2xl">
          <h2 className="text-3xl font-black text-white uppercase italic mb-6">NK Setup</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <label className="text-xs text-gray-400">Zalen</label>
              <input type="number" value={hallsCount} onChange={e => setHallsCount(+e.target.value)} />

              <label className="text-xs text-gray-400">Wedstrijden per speler</label>
              <input
                type="number"
                value={matchesPerPlayer}
                onChange={e => setMatchesPerPlayer(+e.target.value)}
              />

              <div className="flex gap-2">
                {[4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setPlayersPerTeam(n)}
                    className={playersPerTeam === n ? 'bg-amber-500' : 'bg-gray-700'}
                  >
                    {n} vs {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-white font-bold mb-2">Geldige opties</h3>
              {possibilities.map(p => (
                <button
                  key={p.playerCount}
                  onClick={() => {
                    setTargetPlayerCount(p.playerCount);
                    setSelectedPlayerIds(new Set());
                  }}
                >
                  {p.playerCount} spelers → {p.totalRounds} rondes
                </button>
              ))}
            </div>
          </div>

          {targetPlayerCount && (
            <>
              <textarea
                value={attendanceText}
                onChange={e => setAttendanceText(e.target.value)}
                placeholder="Plak aanwezigheidslijst"
              />
              <button onClick={handleParseAttendance}>Verwerk lijst</button>

              <div className="grid grid-cols-4 gap-2">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const s = new Set(selectedPlayerIds);
                      s.has(p.id) ? s.delete(p.id) : s.size < targetPlayerCount && s.add(p.id);
                      setSelectedPlayerIds(s);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {selectedPlayerIds.size === targetPlayerCount && (
                <button onClick={handleStartTournament}>Genereer NK</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <button
        onClick={() => {
          if (confirm('NK wissen?')) {
            localStorage.removeItem('bounceball_nk_session');
            setSession(null);
          }
        }}
      >
        Reset
      </button>

      {session.rounds.map((r, ri) => (
        <div key={ri}>
          <h3>Ronde {r.roundNumber}</h3>
          {r.matches.map((m, mi) => (
            <div key={m.id}>
              <strong>Zaal {m.hallName}</strong>
              <div>
                {m.team1.map(p => p.name).join(', ')} vs{' '}
                {m.team2.map(p => p.name).join(', ')}
              </div>
              <input
                type="number"
                value={m.team1Score}
                onChange={e => updateScore(ri, mi, 1, +e.target.value)}
              />
              <input
                type="number"
                value={m.team2Score}
                onChange={e => updateScore(ri, mi, 2, +e.target.value)}
              />
              <button onClick={() => togglePlayed(ri, mi)}>Gespeeld</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default NKManager;
