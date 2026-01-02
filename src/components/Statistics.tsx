
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

// We importeren alle iconen voor de zekerheid om crashes te voorkomen
import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import PrinterIcon from './icons/PrinterIcon'; // print icoon import
import StatsPrintAll from './StatsPrintAll';   // jouw printcomponent import

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

  // Toggle om spelers die te weinig speelden te tonen/verbergen
  const [showIneligible, setShowIneligible] = useState(false);

  // Toggle voor beste verdediger, alleen keepers tonen
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

  // Nieuwe state voor print overlay
  const [showPrintAll, setShowPrintAll] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // ============================
  // Helpers (RONDE 1 vs RONDE 2)
  // ============================
  const getTeamsR1 = (s: GameSession) => s.teams || [];
  const getTeamsR2 = (s: GameSession) => (s as any).round2Teams ?? s.teams ?? [];

  const teamGoals = (goals: any[]) => (goals || []).reduce((sum, g) => sum + (g?.count || 0), 0);

  const safeTeam = (teams: Player[][], idx: number) =>
    Array.isArray(teams) && teams[idx] ? teams[idx] : [];

  // ============================
  // Attendance per SPEELAVOND (sessie)
  // ============================
  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const playerGamesMap = new Map<number, number>();
    const sessions = history.length;

    if (sessions === 0) return { playerGames: playerGamesMap, totalSessions: 0, minGames: 0 };

    history.forEach((session) => {
      const attendingIds = new Set<number>();

      const r1 = getTeamsR1(session);
      r1.flat().forEach((p) => attendingIds.add(p.id));

      const r2 = getTeamsR2(session);
      r2.flat().forEach((p) => attendingIds.add(p.id));

      attendingIds.forEach((id) => {
        playerGamesMap.set(id, (playerGamesMap.get(id) || 0) + 1);
      });
    });

    return {
      playerGames: playerGamesMap,
      totalSessions: sessions,
      minGames: Math.max(1, Math.round(sessions / 2)),
    };
  }, [history]);

  // ============================
  // Matches per speler (aantal wedstrijden)
  // ============================
  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();

    history.forEach((session) => {
      const teamsR1 = getTeamsR1(session);
      (session.round1Results || []).forEach((match) => {
        const t1 = safeTeam(teamsR1, match.team1Index);
        const t2 = safeTeam(teamsR1, match.team2Index);
        if (!t1.length || !t2.length) return;

        [...t1, ...t2].forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });

      const teamsR2 = getTeamsR2(session);
      (session.round2Results || []).forEach((match) => {
        const t1 = safeTeam(teamsR2, match.team1Index);
        const t2 = safeTeam(teamsR2, match.team2Index);
        if (!t1.length || !t2.length) return;

        [...t1, ...t2].forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });
    });

    return map;
  }, [history]);

  // ============================
  // Topscoorder (goals / wedstrijden)
  // ============================
  const topScorers = useMemo(() => {
    const goalsByPlayer = new Map<number, number>();

    history.forEach((session) => {
      const allMatches = [...(session.round1Results || []), ...(session.round2Results || [])];
      allMatches.forEach((match) => {
        [...(match.team1Goals || []), ...(match.team2Goals || [])].forEach((g) => {
          goalsByPlayer.set(
            g.playerId,
            (goalsByPlayer.get(g.playerId) || 0) + (g.count || 0)
          );
        });
      });
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const goals = goalsByPlayer.get(playerId) || 0;
        return {
          playerId,
          goals,
          games,
          avg: games > 0 ? goals / games : 0,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort((a, b) => b.avg - a.avg || b.goals - a.goals || a.playerId - b.playerId);
  }, [history, playerGames, minGames, playerMatches]);

  // ... deel 2 volgt (voor punten, verdediging, UI, etc.)
  // ============================
  // Competitie punten (totaal punten / wedstrijden)
  // ============================
  const competitionPoints = useMemo(() => {
    const ptsByPlayer = new Map<number, number>();
    const gfByPlayer = new Map<number, number>();
    const gdByPlayer = new Map<number, number>();

    const addMatch = (teams: Player[][], match: any) => {
      const t1 = safeTeam(teams, match.team1Index);
      const t2 = safeTeam(teams, match.team2Index);
      if (!t1.length || !t2.length) return;

      const s1 = teamGoals(match.team1Goals);
      const s2 = teamGoals(match.team2Goals);

      // GF/GD voor tie-breaks (tellen pas bij gelijke avg)
      t1.forEach((p) => {
        gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s1);
        gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s1 - s2));
      });
      t2.forEach((p) => {
        gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s2);
        gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s2 - s1));
      });

      // punten
      if (s1 > s2) {
        t1.forEach((p) => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 3));
      } else if (s2 > s1) {
        t2.forEach((p) => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 3));
      } else {
        t1.forEach((p) => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 1));
        t2.forEach((p) => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 1));
      }
    };

    history.forEach((session) => {
      const teamsR1 = getTeamsR1(session);
      (session.round1Results || []).forEach((match) => addMatch(teamsR1, match));

      const teamsR2 = getTeamsR2(session);
      (session.round2Results || []).forEach((match) => addMatch(teamsR2, match));
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const points = ptsByPlayer.get(playerId) || 0;
        const gf = gfByPlayer.get(playerId) || 0;
        const gd = gdByPlayer.get(playerId) || 0;

        return {
          playerId,
          points,
          games,
          avg: games > 0 ? points / games : 0,
          gf,
          gd,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort(
        (a, b) =>
          b.avg - a.avg || // hoofdregel: avg desc
          b.gd - a.gd ||   // tie-break 1: doelsaldo desc
          b.gf - a.gf ||   // tie-break 2: goals voor desc
          a.playerId - b.playerId
      );
  }, [history, playerGames, minGames, playerMatches]);

  // ============================
  // Beste verdediger (tegengoals / wedstrijden) -> lager is beter
  // ============================
  const bestDefense = useMemo(() => {
    const againstByPlayer = new Map<number, number>();

    const addMatch = (teams: Player[][], match: any) => {
      const t1 = safeTeam(teams, match.team1Index);
      const t2 = safeTeam(teams, match.team2Index);
      if (!t1.length || !t2.length) return;

      const s1 = teamGoals(match.team1Goals);
      const s2 = teamGoals(match.team2Goals);

      // team1 krijgt tegengoals = score team2
      t1.forEach((p) => againstByPlayer.set(p.id, (againstByPlayer.get(p.id) || 0) + s2));
      // team2 krijgt tegengoals = score team1
      t2.forEach((p) => againstByPlayer.set(p.id, (againstByPlayer.get(p.id) || 0) + s1));
    };

    history.forEach((session) => {
      const teamsR1 = getTeamsR1(session);
      (session.round1Results || []).forEach((match) => addMatch(teamsR1, match));

      const teamsR2 = getTeamsR2(session);
      (session.round2Results || []).forEach((match) => addMatch(teamsR2, match));
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const goalsAgainst = againstByPlayer.get(playerId) || 0;
        return {
          playerId,
          avg: games > 0 ? goalsAgainst / games : 0,
          games,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort((a, b) => a.avg - b.avg || b.games - a.games || a.playerId - b.playerId);
  }, [history, playerGames, minGames, playerMatches]);

  // ============================
  // Meest aanwezig
  // ============================
  const mostAttended = useMemo(() => {
    if (totalSessions === 0) return [];
    return Array.from(playerGames.entries())
      .map(([playerId, count]) => ({
        playerId,
        count,
        percentage: (count / totalSessions) * 100,
        meetsThreshold: true,
      }))
      .sort((a, b) => b.count - a.count || a.playerId - b.playerId);
  }, [playerGames, totalSessions]);

  // ============================
  // Attendance history voor grafiek
  // ============================
  const attendanceHistory = useMemo(() => {
    if (!history) return [];
    return history
      .map((session) => ({
        date: session.date,
        count: getTeamsR1(session).flat().length || 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  // ============================
  // Goal difference history voor grafiek
  // ============================
  const goalDifferenceHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    return history
      .map((session) => {
        const allMatches = [...(session.round1Results || []), ...(session.round2Results || [])];
        if (allMatches.length === 0) return null;

        const totalDifference = allMatches.reduce((total, match) => {
          const s1 = teamGoals(match.team1Goals);
          const s2 = teamGoals(match.team2Goals);
          return total + Math.abs(s1 - s2);
        }, 0);

        return {
          date: session.date,
          avgDiff: totalDifference / allMatches.length,
        };
      })
      .filter((item): item is { date: string; avgDiff: number } => item !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  // ============================
  // Gefilterde beste verdediger lijst (optioneel alleen keepers)
  // ============================
  const bestDefenseForDisplay = useMemo(() => {
    if (!defenseKeepersOnly) return bestDefense;
    return bestDefense.filter((row) => {
      const player = playerMap.get(row.playerId);
      return !!player && player.isKeeper;
    });
  }, [bestDefense, defenseKeepersOnly, playerMap]);

  // ============================
  // UI componenten hieronder
  // ============================

  const StatCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerRight?: React.ReactNode;
  }> = ({ title, icon, children, className, headerRight }) => (
    <div className={`bg-gray-800 rounded-xl shadow-lg p-6 ${className || ''}`}>
      <div className="flex items-center mb-4 justify-between gap-3">
        <div className="flex items-center min-w-0">
          {icon}
          <h3 className="ml-3 text-2xl font-bold text-white truncate">{title}</h3>
        </div>
        {headerRight ? <div className="flex-shrink-0">{headerRight}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );

  const StatRow: React.FC<{
    rank: number;
    player: Player;
    value: string | number;
    subtext?: string;
    meetsThreshold?: boolean;
  }> = ({ rank, player, value, subtext, meetsThreshold = true }) => (
    <button
      onClick={() => onSelectPlayer(player.id)}
      className="w-full flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-left"
    >
      <div className="flex items-center min-w-0">
        <span className="text-sm font-bold text-cyan-400 w-6 text-center flex-shrink-0">
          {rank}.
        </span>
        <span
          className={`ml-3 font-medium truncate ${
            meetsThreshold ? 'text-gray-200' : 'text-red-400'
          }`}
        >
          {player.name}
        </span>
        {player.isFixedMember && (
          <span
            className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full"
            title="Vast lid"
          >
            Lid
          </span>
        )}
        {player.isKeeper && (
          <span
            className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full"
            title="Keeper"
          >
            K
          </span>
        )}
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <span className="text-lg font-bold bg-gray-600 text-white py-1 px-3 rounded-full">
          {value}
        </span>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
    </button>
  );

  const StatList: React.FC<{
    data: any[];
    showAllFlag: boolean;
    toggleShowAll: () => void;
    renderRow: (item: any, index: number) => React.ReactNode;
  }> = ({ data, showAllFlag, toggleShowAll, renderRow }) => {
    const filteredData = data.filter((item) => {
      if (!playerMap.has(item.playerId)) return false;
      if (!showIneligible && !item.meetsThreshold) return false;
      return true;
    });

    const displayedData = showAllFlag ? filteredData : filteredData.slice(0, 10);

    if (displayedData.length === 0) {
      return (
        <p className="text-gray-500 text-sm text-center italic">
          Geen spelers voldoen aan de criteria.
        </p>
      );
    }

    return (
      <>
        {displayedData.map(renderRow)}
        {filteredData.length > 10 && (
          <div className="mt-2">
            <button
              onClick={toggleShowAll}
              className="w-full text-center py-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              {showAllFlag ? 'Minder Weergeven' : `Toon Alle ${filteredData.length}`}
            </button>
          </div>
        )}
      </>
    );
  };
  // ============================
  // RENDER
  // ============================

  return (
    <div className="p-6 space-y-8">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Statistieken</h2>

        {/* PRINT ICOON */}
        <button
          onClick={() => setShowPrint(true)}
          title="Print statistieken"
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
        >
          🖨️
        </button>
      </div>

      {/* COMPETITIE */}
      <StatCard
        title="Competitie"
        icon={<span className="text-2xl">🏆</span>}
      >
        <StatList
          data={competitionPoints}
          showAllFlag={showAllCompetition}
          toggleShowAll={() => setShowAllCompetition((v) => !v)}
          renderRow={(row, index) => {
            const player = playerMap.get(row.playerId);
            if (!player) return null;
            return (
              <StatRow
                key={row.playerId}
                rank={index + 1}
                player={player}
                value={row.avg.toFixed(2)}
                subtext={`${row.points} punten • ${row.games} weds`}
                meetsThreshold={row.meetsThreshold}
              />
            );
          }}
        />
      </StatCard>

      {/* TOPSCORER */}
      <StatCard
        title="Topscorer"
        icon={<span className="text-2xl">⚽</span>}
      >
        <StatList
          data={topScorers}
          showAllFlag={showAllGoals}
          toggleShowAll={() => setShowAllGoals((v) => !v)}
          renderRow={(row, index) => {
            const player = playerMap.get(row.playerId);
            if (!player) return null;
            return (
              <StatRow
                key={row.playerId}
                rank={index + 1}
                player={player}
                value={row.avg.toFixed(2)}
                subtext={`${row.goals} goals • ${row.games} weds`}
                meetsThreshold={row.meetsThreshold}
              />
            );
          }}
        />
      </StatCard>

      {/* BESTE VERDEDIGER */}
      <StatCard
        title="Beste Verdediger"
        icon={<span className="text-2xl">🛡️</span>}
        headerRight={
          <label className="flex items-center text-sm text-gray-300 gap-2">
            <input
              type="checkbox"
              checked={defenseKeepersOnly}
              onChange={(e) => setDefenseKeepersOnly(e.target.checked)}
            />
            Alleen keepers
          </label>
        }
      >
        <StatList
          data={bestDefenseForDisplay}
          showAllFlag={showAllDefense}
          toggleShowAll={() => setShowAllDefense((v) => !v)}
          renderRow={(row, index) => {
            const player = playerMap.get(row.playerId);
            if (!player) return null;
            return (
              <StatRow
                key={row.playerId}
                rank={index + 1}
                player={player}
                value={row.avg.toFixed(2)}
                subtext={`${row.games} weds`}
                meetsThreshold={row.meetsThreshold}
              />
            );
          }}
        />
      </StatCard>

      {/* AANWEZIGHEID */}
      <StatCard
        title="Aanwezigheid"
        icon={<span className="text-2xl">📅</span>}
      >
        <StatList
          data={mostAttended}
          showAllFlag={showAllAttendance}
          toggleShowAll={() => setShowAllAttendance((v) => !v)}
          renderRow={(row, index) => {
            const player = playerMap.get(row.playerId);
            if (!player) return null;
            return (
              <StatRow
                key={row.playerId}
                rank={index + 1}
                player={player}
                value={`${row.count}`}
                subtext={`${row.percentage.toFixed(0)}%`}
              />
            );
          }}
        />
      </StatCard>

      {/* PRINT VIEW */}
      {showPrint && (
        <StatsPrintAll
          competition={competitionPoints}
          scorers={topScorers}
          defense={bestDefense}
          attendance={mostAttended}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
};

export default Statistics;
