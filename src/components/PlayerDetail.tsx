import React, { useMemo, useState } from 'react';
import type { Player, GameSession, RatingLogEntry, Trophy, TrophyType } from '../types';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import RatingChart from './RatingChart';
import UsersIcon from './icons/UsersIcon';
import PrinterIcon from './icons/PrinterIcon';
import PlayerPrintView from './PlayerPrintView';

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[];
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[]; 
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


const PlayerDetail: React.FC<PlayerDetailProps> = ({ player, history, players, ratingLogs, trophies, onBack }) => {
    const [isPrinting, setIsPrinting] = useState(false);
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

    // ... (Hulpfunctie getTrophyContent blijft hetzelfde, die heb je al) ...
    // Voor de volledigheid en om errors te voorkomen, hier de korte versie (gebruik jouw eigen images object hier!)
    const getTrophyContent = (type: TrophyType) => {
        // ... PLAK HIER JOUW IMAGE LOGICA ...
        // Als je die niet bij de hand hebt, gebruik dan voor nu even iconen, maar ik ga er vanuit dat je die uit de vorige versie hebt.
         const images: {[key: string]: string} = {
            'Verdediger': 'https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png',
            'Topscoorder': 'https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png',
            'Clubkampioen': 'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png',
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
            '3de Wintertoernooi': 'https://i.postimg.cc/FKRtdmR9/Zonder-titel-(200-x-200-px)-20251203-122622-0000.png'
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
        let points = 0; // <--- HIER IS DE VARIABELE DIE JE NODIG HEBT
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

                // --- HIER WORDEN DE PUNTEN BEREKEND ---
                if (playerTeamScore > opponentTeamScore) {
                    wins++;
                    points += 3; // Winst = 3 punten
                } else if (opponentTeamScore > playerTeamScore) {
                    losses++;
                    // Verlies = 0 punten
                } else {
                    draws++;
                    points += 1; // Gelijk = 1 punt
                }
                // --------------------------------------

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

        return { wins, losses, draws, points, gamesPlayed, goalsScored, bestTeammates, worstTeammates, bestOpponents, worstOpponents, mostFrequentTeammates };
    }, [player.id, history]);

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

    const allTimeRatingHistory = useMemo(() => {
        const logs = ratingLogs
            .filter(log => log.playerId === player.id)
            .map(log => ({ date: log.date, rating: log.rating }));
        
        return logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [player.id, ratingLogs]);

    // Gemiddelde punten berekenen voor display
    const avgPoints = stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0;

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            {isPrinting && (
                <PlayerPrintView 
                    player={player} 
                    stats={stats} 
                    trophies={playerTrophies} 
                    players={players} 
                    seasonHistory={ratingHistory}
                    allTimeHistory={allTimeRatingHistory}
                    onClose={() => setIsPrinting(false)} 
                />
            )}

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
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
