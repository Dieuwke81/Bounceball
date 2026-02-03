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

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[];
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[];
  seasonStartDate?: string;     // Toegevoegd om errors te voorkomen
  competitionName?: string | null; // Toegevoegd om errors te voorkomen
  onBack: () => void;
}

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
    {data.length > 0 ? (
      <ul className="space-y-1.5 pl-1">
        {data.slice(0, 5).map(([id, count]) => {
          const relatedPlayer = playerMap.get(id);
          if (!relatedPlayer) return null;
          return (
            <li
              key={id}
              className="flex justify-between items-center text-sm text-gray-300"
            >
              <span className="truncate">{relatedPlayer.name}</span>
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

// Helper: veilige datum parse
const toMs = (d: string) => {
  if (!d) return 0;
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

// Helper: scores uit MatchResult (VEILIG GEMAAKT)
const matchScore = (m: MatchResult) => {
  // 🛡️ CRASH PREVENTIE: Gebruik || [] voor het geval goals ontbreken
  const goals1 = m.team1Goals || [];
  const goals2 = m.team2Goals || [];
  const s1 = goals1.reduce((sum, g) => sum + (g?.count || 0), 0);
  const s2 = goals2.reduce((sum, g) => sum + (g?.count || 0), 0);
  return { s1, s2 };
};

const PlayerDetail: React.FC<PlayerDetailProps> = ({
  player,
  history,
  players,
  ratingLogs,
  trophies,
  seasonStartDate, // Wordt nu geaccepteerd maar niet verplicht gebruikt
  competitionName, // Wordt nu geaccepteerd
  onBack,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const playerTrophies = useMemo(() => {
    if (!trophies) return [];
    return trophies
      .filter((t) => t.playerId === player.id)
      .sort((a, b) => {
        const yearA = Number((a.year || "").match(/\d{4}/)?.[0]) || 0;
        const yearB = Number((b.year || "").match(/\d{4}/)?.[0]) || 0;
        if (yearA !== yearB) return yearB - yearA;
        return (b.year || "").localeCompare(a.year || "");
      });
  }, [trophies, player.id]);

  const getTrophyStyle = (type: TrophyType) => {
    if (type.includes('1ste') || type === 'Clubkampioen') {
      return 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-300 to-yellow-600';
    }
    if (type.includes('2de')) return 'text-slate-500';
    if (type.includes('3de')) return 'text-amber-700';
    if (type === 'Topscoorder') return 'text-yellow-300';
    if (type === 'Verdediger') return 'text-red-500';
    if (type === 'Speler van het jaar') return 'text-green-500';
    return 'text-white';
  };

  const getTrophyContent = (type: TrophyType) => {
    const images: { [key: string]: string } = {
      Verdediger: 'https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png',
      Topscoorder: 'https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png',
      Clubkampioen: 'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png',
      '2de': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
      'Speler van het jaar': 'https://i.postimg.cc/76pPxbqT/Zonder-titel-(200-x-200-px)-20251203-124822-0000.png',
      '1ste Introductietoernooi': 'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',
      '2de Introductietoernooi': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de Introductietoernooi': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
      '1ste NK': 'https://i.postimg.cc/GhXMP4q5/20251203-184928-0000.png',
      '2de NK': 'https://i.postimg.cc/wM0kkrcm/20251203-185040-0000.png',
      '3de NK': 'https://i.postimg.cc/MpcYydnC/20251203-185158-0000.png',
      '1ste Wintertoernooi': 'https://i.postimg.cc/YqWQ7mfx/Zonder-titel-(200-x-200-px)-20251203-123448-0000.png',
      '2de Wintertoernooi': 'https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png',
      '3de Wintertoernooi': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png',
    };

    const imageUrl = images[type];
    if (imageUrl) return <img src={imageUrl} alt={type} className="w-8 h-8 object-contain" />;
    if (type === 'Verdediger') return <ShieldIcon className="w-6 h-6" />;
    return <TrophyIcon className="w-6 h-6" />;
  };

  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let points = 0;
    let gamesPlayed = 0;
    let goalsScored = 0;

    const teammateFrequency = new Map<number, number>();
    const teammateWins = new Map<number, number>();
    const teammateLosses = new Map<number, number>();
    const opponentWins = new Map<number, number>();
    const opponentLosses = new Map<number, number>();

    const processMatch = (
      sessionTeams: Player[][],
      match: MatchResult,
      roundLabel: 'r1' | 'r2'
    ) => {
      // 🛡️ CRASH PREVENTIE: Check of data bestaat
      if (!sessionTeams || !match) return;

      const playerTeamIndex = sessionTeams.findIndex((team) =>
        Array.isArray(team) && team.some((p) => p.id === player.id)
      );
      if (playerTeamIndex < 0) return;

      const { s1, s2 } = matchScore(match);

      const isTeam1 = match.team1Index === playerTeamIndex;
      const isTeam2 = match.team2Index === playerTeamIndex;
      if (!isTeam1 && !isTeam2) return;

      const opponentTeamIndex = isTeam1 ? match.team2Index : match.team1Index;
      // 🛡️ CRASH PREVENTIE: Check of tegenstander bestaat
      if (!sessionTeams[opponentTeamIndex]) return;

      gamesPlayed++;

      const playerTeamGoalsList = (isTeam1 ? match.team1Goals : match.team2Goals) || [];
      const opponentTeamGoalsList = (isTeam1 ? match.team2Goals : match.team1Goals) || [];

      const playerGoalCount =
        playerTeamGoalsList.find((g) => g.playerId === player.id)?.count || 0;
      goalsScored += playerGoalCount;

      const playerTeamScore = playerTeamGoalsList.reduce((sum, g) => sum + (g?.count || 0), 0);
      const opponentTeamScore = opponentTeamGoalsList.reduce((sum, g) => sum + (g?.count || 0), 0);

      if (playerTeamScore > opponentTeamScore) {
        wins++;
        points += 3;
      } else if (opponentTeamScore > playerTeamScore) {
        losses++;
      } else {
        draws++;
        points += 1;
      }

      const myTeam = sessionTeams[playerTeamIndex];
      const oppTeam = sessionTeams[opponentTeamIndex];
      
      if (!myTeam || !oppTeam) return;

      const teammates = myTeam.filter((p) => p.id !== player.id);
      const opponents = oppTeam;

      teammates.forEach((tm) => {
        teammateFrequency.set(tm.id, (teammateFrequency.get(tm.id) || 0) + 1);
        if (playerTeamScore > opponentTeamScore) {
          teammateWins.set(tm.id, (teammateWins.get(tm.id) || 0) + 1);
        } else if (opponentTeamScore > playerTeamScore) {
          teammateLosses.set(tm.id, (teammateLosses.get(tm.id) || 0) + 1);
        }
      });

      opponents.forEach((op) => {
        if (playerTeamScore > opponentTeamScore) {
          opponentWins.set(op.id, (opponentWins.get(op.id) || 0) + 1);
        } else if (opponentTeamScore > playerTeamScore) {
          opponentLosses.set(op.id, (opponentLosses.get(op.id) || 0) + 1);
        }
      });
    };

    history.forEach((session) => {
      if (!session) return;
      const teamsR1 = session.teams || [];
      const teamsR2 = session.round2Teams ?? session.teams ?? [];

      (session.round1Results || []).forEach((m) => processMatch(teamsR1, m, 'r1'));
      (session.round2Results || []).forEach((m) => processMatch(teamsR2, m, 'r2'));
    });

    const bestTeammates = [...teammateWins.entries()].sort((a, b) => b[1] - a[1]);
    const worstTeammates = [...teammateLosses.entries()].sort((a, b) => b[1] - a[1]);
    const bestOpponents = [...opponentWins.entries()].sort((a, b) => b[1] - a[1]);
    const worstOpponents = [...opponentLosses.entries()].sort((a, b) => b[1] - a[1]);
    const mostFrequentTeammates = [...teammateFrequency.entries()].sort(
      (a, b) => b[1] - a[1]
    );

    return {
      wins,
      losses,
      draws,
      points,
      gamesPlayed,
      goalsScored,
      bestTeammates,
      worstTeammates,
      bestOpponents,
      worstOpponents,
      mostFrequentTeammates,
    };
  }, [player.id, history]);

  // Voorbereiding data voor grafieken (veilig)
  const allTimeRatingHistory = useMemo(() => {
    return (ratingLogs || [])
      .filter((l) => l.playerId === player.id)
      .map((l) => ({ date: String(l.date), rating: Number(l.rating) }))
      .sort((a, b) => toMs(a.date) - toMs(b.date));
  }, [player.id, ratingLogs]);

  // Season history (versimpeld om crash te voorkomen)
  const seasonRatingHistory = useMemo(() => {
    if (!seasonStartDate) return allTimeRatingHistory;
    const startMs = toMs(seasonStartDate);
    return allTimeRatingHistory.filter(r => toMs(r.date) >= startMs);
  }, [allTimeRatingHistory, seasonStartDate]);

  const avgPoints = stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0;

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      {isPrinting && (
        <PlayerPrintView
          player={player}
          stats={stats}
          trophies={playerTrophies}
          players={players}
          history={history}
          seasonHistory={seasonRatingHistory}
          allTimeHistory={allTimeRatingHistory}
          competitionName={competitionName || ''}
          onClose={() => setIsPrinting(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 mr-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>

          {player.photoBase64 && (
            <img
              src={player.photoBase64}
              alt={player.name}
              className="w-16 h-16 rounded-full object-cover mr-4 border-2 border-cyan-400"
            />
          )}

          <div>
            <h2 className="text-3xl font-bold text-white">{player.name}</h2>
            <div className="flex items-center mt-1">
              <span className="text-lg font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">
                {player.rating.toFixed(1)}
              </span>
              {player.isKeeper && (
                <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">
                  K
                </span>
              )}
              {player.isFixedMember && (
                <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">
                  Lid
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsPrinting(true)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors"
          title="Spelersprofiel Printen"
        >
          <PrinterIcon className="w-6 h-6" />
        </button>
      </div>

      {playerTrophies.length > 0 && (
        <div className="mb-8 p-4 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl border border-gray-600/50">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
            <div className="w-5 h-5 mr-2 text-yellow-400">
                <TrophyIcon className="w-full h-full"/>
            </div>
            Prijzenkast
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playerTrophies.map((trophy) => (
              <div
                key={trophy.id}
                className={`flex items-center p-3 rounded-lg border ${getTrophyStyle(
                  trophy.type
                )}`}
              >
                <div className="mr-3">{getTrophyContent(trophy.type)}</div>
                <div>
                  <div className="font-bold text-sm">{trophy.type}</div>
                  <div className="text-xs opacity-80">{trophy.year}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Gespeeld" value={stats.gamesPlayed} />
       <StatCard
          title="Resultaten"
          value={`${stats.wins}W • ${stats.draws}G • ${stats.losses}V`}
          subtext={`van ${stats.gamesPlayed}`}
        />
        <StatCard
          title="Goals"
          value={stats.goalsScored}
          subtext={`${(stats.goalsScored / (stats.gamesPlayed || 1)).toFixed(2)} gem.`}
        />
        <StatCard
          title="Gem. Punten"
          value={avgPoints.toFixed(2)}
          subtext={`Totaal: ${stats.points}`}
        />
      </div>

      {/* ALL-TIME */}
      <div className="bg-gray-700 p-4 rounded-lg mb-8">
        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2">
          <ChartBarIcon className="w-5 h-5 text-green-400" />
          <span className="ml-2">All-time Rating Verloop</span>
        </h4>
        {allTimeRatingHistory.length > 1 ? (
          <RatingChart data={allTimeRatingHistory} />
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">
            Nog niet genoeg all-time data (rating logs).
          </p>
        )}
      </div>

      {/* SEIZOEN */}
      <div className="bg-gray-700 p-4 rounded-lg mb-8">
        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2">
          <ChartBarIcon className="w-5 h-5 text-cyan-400" />
          <span className="ml-2">Seizoen Rating Verloop</span>
        </h4>
        {seasonRatingHistory.length > 1 ? (
          <RatingChart data={seasonRatingHistory} />
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">
            Nog niet genoeg seizoensdata.
          </p>
        )}
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <RelationshipList
          title="Vaakste Medespeler (Top 5)"
          data={stats.mostFrequentTeammates}
          playerMap={playerMap}
          icon={<UsersIcon className="w-5 h-5 text-cyan-400" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RelationshipList
          title="Beste Medespelers"
          data={stats.bestTeammates}
          playerMap={playerMap}
          icon={<TrophyIcon className="w-5 h-5 text-green-400" />}
        />
        <RelationshipList
          title="Lastige Medespelers"
          data={stats.worstTeammates}
          playerMap={playerMap}
          icon={<ShieldIcon className="w-5 h-5 text-red-400" />}
        />
        <RelationshipList
          title="Makkelijke Tegenstanders"
          data={stats.bestOpponents}
          playerMap={playerMap}
          icon={<TrophyIcon className="w-5 h-5 text-green-400" />}
        />
        <RelationshipList
          title="Moeilijke Tegenstanders"
          data={stats.worstOpponents}
          playerMap={playerMap}
          icon={<ShieldIcon className="w-5 h-5 text-red-400" />}
        />
      </div>
    </div>
  );
};

export default PlayerDetail;
