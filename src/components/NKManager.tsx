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
      for (let i = names.length; i < hallsCount; i++) {
        names.push(String.fromCharCode(65 + i));
      }
    } else {
      names.splice(hallsCount);
    }
    setHallNames(names);
  }, [hallsCount]);

  useEffect(() => {
    const saved = localStorage.getItem('bounceball_nk_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('bounceball_nk_session', JSON.stringify(session));
    }
  }, [session]);

  const isHighlighted = (name: string) =>
    highlightName && name.toLowerCase() === highlightName.toLowerCase();

  // --- ATTENDANCE PARSER ---
  const handleParseAttendance = () => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const lookup = new Map<string, Player>();
    players.forEach(p => {
      lookup.set(normalize(p.name), p);
      lookup.set(normalize(p.name.split(' ')[0]), p);
    });

    const selected = new Set<number>();
    attendanceText.split('\n').forEach(line => {
      const cleaned = line.replace(/^\s*\d+[\.\)]?\s*/, '').split(/[:\-–]/)[0];
      const found = lookup.get(normalize(cleaned));
      if (found) selected.add(found.id);
    });

    setSelectedPlayerIds(selected);
    setAttendanceText('');
    alert(`${selected.size} spelers geselecteerd.`);
  };

  // --- CALCULATOR (GEFIXT, UI ONAANGEROERD) ---
  const possibilities = useMemo(() => {
    const options: { playerCount: number; hallsToUse: number; totalRounds: number }[] = [];
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

  // --- ANALYSE ---
  const coOpData = useMemo(() => {
    if (!session) return [];
    const pairCounts = new Map<string, { together: number; against: number }>();
    const participants = players.filter(p => session.standings.some(s => s.playerId === p.id));

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const key = [participants[i].id, participants[j].id].sort().join('-');
        pairCounts.set(key, { together: 0, against: 0 });
      }
    }

    session.rounds.forEach(r =>
      r.matches.forEach(m => {
        const countTogether = (team: Player[]) => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const key = [team[i].id, team[j].id].sort().join('-');
              pairCounts.get(key)!.together++;
            }
          }
        };
        countTogether(m.team1);
        countTogether(m.team2);
        m.team1.forEach(p1 =>
          m.team2.forEach(p2 => {
            const key = [p1.id, p2.id].sort().join('-');
            pairCounts.get(key)!.against++;
          })
        );
      })
    );

    return Array.from(pairCounts.entries()).map(([key, v]) => {
      const [a, b] = key.split('-').map(Number);
      return {
        p1: players.find(p => p.id === a)?.name || '?',
        p2: players.find(p => p.id === b)?.name || '?',
        together: v.together,
        against: v.against
      };
    });
  }, [session, players]);

  // --- ACTIES ---
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
        setProgressMsg
      );
      setSession(newSession);
    } finally {
      setIsGenerating(false);
    }
  };

  // === RENDER ===
  // (vanaf hier is alles 100% jouw originele UI)

  // ⬇️⬇️⬇️
  // ⬇️⬇️⬇️
  // ⬇️⬇️⬇️

  /* REST VAN JE RENDER IS ONGEWIJZIGD */
  /* — exact zoals jij hem stuurde — */

  return null; // ← dit bestaat in jouw echte file NIET, hier alleen om TS tevreden te houden
};

export default NKManager;
