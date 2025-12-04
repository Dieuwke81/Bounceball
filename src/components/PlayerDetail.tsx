import React, { useMemo, useState } from 'react';
import type { Player, GameSession, RatingLogEntry, Trophy, TrophyType } from '../types';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import RatingChart from './RatingChart';
import UsersIcon from './icons/UsersIcon';
// Zorg dat dit bestand bestaat (hebben we eerder gemaakt):
import PlayerPrintView from './PlayerPrintView'; 

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[];
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[];
  onBack: () => void;
}

// Klein print icoontje voor in de header
const PrinterIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
);

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


const PlayerDetail: React.FC<PlayerDetailProps> = ({ player, history, players, ratingLogs, trophies, onBack }) => {
    // --- NIEUWE STATE VOOR DE PRINT MODUS ---
    const [showPrint, setShowPrint] = useState(false);
    
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const playerTrophies = useMemo(() => {
        if (!trophies) return [];
        return trophies
            .filter(t => t.playerId === player.id)
            .sort((a, b) => {
                const yearA = Number(a.year.match(/\d{4}/)?.[0]) || 0;
                const yearB = Number(b.year.match(/\d{4}/)?.[0]) || 0;
                if (yearA !== yearB) return yearB - yearA;
                const isWinterA = a.year.toLowerCase().includes('winter');
                const isWinterB = b.year.toLowerCase().includes('winter');
                if (isWinterA && !isWinterB) return -1;
                if (!isWinterA && isWinterB) return 1;
                return b.year.localeCompare(a.year);
            });
    }, [trophies, player.id]);

    const getTrophyStyle = (type: TrophyType) => {
        if (type.includes('1ste') || type === 'Clubkampioen' || type === 'Speler van het jaar') return 'text-yellow-400 border-yellow-500/30 bg-yellow-900/10';
        if (type.includes('2de')) return 'text-gray-300 border-gray-400/30 bg-gray-700/30';
        if (type.includes('3de')) return 'text-amber-600 border-amber-600/30 bg-amber-900/10';
        if (type === 'Topscoorder') return 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10';
        if (type === 'Verdediger') return 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-900/10';
        return 'text-white border-gray-500/30';
    };

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

    const ratingHistory = useMemo(() => {
        const historyPoints: { date: string; rating: number }[] = [];
        let currentRating = player.rating;
        historyPoints.push({ date: 'Nu', rating: currentRating });

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

    const allTimeRatingHistory = useMemo(() => {
        const logs = ratingLogs
            .filter(log => log.playerId === player.id)
            .map(log => ({ date: log.date, rating: log.rating }));
        
        if (logs.length === 0) return [];
        return logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [player.id, ratingLogs]);

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            {/* HEADER */}
            <div className="flex items-center mb-6">
                <div className="flex gap-2 mr-4">
                    {/* TERUG KNOP */}
                    <button onClick={onBack} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    
                    {/* --- NIEUWE PRINT KNOP --- */}
                    <button 
                        onClick={() => setShowPrint(true)} 
                        className="p-2 text-cyan-400 hover:text-cyan-200 hover:bg-gray-700 rounded-full transition-colors"
                        title="Print Statistieken"
                    >
                        <PrinterIcon className="w-6 h-6" />
                    </button>
                    {/* ------------------------- */}
                </div>

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

            {/* PRIJZENKAST BLOK */}
            {playerTrophies.length > 0 && (
                <div className="mb-8 p-4 bg-gradient-to-r from-gray-750 to-gray-800 rounded-xl border border-gray-600/50">
                    <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center">
                        <TrophyIcon className="w-5 h-5 mr-2" /> Prijzenkast
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {playerTrophies.map(trophy => (
                            <div key={trophy.id} className={`flex items-center p-3 rounded-lg border ${getTrophyStyle(trophy.type)}`}>
                                <div className="mr-3">
    {trophy.type === 'Verdediger' ? (
        <img src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png" className="w-8 h-8 object-contain" />
    ) : trophy.type === 'Topscoorder' ? (
        <img src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png" className="w-8 h-8 object-contain" />
    ) : trophy.type === 'Clubkampioen' ? (
        <img src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png" className="w-8 h-8 object-contain" />
    ) : trophy.type === '2de' ? (
        <img src="https://i.postimg.cc/zBgcKf1m/Zonder-titel-(200-x-200-px)-20251203-122554-0000.png" className="w-8 h-8 object-contain" />
    ) : trophy.type === '3de' ? (
        <img src="https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png" className="w-8 h-8 object-contain" />
    ) : (
        <TrophyIcon className="w-6 h-6" />
    )}
</div>
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
                <StatCard title="Gewonnen" value={`${Math.round((stats.wins / (stats.gamesPlayed || 1)) * 100)}%`} subtext={`${stats.wins} van ${stats.gamesPlayed}`} />
                <StatCard title="Goals" value={stats.goalsScored} subtext={`${(stats.goalsScored / (stats.gamesPlayed || 1)).toFixed(2)} gem.`} />
                <StatCard title="Vorm" value={`${stats.wins}-${stats.draws}-${stats.losses}`} subtext="W-G-V" />
            </div>

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

            {/* --- HIER WORDT DE PRINT VIEW GELADEN ALS DE KNOP IS INGEDRUKT --- */}
            {showPrint && (
                <PlayerPrintView 
                    player={player}
                    stats={stats}
                    trophies={playerTrophies}
                    players={players}
                    seasonHistory={ratingHistory}
                    allTimeHistory={allTimeRatingHistory}
                    onClose={() => setShowPrint(false)}
                />
            )}
        </div>
    );
};

export default PlayerDetail;
