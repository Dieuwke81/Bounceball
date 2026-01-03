

import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

// We importeren de print component
import StatsPrintAll from './StatsPrintAll';

// We importeren alle iconen voor de zekerheid om crashes te voorkomen
import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

interface StatisticsProps {
  history: GameSession[];
  players: Player[];
  onSelectPlayer: (playerId: number) => void;
  competitionName?: string;
}

const Statistics: React.FC<StatisticsProps> = ({ history, players, onSelectPlayer, competitionName }) => {
  const [showAll, setShowAll] = useState({
    attendance: false,
    scorers: false,
    points: false,
    defense: false,
  });

  // State voor de print-modus
  const [isPrinting, setIsPrinting] = useState(false);

  // De schakelaar: standaard verbergen we mensen die te weinig speelden
  const [showIneligible, setShowIneligible] = useState(false);

  // ✅ toggle om bij "Beste verdediger" alleen keepers te tonen
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

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
  // Matches per speler
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
  // Topscoorder
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
  // Competitie punten
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

      t1.forEach((p) => {
        gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s1);
        gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s1 - s2));
      });
      t2.forEach((p) => {
        gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s2);
        gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s2 - s1));
      });

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
        const gd = gdByPlayer.set(playerId, (gdByPlayer.get(playerId) || 0)); // dummy fix voor TS
        const realGd = gdByPlayer.get(playerId) || 0;

        return {
          playerId,
          points,
          games,
          avg: games > 0 ? points / games : 0,
          gf,
          gd: realGd,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort(
        (a, b) =>
          b.avg - a.avg || 
          b.gd - a.gd || 
          b.gf - a.gf || 
          a.playerId - b.playerId
      );
  }, [history, playerGames, minGames, playerMatches]);

  // ============================
  // Beste verdediger
  // ============================
  const bestDefense = useMemo(() => {
    const againstByPlayer = new Map<number, number>();

    const addMatch = (teams: Player[][], match: any) => {
      const t1 = safeTeam(teams, match.team1Index);
      const t2 = safeTeam(teams, match.team2Index);
      if (!t1.length || !t2.length) return;

      const s1 = teamGoals(match.team1Goals);
      const s2 = teamGoals(match.team2Goals);

      t1.forEach((p) => againstByPlayer.set(p.id, (againstByPlayer.get(p.id) || 0) + s2));
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
        count: getTeamsR1(session).flat().length || 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

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

  const bestDefenseForDisplay = useMemo(() => {
    if (!defenseKeepersOnly) return bestDefense;
    return bestDefense.filter((row) => {
      const player = playerMap.get(row.playerId);
      return !!player && player.isKeeper;
    });
  }, [bestDefense, defenseKeepersOnly, playerMap]);

  // ============================
  // PRINT DATA HELPER
  // ============================
  const getPrintData = () => {
    const filterFn = (item: any) => showIneligible || item.meetsThreshold;

    return {
      competition: competitionPoints.filter(filterFn).map((p, i) => ({
        rank: i + 1,
        name: playerMap.get(p.playerId)?.name || '?',
        value: p.avg.toFixed(2),
        sub: `${p.points}pt / ${p.games}w`,
      })),
      scorers: topScorers.filter(filterFn).map((p, i) => ({
        rank: i + 1,
        name: playerMap.get(p.playerId)?.name || '?',
        value: p.avg.toFixed(2),
        sub: `${p.goals}d / ${p.games}w`,
      })),
      defense: bestDefenseForDisplay.filter(filterFn).map((p, i) => ({
        rank: i + 1,
        name: playerMap.get(p.playerId)?.name || '?',
        value: p.avg.toFixed(2),
        sub: `${p.games} w`,
      })),
      attendance: mostAttended.map((p, i) => ({
        rank: i + 1,
        name: playerMap.get(p.playerId)?.name || '?',
        value: `${p.count}x`,
        sub: `${p.percentage.toFixed(0)}%`,
      })),
    };
  };

  // ============================
  // GRAFIEK COMPONENTEN (VOLLEDIG)
  // ============================
  const AttendanceChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
    if (data.length < 2) {
      return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
    }

    const W = 500, H = 200, P = 30;
    const minCount = Math.min(...data.map((d) => d.count));
    const maxCount = Math.max(...data.map((d) => d.count));
    const countRange = Math.max(1, maxCount - minCount);

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (W - P * 2) + P;
        const y = H - P - ((d.count - minCount) / countRange) * (H - P * 2);
        return `${x},${y}`;
      }).join(' ');

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="stroke-gray-600" strokeWidth="1" />
        <text x={P - 10} y={P + 5} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">{maxCount}</text>
        <text x={P - 10} y={H - P} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">{minCount}</text>
        <polyline fill="none" className="stroke-cyan-400" strokeWidth="2" points={points} />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - P * 2) + P;
          const y = H - P - ((d.count - minCount) / countRange) * (H - P * 2);
          return (
            <circle key={i} cx={x} cy={y} r="3" className="fill-cyan-400 stroke-gray-800" strokeWidth="2" />
          );
        })}
        <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">{formatDate(data[0].date)}</text>
        <text x={W - P} y={H - P + 15} textAnchor="end" className="fill-gray-400 text-xs">{formatDate(data[data.length - 1].date)}</text>
      </svg>
    );
  };

  const GoalDifferenceChart: React.FC<{ data: { date: string; avgDiff: number }[] }> = ({ data }) => {
    if (data.length < 2) {
      return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
    }

    const W = 500, H = 200, P = 30;
    const minDiff = Math.min(...data.map((d) => d.avgDiff));
    const maxDiff = Math.max(...data.map((d) => d.avgDiff));
    const diffRange = Math.max(0.1, maxDiff - minDiff);

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (W - P * 2) + P;
        const y = H - P - ((d.avgDiff - minDiff) / diffRange) * (H - P * 2);
        return `${x},${y}`;
      }).join(' ');

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="stroke-gray-600" strokeWidth="1" />
        <text x={P - 10} y={P + 5} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">{maxDiff.toFixed(1)}</text>
        <text x={P - 10} y={H - P} dominantBaseline="middle" textAnchor="end" className="fill-gray-400 text-xs">{minDiff.toFixed(1)}</text>
        <polyline fill="none" className="stroke-fuchsia-400" strokeWidth="2" points={points} />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - P * 2) + P;
          const y = H - P - ((d.avgDiff - minDiff) / diffRange) * (H - P * 2);
          return (
            <circle key={i} cx={x} cy={y} r="3" className="fill-fuchsia-400 stroke-gray-800" strokeWidth="2" />
          );
        })}
        <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">{formatDate(data[0].date)}</text>
        <text x={W - P} y={H - P + 15} textAnchor="end" className="fill-gray-400 text-xs">{formatDate(data[data.length - 1].date)}</text>
      </svg>
    );
  };

  // ============================
  // UI COMPONENTEN
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
        <span className="text-sm font-bold text-cyan-400 w-6 text-center flex-shrink-0">{rank}.</span>
        <span className={`ml-3 font-medium truncate ${meetsThreshold ? 'text-gray-200' : 'text-red-400'}`}>{player.name}</span>
        {player.isFixedMember && <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">Lid</span>}
        {player.isKeeper && <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">K</span>}
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <span className="text-lg font-bold bg-gray-600 text-white py-1 px-3 rounded-full">{value}</span>
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

    return (
      <>
        {displayedData.length > 0 ? displayedData.map(renderRow) : <p className="text-gray-500 text-sm text-center italic">Geen gegevens.</p>}
        {filteredData.length > 10 && (
          <div className="mt-2">
            <button onClick={toggleShowAll} className="w-full text-center py-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold rounded-lg hover:bg-gray-700/50 transition-colors">
              {showAllFlag ? 'Minder Weergeven' : `Toon Alle ${filteredData.length}`}
            </button>
          </div>
        )}
      </>
    );
  };

  const SmallToggle: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({
    checked,
    onChange,
    label,
  }) => (
    <label className="flex items-center cursor-pointer select-none">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={`block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-600'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
      </div>
      <span className="ml-2 text-xs font-semibold text-gray-300">{label}</span>
    </label>
  );

  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Data</h2>
        <p className="text-gray-400">Sla je eerste toernooi af om hier statistieken te zien.</p>
      </div>
    );
  }

  const printData = getPrintData();

  return (
    <>
      {/* Print Knop - Mooi klein icoon bovenaan */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsPrinting(true)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg border border-gray-600 transition-all shadow-sm group"
          title="Print alle statistieken"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span className="text-xs font-bold">Print alleen via PC</span>
        </button>
      </div>

      <div className="text-center mb-4">
        <p className="text-gray-400">
          Statistieken gebaseerd op <span className="font-bold text-white">{totalSessions}</span> speeldagen. <span className="italic">Minimaal <span className="font-bold text-white">{minGames}</span> speeldagen nodig.</span>
        </p>
      </div>

      {/* --- DE SCHAKELAAR (HET SCHUIFJE) --- */}
      <div className="flex justify-center items-center mb-8">
        <label className="flex items-center cursor-pointer p-3 bg-gray-800 rounded-lg shadow-md border border-gray-700 hover:bg-gray-700 transition-colors">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={showIneligible} onChange={() => setShowIneligible(!showIneligible)} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${showIneligible ? 'bg-green-500' : 'bg-gray-600'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showIneligible ? 'transform translate-x-4' : ''}`}></div>
          </div>
          <div className="ml-3 text-gray-300 text-sm font-medium select-none">Toon spelers onder de drempel</div>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <StatCard title="Competitie" icon={<img src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png" className="w-12 h-12 object-contain" />}>
          <StatList data={competitionPoints} showAllFlag={showAll.points} toggleShowAll={() => setShowAll((s) => ({ ...s, points: !s.points }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.points}pt / ${p.games}w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Topscoorder" icon={<img src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png" className="w-12 h-12 object-contain" />}>
          <StatList data={topScorers} showAllFlag={showAll.scorers} toggleShowAll={() => setShowAll((s) => ({ ...s, scorers: !s.scorers }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.goals}d / ${p.games}w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Beste verdediger" icon={<img src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png" className="w-12 h-12 object-contain" />} headerRight={<SmallToggle checked={defenseKeepersOnly} onChange={() => setDefenseKeepersOnly((v) => !v)} label="Alleen keepers" />}>
          <StatList data={bestDefenseForDisplay} showAllFlag={showAll.defense} toggleShowAll={() => setShowAll((s) => ({ ...s, defense: !s.defense }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.games} w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Meest aanwezig" icon={<UsersIcon className="w-6 h-6 text-green-400" />}>
          <StatList data={mostAttended} showAllFlag={showAll.attendance} toggleShowAll={() => setShowAll((s) => ({ ...s, attendance: !s.attendance }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={`${p.count}x`} subtext={`${p.percentage.toFixed(0)}%`} />} />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatCard title="Aanwezigheids Trend" icon={<ChartBarIcon className="w-6 h-6 text-cyan-400" />}><AttendanceChart data={attendanceHistory} /></StatCard>
        <StatCard title="Balans van Teams" icon={<ChartBarIcon className="w-6 h-6 text-fuchsia-400" />}><GoalDifferenceChart data={goalDifferenceHistory} /></StatCard>
      </div>

      {isPrinting && (
        <StatsPrintAll 
          title={competitionName || "Statistieken"} 
          {...printData} 
          onClose={() => setIsPrinting(false)} 
        />
      )}
    </>
  );
};

export default Statistics;
