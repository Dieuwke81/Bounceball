
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

  // De schakelaar: standaard verbergen we mensen die te weinig speelden
  const [showIneligible, setShowIneligible] = useState(false);

  // ✅ toggle om bij "Beste verdediger" alleen keepers te tonen
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
  // - telt als aanwezig als speler in R1 teams zit OF in R2 teams (als aanwezig)
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
      // drempel op basis van avonden (zoals je UI tekst zegt)
      minGames: Math.max(1, Math.round(sessions / 2)),
    };
  }, [history]);

  // ============================
  // Matches per speler (aantal wedstrijden)
  // LET OP: Round1Results gebruiken teamsR1, Round2Results gebruiken teamsR2
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

  // ============================
  // Competitie punten (totaal punten / wedstrijden) ✅
  // - sorting: avg desc
  // - tie-break: doelsaldo (gd) desc
  // - tie-break: goals voor (gf) desc
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
          b.avg - a.avg || // ✅ hoofdregel
          b.gd - a.gd || // tie-break 1
          b.gf - a.gf || // tie-break 2
          a.playerId - b.playerId
      );
  }, [history, playerGames, minGames, playerMatches]);

  // ============================
  // Beste verdediger (tegengoals / wedstrijden) -> lager is beter
  // Belangrijk: Round2Results moet teamsR2 gebruiken
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

  const attendanceHistory = useMemo(() => {
    if (!history) return [];
    return history
      .map((session) => ({
        date: session.date,
        count: getTeamsR1(session).flat().length || 0, // trend: opkomst per avond (R1)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const goalDifferenceHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    return history
      .map((session) => {
        // doelsaldo per avond: neem alle matches (R1 + R2)
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

  // ✅ gefilterde "beste verdediger" lijst (optioneel alleen keepers)
  const bestDefenseForDisplay = useMemo(() => {
    if (!defenseKeepersOnly) return bestDefense;
    return bestDefense.filter((row) => {
      const player = playerMap.get(row.playerId);
      return !!player && player.isKeeper;
    });
  }, [bestDefense, defenseKeepersOnly, playerMap]);

  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Data</h2>
        <p className="text-gray-400">Sla je eerste toernooi af om hier statistieken te zien.</p>
      </div>
    );
  }

  // --- Print overlay component ---
  if (showPrintAll) {
    return (
      <StatsPrintAll
        history={history}
        players={players}
        onClose={() => setShowPrintAll(false)}
      />
    );
  }

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
        <p className="text-gray-500 text-sm text-center
