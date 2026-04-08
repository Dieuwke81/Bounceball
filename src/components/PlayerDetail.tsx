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
  seasonStartDate?: string;     
  competitionName?: string | null; 
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
  data: { id: number; label: string; percentage: number }[];
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
        {data.slice(0, 5).map((item) => {
          const relatedPlayer = playerMap.get(item.id);
          if (!relatedPlayer) return null;
          return (
            <li key={item.id} className="flex justify-between items-center text-sm text-gray-300">
              <div className="flex flex-col truncate">
                <span className="truncate font-medium">{relatedPlayer.name}</span>
                <span className="text-[10px] text-gray-500">{item.label}</span>
              </div>
              <span className={`font-mono text-xs px-2 py-0.5 rounded-full ml-2 ${item.percentage > 50 && (title.includes('Afgrond') || title.includes('Nachtmerrie')) ? 'bg-red-900/40 text-red-200' : 'bg-gray-600 text-gray-200'}`}>
                {item.percentage}%
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

const toMs = (d: string) => {
  if (!d) return 0;
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const PlayerDetail: React.FC<PlayerDetailProps> = ({
  player,
  history,
  players,
  ratingLogs,
  trophies,
  seasonStartDate,
  competitionName,
  onBack,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const playerTrophies = useMemo(() => {
    if (!trophies) return [];
    return trophies
      .filter((t) => t.playerId === player.id)
      .sort((a, b) => {
        const yearA = Number((a.year || "").match(/\d{4}/)?.[0]) || 0;
        const yearB = Number((b.year || "").match(/\d{4}/)?.[0]) || 0;
        return yearA !== yearB ? yearB - yearA : (b.year || "").localeCompare(a.year || "");
      });
  }, [trophies, player.id]);

  const getTrophyTitleStyle = (type: TrophyType) => {
    if (type.includes('1ste') || type === 'Clubkampioen') {
      return 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-300 to-yellow-600';
    }
    if (type.includes('2de')) return 'text-slate-400';
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
    const url = images[type];
    if (url) return <img src={url} alt={type} className="w-8 h-8 object-contain" />;
    return type === 'Verdediger' ? <ShieldIcon className="w-6 h-6" /> : <TrophyIcon className="w-6 h-6" />;
  };

  const stats = useMemo(() => {
    let wins = 0, losses = 0, draws = 0, points = 0, gamesPlayed = 0, goalsScored = 0;
    const teammateResults = new Map<number, { pts: number; games: number; wins: number; losses: number }>();
    const opponentResults = new Map<number, { pts: number; games: number; wins: number; losses: number }>();

    const updateRecord = (map: Map<number, any>, id: number, p: number, isWin: boolean, isLoss: boolean) => {
      const cur = map.get(id) || { pts: 0, games: 0, wins: 0, losses: 0 };
      map.set(id, { 
        pts: cur.pts + p, 
        games: cur.games + 1, 
        wins: cur.wins + (isWin ? 1 : 0),
        losses: cur.losses + (isLoss ? 1 : 0)
      });
    };

    history.forEach((session) => {
      if (!session) return;
      const process = (teams: Player[][], results: MatchResult[]) => {
        results?.forEach(m => {
          const myTIdx = teams.findIndex(t => t.some(p => p.id === player.id));
          if (myTIdx < 0) return;
          const isT1 = m.team1Index === myTIdx;
          const myTeam = teams[myTIdx];
          const oppTeam = teams[isT1 ? m.team2Index : m.team1Index];
          if (!myTeam || !oppTeam) return;

          const s1 = (m.team1Goals || []).reduce((acc, g) => acc + (g?.count || 0), 0);
          const s2 = (m.team2Goals || []).reduce((acc, g) => acc + (g?.count || 0), 0);
          const myS = isT1 ? s1 : s2;
          const oppS = isT1 ? s2 : s1;

          let p = 0, w = false, l = false;
          if (myS > oppS) { p = 3; w = true; } 
          else if (myS < oppS) { l = true; }
          else { p = 1; }

          if (teams === session.teams || teams === (session as any).round2Teams) {
            gamesPlayed++;
            const g = (isT1 ? m.team1Goals : m.team2Goals)?.find(goal => goal.playerId === player.id);
            goalsScored += (g?.count || 0);
            if (w) { wins++; points += 3; } else if (myS === oppS) { draws++; points += 1; } else losses++;
          }

          myTeam.forEach(pl => { if (pl.id !== player.id) updateRecord(teammateResults, pl.id, p, w, l); });
          oppTeam.forEach(pl => updateRecord(opponentResults, pl.id, p, w, l));
        });
      };
      process(session.teams || [], session.round1Results || []);
      process((session as any).round2Teams ?? session.teams ?? [], session.round2Results || []);
    });

    const getWinList = (resMap: Map<number, any>) => {
      return [...resMap.entries()].map(([id, data]) => {
        const perc = Math.round((data.wins / data.games) * 100);
        const score = (data.pts + 3) / (data.games + 2);
        return { id, percentage: perc, label: `${data.wins}W - ${data.losses}V`, score };
      }).sort((a, b) => b.score - a.score);
    };

    const getLossList = (resMap: Map<number, any>) => {
      return [...resMap.entries()].map(([id, data]) => {
        const perc = Math.round((data.losses / data.games) * 100);
        const score = (data.pts + 3) / (data.games + 2);
        return { id, percentage: perc, label: `${data.losses}V - ${data.wins}W`, score };
      }).sort((a, b) => a.score - b.score);
    };

    return {
      wins, losses, draws, points, gamesPlayed, goalsScored,
      bestT: getWinList(teammateResults),
      worstT: getLossList(teammateResults),
      bestO: getWinList(opponentResults),
      worstO: getLossList(opponentResults),
      freq: [...teammateResults.entries()].map(([id, d]) => ({ 
        id, 
        percentage: Math.round((d.games / Math.max(1, gamesPlayed)) * 100), 
        label: `${d.games}x samen`, 
        score: d.games 
      })).sort((a, b) => b.score - a.score)
    };
  }, [player.id, history]);

  const allTimeRatingHistory = useMemo(() => {
    return (ratingLogs || [])
      .filter((l) => l.playerId === player.id)
      .map((l) => ({ date: String(l.date), rating: Number(l.rating) }))
      .sort((a, b) => toMs(a.date) - toMs(b.date));
  }, [player.id, ratingLogs]);

  const seasonRatingHistory = useMemo(() => {
    if (!seasonStartDate) return allTimeRatingHistory;
    const startMs = toMs(seasonStartDate);
    return allTimeRatingHistory.filter(r => toMs(r.date) >= startMs);
  }, [allTimeRatingHistory, seasonStartDate]);

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      {isPrinting && (
        <PlayerPrintView
          player={player} stats={stats} trophies={playerTrophies} players={players}
          history={history} seasonHistory={seasonRatingHistory} allTimeHistory={allTimeRatingHistory}
          competitionName={competitionName || ''} onClose={() => setIsPrinting(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 mr-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"><ArrowLeftIcon className="w-6 h-6" /></button>
          {player.photoBase64 && <img src={player.photoBase64} alt={player.name} className="w-16 h-16 rounded-full object-cover mr-4 border-2 border-cyan-400" />}
          <div>
            <h2 className="text-3xl font-bold text-white">{player.name}</h2>
            <div className="flex items-center mt-1">
              <span className="text-lg font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">{player.rating.toFixed(1)}</span>
              {player.isKeeper && <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">K</span>}
              {player.isFixedMember && <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">Lid</span>}
            </div>
          </div>
        </div>
        <button onClick={() => setIsPrinting(true)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors"><PrinterIcon className="w-6 h-6" /></button>
      </div>

      {playerTrophies.length > 0 && (
        <div className="mb-8 p-4 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl border border-gray-600/50">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center"><div className="w-5 h-5 mr-2 text-yellow-400"><TrophyIcon className="w-full h-full"/></div>Prijzenkast</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playerTrophies.map((t) => (
              <div key={t.id} className="flex items-center p-3 rounded-lg border border-gray-600 bg-gray-800/40">
                <div className="mr-3">{getTrophyContent(t.type)}</div>
                <div>
                  <div className={`font-bold text-sm leading-tight ${getTrophyTitleStyle(t.type)}`}>{t.type}</div>
                  <div className="text-xs text-gray-400">{t.year}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Gespeeld" value={stats.gamesPlayed} />
        <StatCard title="Resultaten" value={`${stats.wins}W • ${stats.draws}G • ${stats.losses}V`} subtext={`van ${stats.gamesPlayed}`} />
        <StatCard title="Goals" value={stats.goalsScored} subtext={`${(stats.goalsScored / Math.max(1, stats.gamesPlayed)).toFixed(2)} gem.`} />
        <StatCard title="Gem. Punten" value={(stats.points / Math.max(1, stats.gamesPlayed)).toFixed(2)} subtext={`Totaal: ${stats.points}`} />
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-8">
        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2"><ChartBarIcon className="w-5 h-5 text-green-400" /><span className="ml-2">All-time Rating Verloop</span></h4>
        <RatingChart data={allTimeRatingHistory} />
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-8">
        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2"><ChartBarIcon className="w-5 h-5 text-cyan-400" /><span className="ml-2">Seizoen Rating Verloop</span></h4>
        <RatingChart data={seasonRatingHistory} />
      </div>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <RelationshipList title="Plakfactor: Onlosmakelijk" data={stats.freq} playerMap={playerMap} icon={<UsersIcon className="w-5 h-5 text-cyan-400" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RelationshipList title="Gouden Duo (Winstgarantie)" data={stats.bestT} playerMap={playerMap} icon={<TrophyIcon className="w-6 h-6 text-green-400" />} />
        <RelationshipList title="Samen de Afgrond in..." data={stats.worstT} playerMap={playerMap} icon={<ShieldIcon className="w-6 h-6 text-red-400" />} />
        <RelationshipList title="Mijn Favoriete Slachtoffer" data={stats.bestO} playerMap={playerMap} icon={<TrophyIcon className="w-5 h-5 text-green-400" />} />
        <RelationshipList title="Mijn Persoonlijke Nachtmerrie" data={stats.worstO} playerMap={playerMap} icon={<ShieldIcon className="w-5 h-5 text-red-400" />} />
      </div>
    </div>
  );
};

export default PlayerDetail;
