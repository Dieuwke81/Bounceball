import React, { useMemo } from 'react';
import type { Player, GameSession, RatingLogEntry } from '../types';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import RatingChart from './RatingChart';
import UsersIcon from './icons/UsersIcon';

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[];
  ratingLogs: RatingLogEntry[];
  onBack: () => void;
}

const StatCard: React.FC<{title: string, value: string | number, subtext?: string}> = ({title, value, subtext}) => (
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
            <li key={id} className="flex justify-between items-center text-sm text-gray-300">
              <span className="truncate">{relatedPlayer.name}</span>
              <span className="font-mono bg-gray-600 text-xs px-2 py-0.5 rounded-full">{count}x</span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-gray-500 text-xs text-center py-2">Geen data</p>
    )}
  </div>
);


const PlayerDetail: React.FC<PlayerDetailProps> = ({ player, history, players, ratingLogs, onBack }) => {
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const stats = useMemo(() => {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let gamesPlayed = 0;
        let goalsScored = 0;
        const teammateFrequency = new Map<number, number>();
        const teammateWins = new Map<number, number>();
        const teammateLosses = new Map<number, number>();
        const opponentWins = new Map<number, number>();
        const opponentLosses = new Map<number, number>();

        history.forEach(session => {
            let playerTeamIndex: number | null = null;
            session.teams.forEach((team, index) => {
                if (team.some(p => p.id === player.id)) {
                    playerTeamIndex = index;
                }
            });

            if (playerTeamIndex === null) return;

            [...session.round1Results, ...session.round2Results].forEach(match => {
                let opponentTeamIndex: number | null = null;
                let isParticipating = false;
                
                if (match.team1Index === playerTeamIndex) {
                    opponentTeamIndex = match.team2Index;
                    isParticipating = true;
                } else if (match.team2Index === playerTeamIndex) {
                    opponentTeamIndex = match.team1Index;
                    isParticipating = true;
                }

                if (!isParticipating || opponentTeamIndex === null || !session.teams[opponentTeamIndex]) return;
                
                gamesPlayed++;

                const playerTeamGoalsList = (playerTeamIndex === match.team1Index ? match.team1Goals : match.team2Goals);
                const opponentTeamGoalsList = (opponentTeamIndex === match.team1Index ? match.team1Goals : match.team2Goals);
                
                const playerGoalCount = playerTeamGoalsList.find(g => g.playerId === player.id)?.count || 0;
                goalsScored += playerGoalCount;

                const playerTeamScore = playerTeamGoalsList.reduce((sum, g) => sum + g.count, 0);
                const opponentTeamScore = opponentTeamGoalsList.reduce((sum, g) => sum + g.count, 0);

                if (playerTeamScore > opponentTeamScore) wins++;
                else if (opponentTeamScore > playerTeamScore) losses++;
                else draws++;

                const teammates = session.teams[playerTeamIndex!].filter(p => p.id !== player.id);
                const opponents = session.teams[opponentTeamIndex];

                teammates.forEach(tm => {
                    teammateFrequency.set(tm.id, (teammateFrequency.get(tm.id) || 0) + 1);
                    if (playerTeamScore > opponentTeamScore) {
                        teammateWins.set(tm.id, (teammateWins.get(tm.id) || 0) + 1);
                    } else if (opponentTeamScore > playerTeamScore) {
                        teammateLosses.set(tm.id, (teammateLosses.get(tm.id) || 0) + 1);
                    }
                });

                opponents.forEach(op => {
                    if (playerTeamScore > opponentTeamScore) {
                        opponentWins.set(op.id, (opponentWins.get(op.id) || 0) + 1);
                    } else if (opponentTeamScore > playerTeamScore) {
                        opponentLosses.set(op.id, (opponentLosses.get(op.id) || 0) + 1);
                    }
                });
            });
        });

        const bestTeammates = [...teammateWins.entries()].sort((a, b) => b[1] - a[1]);
        const worstTeammates = [...teammateLosses.entries()].sort((a, b) => b[1] - a[1]);
        const bestOpponents = [...opponentWins.entries()].sort((a, b) => b[1] - a[1]);
        const worstOpponents = [...opponentLosses.entries()].sort((a, b) => b[1] - a[1]);
        const mostFrequentTeammates = [...teammateFrequency.entries()].sort((a, b) => b[1] - a[1]);

        return { wins, losses, draws, gamesPlayed, goalsScored, bestTeammates, worstTeammates, bestOpponents, worstOpponents, mostFrequentTeammates };
    }, [player.id, history]);

    // 1. Berekening Seizoen History (op basis van terugrekenen uit wedstrijden)
    const ratingHistory = useMemo(() => {
        const historyPoints: { date: string; rating: number }[] = [];
        let currentRating = player.rating;
        historyPoints.push({ date: new Date().toISOString(), rating: currentRating });

        history.forEach(session => {
            let playerTeamIndex: number | null = null;
            let sessionDelta = 0;

            const playerInSession = session.teams.flat().some(p => p.id === player.id);
            if (!playerInSession) return;

            session.teams.forEach((team, index) => {
                if (team.some(p => p.id === player.id)) {
                    playerTeamIndex = index;
                }
            });

            if (playerTeamIndex === null) return;
            
            [...session.round1Results, ...session.round2Results].forEach(match => {
                let isParticipating = false;
                let playerTeamScore = 0;
                let opponentTeamScore = 0;

                if (match.team1Index === playerTeamIndex) {
                    isParticipating = true;
                    playerTeamScore = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
                    opponentTeamScore = match.team2Goals.reduce((sum, g) => sum + g.count, 0);
                } else if (match.team2Index === playerTeamIndex) {
                    isParticipating = true;
                    playerTeamScore = match.team2Goals.reduce((sum, g) => sum + g.count, 0);
                    opponentTeamScore = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
                }

                if (isParticipating) {
                    if (playerTeamScore > opponentTeamScore) sessionDelta += 0.1;
                    else if (opponentTeamScore > playerTeamScore) sessionDelta -= 0.1;
                }
            });
            
            const ratingBeforeSession = currentRating - sessionDelta;
            historyPoints.push({ date: session.date, rating: ratingBeforeSession });
            currentRating = ratingBeforeSession;
        });
        
        return historyPoints.reverse();
    }, [player.id, player.rating, history]);

    // 2. Berekening All Time History (op basis van logs uit sheet)
    const allTimeRatingHistory = useMemo(() => {
        // Filter logs voor deze speler
        const logs = ratingLogs
            .filter(log => log.playerId === player.id)
            .map(log => ({ date: log.date, rating: log.rating }));
        
        // Sorteer op datum
        return logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [player.id, ratingLogs]);

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 mr-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
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
                        <span className="text-lg font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">{player.rating.toFixed(1)}</span>
                        {player.isKeeper && <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">K</span>}
                        {player.isFixedMember && <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">Lid</span>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard title="Gespeeld" value={stats.gamesPlayed} />
                <StatCard title="Gewonnen" value={`${Math.round((stats.wins / (stats.gamesPlayed || 1)) * 100)}%`} subtext={`${stats.wins} van ${stats.gamesPlayed}`} />
                <StatCard title="Goals" value={stats.goalsScored} subtext={`${(stats.goalsScored / (stats.gamesPlayed || 1)).toFixed(2)} gem.`} />
                <StatCard title="Vorm" value={`${stats.wins}-${stats.draws}-${stats.losses}`} subtext="W-G-V" />
            </div>

            {/* NIEUWE GRAFIEK BLOK: All-time */}
            <div className="bg-gray-700 p-4 rounded-lg mb-8">
                <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2">
                    <ChartBarIcon className="w-5 h-5 text-green-400" />
                    <span className="ml-2">All-time Rating Verloop</span>
                </h4>
                {allTimeRatingHistory.length > 1 ? (
                    <RatingChart data={allTimeRatingHistory} />
                ) : (
                    <p className="text-gray-500 text-sm text-center py-4">Nog niet genoeg data over meerdere seizoenen.</p>
                )}
            </div>
            
            {/* OUDE GRAFIEK BLOK: Seizoen */}
            <div className="bg-gray-700 p-4 rounded-lg mb-8">
                <h4 className="flex items-center text-md font-semibold text-gray-300 mb-2">
                    <ChartBarIcon className="w-5 h-5 text-cyan-400" />
                    <span className="ml-2">Seizoen Rating Verloop</span>
                </h4>
                <RatingChart data={ratingHistory} />
            </div>

            <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <RelationshipList title="Vaakste Medespeler (Top 5)" data={stats.mostFrequentTeammates} playerMap={playerMap} icon={<UsersIcon className="w-5 h-5 text-cyan-400" />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <RelationshipList title="Beste Medespelers" data={stats.bestTeammates} playerMap={playerMap} icon={<TrophyIcon className="w-5 h-5 text-green-400" />} />
                <RelationshipList title="Lastige Medespelers" data={stats.worstTeammates} playerMap={playerMap} icon={<ShieldIcon className="w-5 h-5 text-red-400" />} />
                <RelationshipList title="Makkelijke Tegenstanders" data={stats.bestOpponents} playerMap={playerMap} icon={<TrophyIcon className="w-5 h-5 text-green-400" />} />
                <RelationshipList title="Moeilijke Tegenstanders" data={stats.worstOpponents} playerMap={playerMap} icon={<ShieldIcon className="w-5 h-5 text-red-400" />} />
            </div>
        </div>
    );
};

export default PlayerDetail;
