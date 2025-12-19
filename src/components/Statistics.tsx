
import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';
// We importeren alle iconen voor de zekerheid om crashes te voorkomen
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

  // De schakelaar: standaard verbergen we mensen die te weinig speelden
  const [showIneligible, setShowIneligible] = useState(false);

  // ✅ NIEUW: toggle om bij "Beste verdediger" alleen keepers te tonen
  const [defenseKeepersOnly, setDefenseKeepersOnly] = useState(false);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const playerGamesMap = new Map<number, number>();
    const sessions = history.length;
    if (sessions === 0)
      return { playerGames: playerGamesMap, totalSessions: 0, minGames: 0 };

    history.forEach((session) => {
      const attendingIds = new Set<number>();
      session.teams.flat().forEach((player) => {
        attendingIds.add(player.id);
      });
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

  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();
    history.forEach((session) => {
      [...session.round1Results, ...session.round2Results].forEach((match) => {
        if (session.teams[match.team1Index] && session.teams[match.team2Index]) {
          const playersInMatch = [
            ...session.teams[match.team1Index],
            ...session.teams[match.team2Index],
          ];
          playersInMatch.forEach((player) => {
            map.set(player.id, (map.get(player.id) || 0) + 1);
          });
        }
      });
    });
    return map;
  }, [history]);

  const topScorers = useMemo(() => {
    const stats = new Map<number, number>();
    history.forEach((session) => {
      [...session.round1Results, ...session.round2Results].forEach((match) => {
        [...match.team1Goals, ...match.team2Goals].forEach((goal) => {
          stats.set(goal.playerId, (stats.get(goal.playerId) || 0) + goal.count);
        });
      });
    });
    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const goals = stats.get(playerId) || 0;
        return {
          playerId,
          goals,
          games,
          avg: games > 0 ? goals / games : 0,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [history, playerGames, minGames, playerMatches]);

  const competitionPoints = useMemo(() => {
    const stats = new Map<number, number>();
    history.forEach((session) => {
      [...session.round1Results, ...session.round2Results].forEach((match) => {
        if (!session.teams[match.team1Index] || !session.teams[match.team2Index]) return;
        const team1Players = session.teams[match.team1Index];
        const team2Players = session.teams[match.team2Index];
        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        if (team1Score > team2Score) {
          team1Players.forEach((player) =>
            stats.set(player.id, (stats.get(player.id) || 0) + 3)
          );
        } else if (team2Score > team1Score) {
          team2Players.forEach((player) =>
            stats.set(player.id, (stats.get(player.id) || 0) + 3)
          );
        } else {
          team1Players.forEach((player) =>
            stats.set(player.id, (stats.get(player.id) || 0) + 1)
          );
          team2Players.forEach((player) =>
            stats.set(player.id, (stats.get(player.id) || 0) + 1)
          );
        }
      });
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const points = stats.get(playerId) || 0;
        return {
          playerId,
          points,
          games,
          avg: games > 0 ? points / games : 0,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [history, playerGames, minGames, playerMatches]);

  const bestDefense = useMemo(() => {
    const stats = new Map<number, number>();
    history.forEach((session) => {
      [...session.round1Results, ...session.round2Results].forEach((match) => {
        if (!session.teams[match.team1Index] || !session.teams[match.team2Index]) return;
        const team1Players = session.teams[match.team1Index];
        const team2Players = session.teams[match.team2Index];
        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        team1Players.forEach((player) => {
          stats.set(player.id, (stats.get(player.id) || 0) + team2Score);
        });
        team2Players.forEach((player) => {
          stats.set(player.id, (stats.get(player.id) || 0) + team1Score);
        });
      });
    });

    return Array.from(playerMatches.entries())
      .map(([playerId, games]) => {
        const goalsAgainst = stats.get(playerId) || 0;
        return {
          playerId,
          avg: games > 0 ? goalsAgainst / games : 0,
          games,
          meetsThreshold: (playerGames.get(playerId) || 0) >= minGames,
        };
      })
      .sort((a, b) => a.avg - b.avg);
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
      .sort((a, b) => b.count - a.count);
  }, [playerGames, totalSessions]);

  const attendanceHistory = useMemo(() => {
    if (!history) return [];
    return history
      .map((session) => ({
        date: session.date,
        count: session.teams.flat().length,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const goalDifferenceHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    return history
      .map((session) => {
        const allMatches = [...session.round1Results, ...session.round2Results];
        if (allMatches.length === 0) {
          return null;
        }

        const totalDifference = allMatches.reduce((total, match) => {
          const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
          const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);
          return total + Math.abs(team1Score - team2Score);
        }, 0);

        const averageDifference = totalDifference / allMatches.length;

        return {
          date: session.date,
          avgDiff: averageDifference,
        };
      })
      .filter((item): item is { date: string; avgDiff: number } => item !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  // ✅ NIEUW: gefilterde "beste verdediger" lijst (optioneel alleen keepers)
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
        <p className="text-gray-400">
          Sla je eerste toernooi af om hier statistieken te zien.
        </p>
      </div>
    );
  }

  const StatCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerRight?: React.ReactNode; // ✅ NIEUW
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

  // --- DE VEILIGE LIJST WEERGAVE ---
  const StatList: React.FC<{
    data: any[];
    showAllFlag: boolean;
    toggleShowAll: () => void;
    renderRow: (item: any, index: number) => React.ReactNode;
  }> = ({ data, showAllFlag, toggleShowAll, renderRow }) => {
    const filteredData = data.filter((item) => {
      if (!playerMap.has(item.playerId)) return false; // Voorkomt crash!
      if (!showIneligible && !item.meetsThreshold) return false; // Schakelaar logica
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

  const AttendanceChart: React.FC<{ data: { date: string; count: number }[] }> = ({
    data,
  }) => {
    if (data.length < 2) {
      return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
    }

    const W = 500,
      H = 200,
      P = 30;
    const minCount = Math.min(...data.map((d) => d.count));
    const maxCount = Math.max(...data.map((d) => d.count));
    const countRange = Math.max(1, maxCount - minCount);

    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * (W - P * 2) + P;
        const y = H - P - ((d.count - minCount) / countRange) * (H - P * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line
          x1={P}
          y1={H - P}
          x2={W - P}
          y2={H - P}
          className="stroke-gray-600"
          strokeWidth="1"
        />
        <text
          x={P - 10}
          y={P + 5}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {maxCount}
        </text>
        <text
          x={P - 10}
          y={H - P}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {minCount}
        </text>
        <polyline fill="none" className="stroke-cyan-400" strokeWidth="2" points={points} />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - P * 2) + P;
          const y = H - P - ((d.count - minCount) / countRange) * (H - P * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              className="fill-cyan-400 stroke-gray-800"
              strokeWidth="2"
            >
              <title>{`${formatDate(d.date)}: ${d.count} spelers`}</title>
            </circle>
          );
        })}
        <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">
          {formatDate(data[0].date)}
        </text>
        <text
          x={W - P}
          y={H - P + 15}
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {formatDate(data[data.length - 1].date)}
        </text>
      </svg>
    );
  };

  const GoalDifferenceChart: React.FC<{ data: { date: string; avgDiff: number }[] }> = ({
    data,
  }) => {
    if (data.length < 2) {
      return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
    }

    const W = 500,
      H = 200,
      P = 30;
    const minDiff = Math.min(...data.map((d) => d.avgDiff));
    const maxDiff = Math.max(...data.map((d) => d.avgDiff));
    const diffRange = Math.max(0.1, maxDiff - minDiff);

    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * (W - P * 2) + P;
        const y = H - P - ((d.avgDiff - minDiff) / diffRange) * (H - P * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line
          x1={P}
          y1={H - P}
          x2={W - P}
          y2={H - P}
          className="stroke-gray-600"
          strokeWidth="1"
        />
        <text
          x={P - 10}
          y={P + 5}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {maxDiff.toFixed(1)}
        </text>
        <text
          x={P - 10}
          y={H - P}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {minDiff.toFixed(1)}
        </text>
        <polyline
          fill="none"
          className="stroke-fuchsia-400"
          strokeWidth="2"
          points={points}
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - P * 2) + P;
          const y = H - P - ((d.avgDiff - minDiff) / diffRange) * (H - P * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              className="fill-fuchsia-400 stroke-gray-800"
              strokeWidth="2"
            >
              <title>{`${formatDate(d.date)}: gem. doelsaldo ${d.avgDiff.toFixed(2)}`}</title>
            </circle>
          );
        })}
        <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">
          {formatDate(data[0].date)}
        </text>
        <text
          x={W - P}
          y={H - P + 15}
          textAnchor="end"
          className="fill-gray-400 text-xs"
        >
          {formatDate(data[data.length - 1].date)}
        </text>
      </svg>
    );
  };

  // ✅ Klein toggle componentje (hergebruik stijl van je andere toggle)
  const SmallToggle: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
  }> = ({ checked, onChange, label }) => (
    <label className="flex items-center cursor-pointer select-none">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div
          className={`block w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-green-500' : 'bg-gray-600'
          }`}
        ></div>
        <div
          className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${
            checked ? 'transform translate-x-4' : ''
          }`}
        ></div>
      </div>
      <span className="ml-2 text-xs font-semibold text-gray-300">{label}</span>
    </label>
  );

  return (
    <>
      <div className="text-center mb-4">
        <p className="text-gray-400">
          Statistieken gebaseerd op{' '}
          <span className="font-bold text-white">{totalSessions}</span> speeldagen.{' '}
          <span className="italic">
            Voor de ranglijsten (gem.) moet een speler minimaal{' '}
            <span className="font-bold text-white">{minGames}</span> keer aanwezig zijn
            geweest.
          </span>
        </p>
        <p className="text-green-500 text-sm mt-2 italic">
          Klik op een speler om de individuele statistieken te zien.
        </p>
      </div>

      {/* --- DE SCHAKELAAR --- */}
      <div className="flex justify-center items-center mb-8">
        <label className="flex items-center cursor-pointer p-3 bg-gray-800 rounded-lg shadow-md border border-gray-700 hover:bg-gray-700 transition-colors">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={showIneligible}
              onChange={() => setShowIneligible(!showIneligible)}
            />
            <div
              className={`block w-10 h-6 rounded-full transition-colors ${
                showIneligible ? 'bg-green-500' : 'bg-gray-600'
              }`}
            ></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                showIneligible ? 'transform translate-x-4' : ''
              }`}
            ></div>
          </div>
          <div className="ml-3 text-gray-300 text-sm font-medium select-none">
            Toon spelers onder de drempel
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* COMPETITIE - MET PLAATJE */}
        <StatCard
          title="Competitie"
          icon={
            <img
              src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png"
              alt="Competitie"
              className="w-12 h-12 object-contain"
            />
          }
        >
          <StatList
            data={competitionPoints}
            showAllFlag={showAll.points}
            toggleShowAll={() => setShowAll((s) => ({ ...s, points: !s.points }))}
            renderRow={(p, i) => {
              const player = playerMap.get(p.playerId);
              if (!player) return null;
              return (
                <StatRow
                  key={p.playerId}
                  rank={i + 1}
                  player={player}
                  value={p.avg.toFixed(2)}
                  subtext={`${p.points}pt / ${p.games}w`}
                  meetsThreshold={p.meetsThreshold}
                />
              );
            }}
          />
        </StatCard>

        {/* TOPSCOORDER - MET PLAATJE */}
        <StatCard
          title="Topscoorder"
          icon={
            <img
              src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png"
              alt="Topscoorder"
              className="w-12 h-12 object-contain"
            />
          }
        >
          <StatList
            data={topScorers}
            showAllFlag={showAll.scorers}
            toggleShowAll={() => setShowAll((s) => ({ ...s, scorers: !s.scorers }))}
            renderRow={(p, i) => {
              const player = playerMap.get(p.playerId);
              if (!player) return null;
              return (
                <StatRow
                  key={p.playerId}
                  rank={i + 1}
                  player={player}
                  value={p.avg.toFixed(2)}
                  subtext={`${p.goals}d / ${p.games}w`}
                  meetsThreshold={p.meetsThreshold}
                />
              );
            }}
          />
        </StatCard>

        {/* BESTE VERDEDIGER - MET PLAATJE + ✅ NIEUWE TOGGLE */}
        <StatCard
          title="Beste verdediger"
          icon={
            <img
              src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png"
              alt="Beste verdediger"
              className="w-12 h-12 object-contain"
            />
          }
          headerRight={
            <SmallToggle
              checked={defenseKeepersOnly}
              onChange={() => setDefenseKeepersOnly((v) => !v)}
              label="Alleen keepers"
            />
          }
        >
          <StatList
            data={bestDefenseForDisplay}
            showAllFlag={showAll.defense}
            toggleShowAll={() => setShowAll((s) => ({ ...s, defense: !s.defense }))}
            renderRow={(p, i) => {
              const player = playerMap.get(p.playerId);
              if (!player) return null;
              return (
                <StatRow
                  key={p.playerId}
                  rank={i + 1}
                  player={player}
                  value={p.avg.toFixed(2)}
                  subtext={`${p.games} wedstrijden`}
                  meetsThreshold={p.meetsThreshold}
                />
              );
            }}
          />
        </StatCard>

        <StatCard title="Meest aanwezig" icon={<UsersIcon className="w-6 h-6 text-green-400" />}>
          <p className="text-gray-400 text-sm italic mb-3 -mt-1">
            Er zijn {totalSessions} speelavonden geweest
          </p>
          <StatList
            data={mostAttended}
            showAllFlag={showAll.attendance}
            toggleShowAll={() => setShowAll((s) => ({ ...s, attendance: !s.attendance }))}
            renderRow={(p, i) => {
              const player = playerMap.get(p.playerId);
              if (!player) return null;
              return (
                <StatRow
                  key={p.playerId}
                  rank={i + 1}
                  player={player}
                  value={`${p.count}x`}
                  subtext={`${p.percentage.toFixed(0)}%`}
                  meetsThreshold={p.meetsThreshold}
                />
              );
            }}
          />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatCard title="Aanwezigheids Trend" icon={<ChartBarIcon className="w-6 h-6 text-cyan-400" />}>
          <AttendanceChart data={attendanceHistory} />
        </StatCard>
        <StatCard
          title="Balans van Teams (Gem. Doelsaldo)"
          icon={<ChartBarIcon className="w-6 h-6 text-fuchsia-400" />}
        >
          <GoalDifferenceChart data={goalDifferenceHistory} />
        </StatCard>
      </div>
    </>
  );
};

export default Statistics;
