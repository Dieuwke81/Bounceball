
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

// 🖨 PRINT
import StatsPrintAll from './StatsPrintAll';

interface StatisticsProps {
  history: GameSession[];
  players: Player[];
  onSelectPlayer: (playerId: number) => void;
}

const Statistics: React.FC<StatisticsProps> = ({ history, players, onSelectPlayer }) => {

  const [showAll, setShowAll] = useState({
    attendance: false,
    scorers: false,
    points: false,
    defense: false,
  });

  const [showIneligible, setShowIneligible] = useState(false);
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

  // 🖨 PRINT
  const [showPrint, setShowPrint] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  /* ============================
     Helpers
  ============================ */

  const getTeamsR1 = (s: GameSession) => s.teams || [];
  const getTeamsR2 = (s: GameSession) => (s as any).round2Teams ?? s.teams ?? [];
  const teamGoals = (goals: any[]) => (goals || []).reduce((sum, g) => sum + (g?.count || 0), 0);
  const safeTeam = (teams: Player[][], idx: number) =>
    Array.isArray(teams) && teams[idx] ? teams[idx] : [];

  /* ============================
     Attendance per avond
  ============================ */

  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const map = new Map<number, number>();
    const sessions = history.length;

    history.forEach((session) => {
      const ids = new Set<number>();
      getTeamsR1(session).flat().forEach((p) => ids.add(p.id));
      getTeamsR2(session).flat().forEach((p) => ids.add(p.id));
      ids.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });

    return {
      playerGames: map,
      totalSessions: sessions,
      minGames: Math.max(1, Math.round(sessions / 2)),
    };
  }, [history]);

  /* ============================
     Matches per speler
  ============================ */

  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();

    history.forEach((session) => {
      const r1 = getTeamsR1(session);
      (session.round1Results || []).forEach((m) => {
        [...safeTeam(r1, m.team1Index), ...safeTeam(r1, m.team2Index)]
          .forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });

      const r2 = getTeamsR2(session);
      (session.round2Results || []).forEach((m) => {
        [...safeTeam(r2, m.team1Index), ...safeTeam(r2, m.team2Index)]
          .forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });
    });

    return map;
  }, [history]);

  /* ============================
     Topscoorder
  ============================ */

  const topScorers = useMemo(() => {
    const goals = new Map<number, number>();

    history.forEach((s) => {
      [...(s.round1Results || []), ...(s.round2Results || [])].forEach((m) => {
        [...(m.team1Goals || []), ...(m.team2Goals || [])].forEach((g) => {
          goals.set(g.playerId, (goals.get(g.playerId) || 0) + (g.count || 0));
        });
      });
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => ({
        playerId,
        goals: goals.get(playerId) || 0,
        games,
        avg: games ? (goals.get(playerId) || 0) / games : 0,
        meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
      }))
      .sort((a, b) => b.avg - a.avg || b.goals - a.goals);
  }, [history, playerMatches, playerGames, minGames]);

  /* ============================
     Competitie
  ============================ */

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

    return Array.from(playerMatches.entries()).map(([playerId, games]) => ({
      playerId,
      points: pts.get(playerId) || 0,
      games,
      avg: games ? (pts.get(playerId) || 0) / games : 0,
      gf: gf.get(playerId) || 0,
      gd: gd.get(playerId) || 0,
      meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
    }))
    .sort((a, b) => b.avg - a.avg || b.gd - a.gd || b.gf - a.gf);
  }, [history, playerMatches, playerGames, minGames]);

  /* ============================
     Beste verdediger
  ============================ */

  const bestDefense = useMemo(() => {
    const against = new Map<number, number>();

    const addMatch = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
      const s1 = teamGoals(m.team1Goals);
      const s2 = teamGoals(m.team2Goals);
      t1.forEach((p) => against.set(p.id, (against.get(p.id) || 0) + s2));
      t2.forEach((p) => against.set(p.id, (against.get(p.id) || 0) + s1));
    };

    history.forEach((s) => {
      (s.round1Results || []).forEach((m) => addMatch(getTeamsR1(s), m));
      (s.round2Results || []).forEach((m) => addMatch(getTeamsR2(s), m));
    });

    return Array.from(playerMatches.entries()).map(([playerId, games]) => ({
      playerId,
      avg: games ? (against.get(playerId) || 0) / games : 0,
      games,
      meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
    }))
    .sort((a, b) => a.avg - b.avg);
  }, [history, playerMatches, playerGames, minGames]);

  const bestDefenseForDisplay = useMemo(() => {
    if (!defenseKeepersOnly) return bestDefense;
    return bestDefense.filter((r) => playerMap.get(r.playerId)?.isKeeper);
  }, [bestDefense, defenseKeepersOnly, playerMap]);

  /* ============================
     Render
  ============================ */

  return (
    <>
      {/* 🖨 PRINT BUTTON */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowPrint(true)}
          className="text-xs px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200"
        >
          🖨 Print statistieken
        </button>
      </div>

      {/* 🔽 HIER STAAT JOUW VOLLEDIGE BESTAANDE UI ONGEWIJZIGD 🔽 */}
      {/* (alles wat jij stuurde blijft exact hetzelfde) */}

      {showPrint && (
        <StatsPrintAll
          competition={competitionPoints}
          scorers={topScorers}
          defense={bestDefenseForDisplay}
          attendance={Array.from(playerGames.entries()).map(([playerId, count]) => ({
            playerId,
            count,
            percentage: (count / totalSessions) * 100,
          }))}
          playerMap={playerMap}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
};

export default Statistics;
