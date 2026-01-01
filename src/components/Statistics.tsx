
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

import StatsPrintView from './StatsPrintView';

interface StatisticsProps {
  history: GameSession[];
  players: Player[];
  onSelectPlayer: (playerId: number) => void;
}

type PrintType = 'points' | 'goals' | 'defense' | 'attendance';

const Statistics: React.FC<StatisticsProps> = ({ history, players, onSelectPlayer }) => {
  const [showAll, setShowAll] = useState({
    attendance: false,
    scorers: false,
    points: false,
    defense: false,
  });

  const [showIneligible, setShowIneligible] = useState(false);
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

  const [printType, setPrintType] = useState<PrintType | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const getTeamsR1 = (s: GameSession) => s.teams || [];
  const getTeamsR2 = (s: GameSession) => (s as any).round2Teams ?? s.teams ?? [];

  const teamGoals = (goals: any[]) => (goals || []).reduce((sum, g) => sum + (g?.count || 0), 0);
  const safeTeam = (teams: Player[][], idx: number) =>
    Array.isArray(teams) && teams[idx] ? teams[idx] : [];

  /* =========================
     AANWEZIGHEID
     ========================= */
  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const map = new Map<number, number>();
    const sessions = history.length;

    history.forEach((s) => {
      const ids = new Set<number>();
      getTeamsR1(s).flat().forEach((p) => ids.add(p.id));
      getTeamsR2(s).flat().forEach((p) => ids.add(p.id));
      ids.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });

    return {
      playerGames: map,
      totalSessions: sessions,
      minGames: Math.max(1, Math.round(sessions / 2)),
    };
  }, [history]);

  /* =========================
     WEDSTRIJDEN PER SPELER
     ========================= */
  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();

    history.forEach((s) => {
      getTeamsR1(s).forEach((team, i) =>
        (s.round1Results || []).forEach((m) => {
          if (m.team1Index === i || m.team2Index === i) {
            team.forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
          }
        })
      );
      getTeamsR2(s).forEach((team, i) =>
        (s.round2Results || []).forEach((m) => {
          if (m.team1Index === i || m.team2Index === i) {
            team.forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
          }
        })
      );
    });

    return map;
  }, [history]);

  /* =========================
     TOPSCOORDERS
     ========================= */
  const topScorers = useMemo(() => {
    const goals = new Map<number, number>();

    history.forEach((s) =>
      [...(s.round1Results || []), ...(s.round2Results || [])].forEach((m) =>
        [...(m.team1Goals || []), ...(m.team2Goals || [])].forEach((g) =>
          goals.set(g.playerId, (goals.get(g.playerId) || 0) + (g.count || 0))
        )
      )
    );

    return Array.from(playerMatches.entries())
      .map(([id, games]) => ({
        playerId: id,
        goals: goals.get(id) || 0,
        games,
        avg: games > 0 ? (goals.get(id) || 0) / games : 0,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => b.avg - a.avg || b.goals - a.goals);
  }, [history, playerMatches, playerGames, minGames]);

  /* =========================
     COMPETITIE
     ========================= */
  const competitionPoints = useMemo(() => {
    const pts = new Map<number, number>();
    const gf = new Map<number, number>();
    const gd = new Map<number, number>();

    const addMatch = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
      if (!t1.length || !t2.length) return;

      const s1 = teamGoals(m.team1Goals);
      const s2 = teamGoals(m.team2Goals);

      t1.forEach((p) => {
        gf.set(p.id, (gf.get(p.id) || 0) + s1);
        gd.set(p.id, (gd.get(p.id) || 0) + (s1 - s2));
      });
      t2.forEach((p) => {
        gf.set(p.id, (gf.get(p.id) || 0) + s2);
        gd.set(p.id, (gd.get(p.id) || 0) + (s2 - s1));
      });

      if (s1 > s2) t1.forEach((p) => pts.set(p.id, (pts.get(p.id) || 0) + 3));
      else if (s2 > s1) t2.forEach((p) => pts.set(p.id, (pts.get(p.id) || 0) + 3));
      else [...t1, ...t2].forEach((p) => pts.set(p.id, (pts.get(p.id) || 0) + 1));
    };

    history.forEach((s) => {
      (s.round1Results || []).forEach((m) => addMatch(getTeamsR1(s), m));
      (s.round2Results || []).forEach((m) => addMatch(getTeamsR2(s), m));
    });

    return Array.from(playerMatches.entries())
      .map(([id, games]) => ({
        playerId: id,
        points: pts.get(id) || 0,
        games,
        avg: games > 0 ? (pts.get(id) || 0) / games : 0,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [history, playerMatches, playerGames, minGames]);

  /* =========================
     BESTE VERDEDIGER
     ========================= */
  const bestDefense = useMemo(() => {
    const against = new Map<number, number>();

    const add = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
      if (!t1.length || !t2.length) return;
      const s1 = teamGoals(m.team1Goals);
      const s2 = teamGoals(m.team2Goals);
      t1.forEach((p) => against.set(p.id, (against.get(p.id) || 0) + s2));
      t2.forEach((p) => against.set(p.id, (against.get(p.id) || 0) + s1));
    };

    history.forEach((s) => {
      (s.round1Results || []).forEach((m) => add(getTeamsR1(s), m));
      (s.round2Results || []).forEach((m) => add(getTeamsR2(s), m));
    });

    return Array.from(playerMatches.entries())
      .map(([id, games]) => ({
        playerId: id,
        avg: games > 0 ? (against.get(id) || 0) / games : 0,
        games,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => a.avg - b.avg);
  }, [history, playerMatches, playerGames, minGames]);

  const bestDefenseForDisplay = defenseKeepersOnly
    ? bestDefense.filter((p) => playerMap.get(p.playerId)?.isKeeper)
    : bestDefense;

  /* =========================
     PRINT DATA
     ========================= */
  const printCompetitionData = competitionPoints.map((p) => ({
    playerName: playerMap.get(p.playerId)?.name || '',
    points: p.points,
    games: p.games,
    avg: p.avg,
  }));

  const printScorersData = topScorers.map((p) => ({
    playerName: playerMap.get(p.playerId)?.name || '',
    goals: p.goals,
    games: p.games,
    avg: p.avg,
  }));

  const printDefenseData = bestDefenseForDisplay.map((p) => ({
    playerName: playerMap.get(p.playerId)?.name || '',
    games: p.games,
    avg: p.avg,
  }));

  const printAttendanceData = Array.from(playerGames.entries()).map(([id, count]) => ({
    playerName: playerMap.get(id)?.name || '',
    count,
    percentage: totalSessions ? (count / totalSessions) * 100 : 0,
  }));

  /* =========================
     RENDER
     ========================= */
  return (
    <>
      {/* PRINT PORTAL */}
      {printType === 'points' && (
        <StatsPrintView
          title="Competitie Stand"
          type="points"
          data={printCompetitionData}
          onClose={() => setPrintType(null)}
        />
      )}
      {printType === 'goals' && (
        <StatsPrintView
          title="Topscoorders"
          type="goals"
          data={printScorersData}
          onClose={() => setPrintType(null)}
        />
      )}
      {printType === 'defense' && (
        <StatsPrintView
          title="Beste Verdediger"
          type="defense"
          data={printDefenseData}
          onClose={() => setPrintType(null)}
        />
      )}
      {printType === 'attendance' && (
        <StatsPrintView
          title="Meest Aanwezig"
          type="attendance"
          data={printAttendanceData}
          onClose={() => setPrintType(null)}
        />
      )}
    </>
  );
};

export default Statistics;
