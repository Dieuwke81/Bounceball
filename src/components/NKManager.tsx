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

  // Setup
  const [hallsCount, setHallsCount] = useState(3);
  const [hallNames, setHallNames] = useState<string[]>(['A', 'B', 'C']);
  const [matchesPerPlayer, setMatchesPerPlayer] = useState(8);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [targetPlayerCount, setTargetPlayerCount] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [attendanceText, setAttendanceText] = useState('');

  /* =========================
     HALL NAMES
  ========================= */
  useEffect(() => {
    const names = [...hallNames];
    if (hallsCount > names.length) {
      for (let i = names.length; i < hallsCount; i++) {
        names.push(String.fromCharCode(65 + i));
      }
    } else {
      names.splice(hallsCount);
    }
    setHallNames(names);
  }, [hallsCount]);

  /* =========================
     LOCAL STORAGE
  ========================= */
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

  const isHighlighted = (name: string) =>
    highlightName && name.toLowerCase() === highlightName.toLowerCase();

  /* =========================
     ATTENDANCE PARSER
  ========================= */
  const handleParseAttendance = () => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const lookup = new Map<string, Player>();
    players.forEach(p => {
      lookup.set(normalize(p.name), p);
      lookup.set(normalize(p.name.split(' ')[0]), p);
    });

    const ids = new Set<number>();
    attendanceText.split('\n').forEach(line => {
      const cleaned = line.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-–]/)[0].trim();
      const match = lookup.get(normalize(cleaned));
      if (match) ids.add(match.id);
    });

    setSelectedPlayerIds(ids);
    setAttendanceText('');
    alert(`${ids.size} spelers geselecteerd.`);
  };

  /* =========================
     GELDIGE OPTIES (FIX)
  ========================= */
  const possibilities = useMemo(() => {
    const options: {
      playerCount: number;
      hallsToUse: number;
      totalRounds: number;
    }[] = [];

    const playersPerMatch = playersPerTeam * 2;

    for (let n = playersPerMatch; n <= players.length; n++) {
      const totalSpots = n * matchesPerPlayer;
      if (totalSpots % playersPerMatch !== 0) continue;

      const totalMatches = totalSpots / playersPerMatch;

      for (let halls = 1; halls <= hallsCount; halls++) {
        if (totalMatches % halls !== 0) continue;

        const rounds = totalMatches / halls;
        if (rounds < 1 || rounds > 30) continue;

        options.push({
          playerCount: n,
          hallsToUse: halls,
          totalRounds: rounds
        });
      }
    }

    return options.sort(
      (a, b) =>
        a.playerCount - b.playerCount ||
        a.totalRounds - b.totalRounds
    );
  }, [players.length, hallsCount, matchesPerPlayer, playersPerTeam]);

  /* =========================
     START NK
  ========================= */
  const handleStartTournament = async () => {
    const chosen = possibilities.find(p => p.playerCount === targetPlayerCount);
    if (!chosen) return;

    if (selectedPlayerIds.size !== targetPlayerCount) {
      alert(`Selecteer exact ${targetPlayerCount} spelers.`);
      return;
    }

    setIsGenerating(true);
    setProgressMsg('Starten...');

    try {
      const participants = players.filter(p => selectedPlayerIds.has(p.id));
      const newSession = await generateNKSchedule(
        participants,
        hallNames.slice(0, chosen.hallsToUse),
        matchesPerPlayer,
        playersPerTeam,
        'NK Schema',
        msg => setProgressMsg(msg)
      );
      setSession(newSession);
    } catch (e) {
      console.error(e);
      alert('Fout bij berekenen.');
    } finally {
      setIsGenerating(false);
    }
  };

  /* =========================
     STANDEN
  ========================= */
  const calculateStandings = (s: NKSession): NKStandingsEntry[] => {
    const map = new Map<number, NKStandingsEntry>();

    s.standings.forEach(e =>
      map.set(e.playerId, {
        ...e,
        points: 0,
        goalDifference: 0,
        goalsFor: 0,
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

  /* =========================
     RENDER
  ========================= */
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

  /* === rest van render blijft exact zoals jij had === */
  return session ? (
    <div className="space-y-6 pb-20"> {/* ongewijzigd */}</div>
  ) : (
    <div className="max-w-5xl mx-auto space-y-6 pb-20"> {/* ongewijzigd */}</div>
  );
};

export default NKManager;
