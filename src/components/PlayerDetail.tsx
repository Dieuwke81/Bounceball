import React, { useMemo, useState } from 'react';
import type {
  Player,
  GameSession,
  RatingLogEntry,
  Trophy,
  TrophyType,
  MatchResult,
} from '../types';

import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import UsersIcon from './icons/UsersIcon';
import PrinterIcon from './icons/PrinterIcon';

import RatingChart from './RatingChart';
import PlayerPrintView from './PlayerPrintView';

/* ============================================================================
 * Helpers
 * ========================================================================== */

const toMs = (d: string) => {
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const matchScore = (m: MatchResult) => {
  const s1 = m.team1Goals.reduce((sum, g) => sum + (g?.count || 0), 0);
  const s2 = m.team2Goals.reduce((sum, g) => sum + (g?.count || 0), 0);
  return { s1, s2 };
};

const buildAllTimeFromLogs = (
  playerId: number,
  ratingLogs: RatingLogEntry[]
) => {
  return (ratingLogs || [])
    .filter((l) => l.playerId === playerId)
    .map((l) => ({ date: String(l.date), rating: Number(l.rating) }))
    .filter((x) => Number.isFinite(toMs(x.date)) && Number.isFinite(x.rating))
    .sort((a, b) => toMs(a.date) - toMs(b.date));
};

const buildSeasonFromLogs = (params: {
  player: Player;
  ratingLogs: RatingLogEntry[];
  seasonStartDate: string;
}) => {
  const { player, ratingLogs, seasonStartDate } = params;
  const startMs = toMs(seasonStartDate);
  if (!startMs) return [];

  const all = buildAllTimeFromLogs(player.id, ratingLogs);

  const before = all.filter((p) => toMs(p.date) < startMs);
  const lastBefore = before.length ? before[before.length - 1].rating : undefined;

  const startRating =
    lastBefore ?? player.startRating ?? player.rating ?? 1;

  const seasonLogs = all.filter((p) => toMs(p.date) >= startMs);

  const combined = [
    { date: seasonStartDate, rating: Number(startRating.toFixed(2)) },
    ...seasonLogs,
  ];

  const seen = new Set<number>();
  return combined
    .filter((p) => {
      const ms = toMs(p.date);
      if (!ms || seen.has(ms)) return false;
      seen.add(ms);
      return true;
    })
    .sort((a, b) => toMs(a.date) - toMs(b.date));
};

/* ============================================================================
 * UI helpers
 * ========================================================================== */

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtext?: string;
}> = ({ title, value, subtext }) => (
  <div className="bg-gray-700 p-4 rounded-lg text-center">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="text-3xl font-bold text-white">{value}</p>
    {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
  </div>
);

const RelationshipList: React.FC<{
  title: string;
  data: [number, number][];
  playerMap: Map<number, Player>;
  icon: React.ReactNode;
}> = ({ title, data, playerMap, icon }) => (
  <div>
    <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2">
      {icon}
      <span className="ml-2">{title}</span>
    </h4>
    {data.length ? (
      <ul className="space-y-1.5">
        {data.slice(0, 5).map(([id, count]) => {
          const p = playerMap.get(id);
          if (!p) return null;
          return (
            <li
              key={id}
              className="flex justify-between text-sm text-gray-300"
            >
              <span className="truncate">{p.name}</span>
              <span className="font-mono bg-gray-600 text-xs px-2 py-0.5 rounded-full">
                {count}x
              </span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-gray-500 text-xs text-center py-2">Geen data</p>
    )}
  </div>
);

/* ============================================================================
 * Component
 * ========================================================================== */

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[];
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[];
  seasonStartDate?: string;
  onBack: () => void;
}

const PlayerDetail: React.FC<PlayerDetailProps> = ({
  player,
  history,
  players,
  ratingLogs,
  trophies,
  seasonStartDate,
  onBack,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  /* ===================== Stats ===================== */

  const stats = useMemo(() => {
    let wins = 0,
      losses = 0,
      draws = 0,
      points = 0,
      gamesPlayed = 0,
      goalsScored = 0;

    const teammateFreq = new Map<number, number>();
    const teammateWins = new Map<number, number>();
    const teammateLosses = new Map<number, number>();
    const opponentWins = new Map<number, number>();
    const opponentLosses = new Map<number, number>();

    const processMatch = (teams: Player[][], match: MatchResult) => {
      const teamIndex = teams.findIndex((t) =>
        t.some((p) => p.id === player.id)
      );
      if (teamIndex < 0) return;

      const { s1, s2 } = matchScore(match);
      const isTeam1 = match.team1Index === teamIndex;
      const isTeam2 = match.team2Index === teamIndex;
      if (!isTeam1 && !isTeam2) return;

      gamesPlayed++;

      const myGoals = isTeam1 ? match.team1Goals : match.team2Goals;
      const oppGoals = isTeam1 ? match.team2Goals : match.team1Goals;

      goalsScored +=
        myGoals.find((g) => g.playerId === player.id)?.count || 0;

      const myScore = myGoals.reduce((s, g) => s + g.count, 0);
      const oppScore = oppGoals.reduce((s, g) => s + g.count, 0);

      if (myScore > oppScore) {
        wins++;
        points += 3;
      } else if (oppScore > myScore) {
        losses++;
      } else {
        draws++;
        points += 1;
      }

      const teammates = teams[teamIndex].filter((p) => p.id !== player.id);
      const opponents =
        teams[isTeam1 ? match.team2Index : match.team1Index];

      teammates.forEach((t) => {
        teammateFreq.set(t.id, (teammateFreq.get(t.id) || 0) + 1);
        if (myScore > oppScore)
          teammateWins.set(t.id, (teammateWins.get(t.id) || 0) + 1);
        else if (oppScore > myScore)
          teammateLosses.set(t.id, (teammateLosses.get(t.id) || 0) + 1);
      });

      opponents.forEach((o) => {
        if (myScore > oppScore)
          opponentWins.set(o.id, (opponentWins.get(o.id) || 0) + 1);
        else if (oppScore > myScore)
          opponentLosses.set(o.id, (opponentLosses.get(o.id) || 0) + 1);
      });
    };

    history.forEach((s) => {
      const t1 = s.teams || [];
      const t2 = s.round2Teams ?? s.teams ?? [];
      s.round1Results?.forEach((m) => processMatch(t1, m));
      s.round2Results?.forEach((m) => processMatch(t2, m));
    });

    return {
      wins,
      losses,
      draws,
      points,
      gamesPlayed,
      goalsScored,
      mostFrequentTeammates: [...teammateFreq.entries()].sort((a, b) => b[1] - a[1]),
      bestTeammates: [...teammateWins.entries()].sort((a, b) => b[1] - a[1]),
      worstTeammates: [...teammateLosses.entries()].sort((a, b) => b[1] - a[1]),
      bestOpponents: [...opponentWins.entries()].sort((a, b) => b[1] - a[1]),
      worstOpponents: [...opponentLosses.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [player.id, history]);

  /* ===================== Ratings ===================== */

  const allTimeRatingHistory = useMemo(
    () => buildAllTimeFromLogs(player.id, ratingLogs),
    [player.id, ratingLogs]
  );

  const seasonRatingHistory = useMemo(() => {
    if (!seasonStartDate) return allTimeRatingHistory;
    const s = buildSeasonFromLogs({ player, ratingLogs, seasonStartDate });
    return s.length ? s : allTimeRatingHistory;
  }, [player, ratingLogs, seasonStartDate, allTimeRatingHistory]);

  const avgPoints =
    stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0;

  /* ===================== Render ===================== */

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      {isPrinting && (
        <PlayerPrintView
          player={player}
          stats={stats}
          trophies={trophies.filter((t) => t.playerId === player.id)}
          players={players}
          seasonHistory={seasonRatingHistory}
          allTimeHistory={allTimeRatingHistory}
          onClose={() => setIsPrinting(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>

        <button
          onClick={() => setIsPrinting(true)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
        >
          <PrinterIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Gespeeld" value={stats.gamesPlayed} />
        <StatCard
          title="Resultaten"
          value={`${stats.wins}W • ${stats.draws}G • ${stats.losses}V`}
        />
        <StatCard title="Goals" value={stats.goalsScored} />
        <StatCard
          title="Gem. Punten"
          value={avgPoints.toFixed(2)}
          subtext={`Totaal: ${stats.points}`}
        />
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h4 className="flex items-center font-semibold mb-2">
          <ChartBarIcon className="w-5 h-5 text-green-400 mr-2" />
          All-time Rating
        </h4>
        <RatingChart data={allTimeRatingHistory} />
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h4 className="flex items-center font-semibold mb-2">
          <ChartBarIcon className="w-5 h-5 text-cyan-400 mr-2" />
          Seizoen Rating
        </h4>
        <RatingChart data={seasonRatingHistory} />
      </div>

      <RelationshipList
        title="Vaakste Medespelers"
        data={stats.mostFrequentTeammates}
        playerMap={playerMap}
        icon={<UsersIcon className="w-5 h-5 text-cyan-400" />}
      />
    </div>
  );
};

export default PlayerDetail;
