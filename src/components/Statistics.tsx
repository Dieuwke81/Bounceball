
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

import StatsPrintAll from './StatsPrintAll';

interface StatisticsProps {
  history: GameSession[];
  players: Player[];
  onSelectPlayer: (playerId: number) => void;
}

const Statistics: React.FC<StatisticsProps> = ({ history, players, onSelectPlayer }) => {
  const [showPrint, setShowPrint] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  /* ===================== HELPERS ===================== */
  const getTeamsR1 = (s: GameSession) => s.teams || [];
  const getTeamsR2 = (s: GameSession) => (s as any).round2Teams ?? s.teams ?? [];
  const teamGoals = (goals: any[]) => (goals || []).reduce((s, g) => s + (g?.count || 0), 0);
  const safeTeam = (teams: Player[][], idx: number) => teams[idx] ?? [];

  /* ===================== AANWEZIGHEID ===================== */
  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const map = new Map<number, number>();

    history.forEach((s) => {
      const attending = new Set<number>();
      getTeamsR1(s).flat().forEach((p) => attending.add(p.id));
      getTeamsR2(s).flat().forEach((p) => attending.add(p.id));
      attending.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });

    return {
      playerGames: map,
      totalSessions: history.length,
      minGames: Math.max(1, Math.round(history.length / 2)),
    };
  }, [history]);

  /* ===================== WEDSTRIJDEN ===================== */
  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();

    history.forEach((s) => {
      getTeamsR1(s).forEach((t) => t.forEach((p) => map.set(p.id, (map.get(p.id) || 0))));
      [...(s.round1Results || []), ...(s.round2Results || [])].forEach((m) => {
        [...safeTeam(getTeamsR1(s), m.team1Index), ...safeTeam(getTeamsR2(s), m.team2Index)].forEach(
          (p) => map.set(p.id, (map.get(p.id) || 0) + 1)
        );
      });
    });

    return map;
  }, [history]);

  /* ===================== TOPSCOORDER ===================== */
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
      .map(([id, games]) => ({
        playerId: id,
        goals: goals.get(id) || 0,
        games,
        avg: games ? (goals.get(id) || 0) / games : 0,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => b.avg - a.avg || b.goals - a.goals);
  }, [history, playerMatches, playerGames, minGames]);

  /* ===================== COMPETITIE ===================== */
  const competitionPoints = useMemo(() => {
    const pts = new Map<number, number>();
    const gf = new Map<number, number>();
    const gd = new Map<number, number>();

    const add = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
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
      (s.round1Results || []).forEach((m) => add(getTeamsR1(s), m));
      (s.round2Results || []).forEach((m) => add(getTeamsR2(s), m));
    });

    return Array.from(playerMatches.entries())
      .map(([id, games]) => ({
        playerId: id,
        points: pts.get(id) || 0,
        games,
        avg: games ? (pts.get(id) || 0) / games : 0,
        gf: gf.get(id) || 0,
        gd: gd.get(id) || 0,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => b.avg - a.avg || b.gd - a.gd || b.gf - a.gf);
  }, [history, playerMatches, playerGames, minGames]);

  /* ===================== BESTE VERDEDIGER ===================== */
  const bestDefense = useMemo(() => {
    const against = new Map<number, number>();

    const add = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
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
        avg: games ? (against.get(id) || 0) / games : 0,
        games,
        meetsThreshold: (playerGames.get(id) || 0) >= minGames,
      }))
      .sort((a, b) => a.avg - b.avg);
  }, [history, playerMatches, playerGames, minGames]);

  /* ===================== AANWEZIG ===================== */
  const mostAttended = useMemo(
    () =>
      Array.from(playerGames.entries())
        .map(([id, count]) => ({
          playerId: id,
          count,
          percentage: (count / totalSessions) * 100,
          meetsThreshold: true,
        }))
        .sort((a, b) => b.count - a.count),
    [playerGames, totalSessions]
  );

  /* ===================== PRINT MAPPING ===================== */
  const mapRows = (data: any[], value: (p: any) => string, sub?: (p: any) => string) =>
    data
      .filter((p) => p.meetsThreshold)
      .map((p, i) => ({
        rank: i + 1,
        name: playerMap.get(p.playerId)?.name || '',
        value: value(p),
        sub: sub ? sub(p) : '',
      }));

  return (
    <>
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setShowPrint(true)}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow"
        >
          Print alle statistieken
        </button>
      </div>

      {showPrint && (
        <StatsPrintAll
          title="Competitie Overzicht"
          competition={mapRows(
            competitionPoints,
            (p) => p.avg.toFixed(2),
            (p) => `${p.points} pt / ${p.games} w`
          )}
          scorers={mapRows(
            topScorers,
            (p) => p.avg.toFixed(2),
            (p) => `${p.goals} goals / ${p.games} w`
          )}
          defense={mapRows(bestDefense, (p) => p.avg.toFixed(2), (p) => `${p.games} w`)}
          attendance={mapRows(
            mostAttended,
            (p) => `${p.count}x`,
            (p) => `${p.percentage.toFixed(0)}%`
          )}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
};

export default Statistics;
