
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

// Importeer de print component
import StatsPrintAll from './StatsPrintAll';

// Iconen
import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

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

  const [isPrinting, setIsPrinting] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // ============================
  // Helpers & Berekeningen
  // ============================
  const getTeamsR1 = (s: GameSession) => s.teams || [];
  const getTeamsR2 = (s: GameSession) => (s as any).round2Teams ?? s.teams ?? [];
  const teamGoals = (goals: any[]) => (goals || []).reduce((sum, g) => sum + (g?.count || 0), 0);
  const safeTeam = (teams: Player[][], idx: number) => Array.isArray(teams) && teams[idx] ? teams[idx] : [];

  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const playerGamesMap = new Map<number, number>();
    const sessions = history.length;
    if (sessions === 0) return { playerGames: playerGamesMap, totalSessions: 0, minGames: 0 };

    history.forEach((session) => {
      const attendingIds = new Set<number>();
      getTeamsR1(session).flat().forEach((p) => attendingIds.add(p.id));
      getTeamsR2(session).flat().forEach((p) => attendingIds.add(p.id));
      attendingIds.forEach((id) => playerGamesMap.set(id, (playerGamesMap.get(id) || 0) + 1));
    });

    return {
      playerGames: playerGamesMap,
      totalSessions: sessions,
      minGames: Math.max(1, Math.round(sessions / 2)),
    };
  }, [history]);

  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();
    history.forEach((session) => {
      const t1 = getTeamsR1(session);
      (session.round1Results || []).forEach((m) => {
        [...safeTeam(t1, m.team1Index), ...safeTeam(t1, m.team2Index)].forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });
      const t2 = getTeamsR2(session);
      (session.round2Results || []).forEach((m) => {
        [...safeTeam(t2, m.team1Index), ...safeTeam(t2, m.team2Index)].forEach((p) => map.set(p.id, (map.get(p.id) || 0) + 1));
      });
    });
    return map;
  }, [history]);

  const topScorers = useMemo(() => {
    const goalsByPlayer = new Map<number, number>();
    history.forEach((session) => {
      [...(session.round1Results || []), ...(session.round2Results || [])].forEach((m) => {
        [...(m.team1Goals || []), ...(m.team2Goals || [])].forEach((g) => {
          goalsByPlayer.set(g.playerId, (goalsByPlayer.get(g.playerId) || 0) + (g.count || 0));
        });
      });
    });
    return Array.from(playerMatches.entries()).map(([playerId, games]) => ({
      playerId, goals: goalsByPlayer.get(playerId) || 0, games, avg: games > 0 ? (goalsByPlayer.get(playerId) || 0) / games : 0,
      meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
    })).sort((a, b) => b.avg - a.avg || b.goals - a.goals || a.playerId - b.playerId);
  }, [history, playerGames, minGames, playerMatches]);

  const competitionPoints = useMemo(() => {
    const ptsByPlayer = new Map<number, number>();
    const gfByPlayer = new Map<number, number>();
    const gdByPlayer = new Map<number, number>();

    const processMatch = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
      if (!t1.length || !t2.length) return;
      const s1 = teamGoals(m.team1Goals);
      const s2 = teamGoals(m.team2Goals);
      t1.forEach((p) => { gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s1); gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s1 - s2)); });
      t2.forEach((p) => { gfByPlayer.set(p.id, (gfByPlayer.get(p.id) || 0) + s2); gdByPlayer.set(p.id, (gdByPlayer.get(p.id) || 0) + (s2 - s1)); });
      if (s1 > s2) t1.forEach(p => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 3));
      else if (s2 > s1) t2.forEach(p => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 3));
      else [...t1, ...t2].forEach(p => ptsByPlayer.set(p.id, (ptsByPlayer.get(p.id) || 0) + 1));
    };

    history.forEach(s => {
      (s.round1Results || []).forEach(m => processMatch(getTeamsR1(s), m));
      (s.round2Results || []).forEach(m => processMatch(getTeamsR2(s), m));
    });

    return Array.from(playerMatches.entries()).map(([playerId, games]) => ({
      playerId, points: ptsByPlayer.get(playerId) || 0, games, avg: games > 0 ? (ptsByPlayer.get(playerId) || 0) / games : 0,
      gd: gdByPlayer.get(playerId) || 0, gf: gfByPlayer.get(playerId) || 0,
      meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
    })).sort((a, b) => b.avg - a.avg || b.gd - a.gd || b.gf - a.gf || a.playerId - b.playerId);
  }, [history, playerGames, minGames, playerMatches]);

  const bestDefense = useMemo(() => {
    const againstByPlayer = new Map<number, number>();
    const processMatch = (teams: Player[][], m: any) => {
      const t1 = safeTeam(teams, m.team1Index);
      const t2 = safeTeam(teams, m.team2Index);
      if (!t1.length || !t2.length) return;
      t1.forEach(p => againstByPlayer.set(p.id, (againstByPlayer.get(p.id) || 0) + teamGoals(m.team2Goals)));
      t2.forEach(p => againstByPlayer.set(p.id, (againstByPlayer.get(p.id) || 0) + teamGoals(m.team1Goals)));
    };
    history.forEach(s => {
      (s.round1Results || []).forEach(m => processMatch(getTeamsR1(s), m));
      (s.round2Results || []).forEach(m => processMatch(getTeamsR2(s), m));
    });
    return Array.from(playerMatches.entries()).map(([playerId, games]) => ({
      playerId, avg: games > 0 ? (againstByPlayer.get(playerId) || 0) / games : 0, games,
      meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
    })).sort((a, b) => a.avg - b.avg || b.games - a.games || a.playerId - b.playerId);
  }, [history, playerGames, minGames, playerMatches]);

  const bestDefenseForDisplay = useMemo(() => {
    if (!defenseKeepersOnly) return bestDefense;
    return bestDefense.filter(r => playerMap.get(r.playerId)?.isKeeper);
  }, [bestDefense, defenseKeepersOnly, playerMap]);

  const mostAttended = useMemo(() => {
    return Array.from(playerGames.entries()).map(([playerId, count]) => ({
      playerId, count, percentage: (count / totalSessions) * 100, meetsThreshold: true,
    })).sort((a, b) => b.count - a.count || a.playerId - b.playerId);
  }, [playerGames, totalSessions]);

  const attendanceHistory = useMemo(() => {
    return history.map(s => ({ date: s.date, count: getTeamsR1(s).flat().length }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const goalDifferenceHistory = useMemo(() => {
    return history.map(s => {
      const matches = [...(s.round1Results || []), ...(s.round2Results || [])];
      if (!matches.length) return null;
      const diff = matches.reduce((sum, m) => sum + Math.abs(teamGoals(m.team1Goals) - teamGoals(m.team2Goals)), 0);
      return { date: s.date, avgDiff: diff / matches.length };
    }).filter((x): x is { date: string, avgDiff: number } => x !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  // ============================
  // PRINT LOGICA
  // ============================
  const getPrintData = () => {
    const filter = (item: any) => showIneligible || item.meetsThreshold;
    return {
      competition: competitionPoints.filter(filter).map((p, i) => ({ rank: i + 1, name: playerMap.get(p.playerId)?.name || '?', value: p.avg.toFixed(2), sub: `${p.points}pt / ${p.games}w` })),
      scorers: topScorers.filter(filter).map((p, i) => ({ rank: i + 1, name: playerMap.get(p.playerId)?.name || '?', value: p.avg.toFixed(2), sub: `${p.goals}d / ${p.games}w` })),
      defense: bestDefenseForDisplay.filter(filter).map((p, i) => ({ rank: i + 1, name: playerMap.get(p.playerId)?.name || '?', value: p.avg.toFixed(2), sub: `${p.games}w` })),
      attendance: mostAttended.map((p, i) => ({ rank: i + 1, name: playerMap.get(p.playerId)?.name || '?', value: `${p.count}x`, sub: `${p.percentage.toFixed(0)}%` })),
    };
  };

  // ============================
  // GRAFIEK COMPONENTEN (SVG)
  // ============================
  const AttendanceChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
    if (data.length < 2) return <p className="text-gray-400 text-center py-8">Niet genoeg data.</p>;
    const W = 500, H = 200, P = 30;
    const minC = Math.min(...data.map(d => d.count)), maxC = Math.max(...data.map(d => d.count));
    const range = Math.max(1, maxC - minC);
    const points = data.map((d, i) => `${(i / (data.length - 1)) * (W - P * 2) + P},${H - P - ((d.count - minC) / range) * (H - P * 2)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <polyline fill="none" className="stroke-cyan-400" strokeWidth="3" points={points} />
        {data.map((d, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * (W - P * 2) + P} cy={H - P - ((d.count - minC) / range) * (H - P * 2)} r="4" className="fill-cyan-400" />
        ))}
      </svg>
    );
  };

  const GoalDiffChart: React.FC<{ data: { date: string; avgDiff: number }[] }> = ({ data }) => {
    if (data.length < 2) return <p className="text-gray-400 text-center py-8">Niet genoeg data.</p>;
    const W = 500, H = 200, P = 30;
    const minD = Math.min(...data.map(d => d.avgDiff)), maxD = Math.max(...data.map(d => d.avgDiff));
    const range = Math.max(0.1, maxD - minD);
    const points = data.map((d, i) => `${(i / (data.length - 1)) * (W - P * 2) + P},${H - P - ((d.avgDiff - minD) / range) * (H - P * 2)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <polyline fill="none" className="stroke-fuchsia-400" strokeWidth="3" points={points} />
        {data.map((d, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * (W - P * 2) + P} cy={H - P - ((d.avgDiff - minD) / range) * (H - P * 2)} r="4" className="fill-fuchsia-400" />
        ))}
      </svg>
    );
  };

  // ============================
  // UI RENDER
  // ============================
  const StatCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; headerRight?: React.ReactNode }> = ({ title, icon, children, headerRight }) => (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-4 justify-between">
        <div className="flex items-center">{icon}<h3 className="ml-3 text-2xl font-bold text-white">{title}</h3></div>
        {headerRight}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );

  const StatRow: React.FC<{ rank: number; player: Player; value: string | number; subtext?: string; meetsThreshold?: boolean }> = ({ rank, player, value, subtext, meetsThreshold = true }) => (
    <button onClick={() => onSelectPlayer(player.id)} className="w-full flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
      <div className="flex items-center">
        <span className="text-sm font-bold text-cyan-400 w-6 text-center">{rank}.</span>
        <span className={`ml-3 font-medium ${meetsThreshold ? 'text-gray-200' : 'text-red-400'}`}>{player.name}</span>
        {player.isFixedMember && <span className="ml-2 text-xs bg-green-500 text-white px-2 rounded-full">Lid</span>}
        {player.isKeeper && <span className="ml-2 text-xs bg-amber-500 text-white px-2 rounded-full">K</span>}
      </div>
      <div className="text-right">
        <span className="text-lg font-bold bg-gray-600 text-white py-1 px-3 rounded-full">{value}</span>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
    </button>
  );

  const StatList: React.FC<{ data: any[]; showAllFlag: boolean; toggleShowAll: () => void; renderRow: (item: any, index: number) => React.ReactNode }> = ({ data, showAllFlag, toggleShowAll, renderRow }) => {
    const filtered = data.filter(i => playerMap.has(i.playerId) && (showIneligible || i.meetsThreshold));
    const display = showAllFlag ? filtered : filtered.slice(0, 10);
    return (
      <>
        {display.length ? display.map(renderRow) : <p className="text-gray-500 text-center italic">Geen spelers.</p>}
        {filtered.length > 10 && <button onClick={toggleShowAll} className="w-full text-cyan-400 py-2 text-sm font-bold">{showAllFlag ? 'Minder' : `Toon Alle ${filtered.length}`}</button>}
      </>
    );
  };

  if (!history.length) return <div className="text-white text-center p-10">Geen data beschikbaar.</div>;

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setIsPrinting(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg border border-gray-600">
          <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          <span className="text-xs font-bold">Print PDF</span>
        </button>
      </div>

      <div className="text-center mb-6">
        <p className="text-gray-400 text-sm">Gebaseerd op {totalSessions} avonden. Drempel: {minGames}x aanwezig.</p>
      </div>

      {/* --- HET SCHUIFJE (TERUGGEZET) --- */}
      <div className="flex justify-center mb-8">
        <label className="flex items-center cursor-pointer p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={showIneligible} onChange={() => setShowIneligible(!showIneligible)} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${showIneligible ? 'bg-green-500' : 'bg-gray-600'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showIneligible ? 'translate-x-4' : ''}`}></div>
          </div>
          <span className="ml-3 text-gray-300 text-sm font-medium">Toon spelers onder de drempel</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <StatCard title="Competitie" icon={<img src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png" className="w-12 h-12" />}>
          <StatList data={competitionPoints} showAllFlag={showAll.points} toggleShowAll={() => setShowAll(s => ({ ...s, points: !s.points }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.points}pt / ${p.games}w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Topscoorder" icon={<img src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png" className="w-12 h-12" />}>
          <StatList data={topScorers} showAllFlag={showAll.scorers} toggleShowAll={() => setShowAll(s => ({ ...s, scorers: !s.scorers }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.goals}d / ${p.games}w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Beste verdediger" icon={<img src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png" className="w-12 h-12" />} headerRight={<label className="flex items-center cursor-pointer"><input type="checkbox" className="sr-only" checked={defenseKeepersOnly} onChange={() => setDefenseKeepersOnly(!defenseKeepersOnly)} /><div className={`w-8 h-4 rounded-full ${defenseKeepersOnly ? 'bg-green-500' : 'bg-gray-600'} relative`}><div className={`absolute w-3 h-3 bg-white rounded-full top-0.5 left-0.5 transition-transform ${defenseKeepersOnly ? 'translate-x-4' : ''}`}></div></div><span className="ml-2 text-[10px] text-gray-400">Keepers</span></label>}>
          <StatList data={bestDefenseForDisplay} showAllFlag={showAll.defense} toggleShowAll={() => setShowAll(s => ({ ...s, defense: !s.defense }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={p.avg.toFixed(2)} subtext={`${p.games}w`} meetsThreshold={p.meetsThreshold} />} />
        </StatCard>

        <StatCard title="Meest aanwezig" icon={<UsersIcon className="w-6 h-6 text-green-400" />}>
          <StatList data={mostAttended} showAllFlag={showAll.attendance} toggleShowAll={() => setShowAll(s => ({ ...s, attendance: !s.attendance }))} renderRow={(p, i) => <StatRow key={p.playerId} rank={i + 1} player={playerMap.get(p.playerId)!} value={`${p.count}x`} subtext={`${p.percentage.toFixed(0)}%`} />} />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatCard title="Aanwezigheids Trend" icon={<ChartBarIcon className="w-6 h-6 text-cyan-400" />}><AttendanceChart data={attendanceHistory} /></StatCard>
        <StatCard title="Balans van Teams" icon={<ChartBarIcon className="w-6 h-6 text-fuchsia-400" />}><GoalDiffChart data={goalDifferenceHistory} /></StatCard>
      </div>

      {isPrinting && <StatsPrintAll title="Statistieken" {...getPrintData()} onClose={() => setIsPrinting(false)} />}
    </>
  );
};

export default Statistics;
