import React, { useMemo } from 'react';
import type { Player, GameSession, RatingLogEntry } from '../types';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { nl } from 'date-fns/locale';
import UsersIcon from './icons/UsersIcon'; // Zorg dat je dit icoon hebt, of haal de import weg

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

// --- COMPONENT: DE PRIJZENKAST ---
const TrophyCabinet: React.FC<{ awardsString?: string }> = ({ awardsString }) => {
  if (!awardsString) return null;

  // Splitst de tekst op de komma (bijv: "Kampioen 2023, Topscorer")
  const awards = awardsString.split(',').map(s => s.trim()).filter(s => s.length > 0);

  if (awards.length === 0) return null;

  // Hulpfunctie om icoontje te kiezen
  const getIconAndColor = (award: string) => {
    const lower = award.toLowerCase();
    if (lower.includes('kampioen') || lower.includes('winnaar') || lower.includes('1e')) {
      return { icon: '🏆', color: 'text-yellow-400', border: 'border-yellow-500/50 bg-yellow-500/10' };
    }
    if (lower.includes('topscorer') || lower.includes('doelpunt') || lower.includes('boot')) {
      return { icon: '👟', color: 'text-cyan-400', border: 'border-cyan-500/50 bg-cyan-500/10' };
    }
    if (lower.includes('mvp') || lower.includes('beste')) {
      return { icon: '⭐', color: 'text-fuchsia-400', border: 'border-fuchsia-500/50 bg-fuchsia-500/10' };
    }
    if (lower.includes('poedel') || lower.includes('laatste')) {
        return { icon: '💩', color: 'text-amber-700', border: 'border-amber-700/50 bg-amber-900/10' };
    }
    return { icon: '🏅', color: 'text-gray-300', border: 'border-gray-500/50 bg-gray-500/10' };
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 mb-6 border border-gray-600">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center">
        <span className="mr-2">🏆</span> Hall of Fame
      </h3>
      <div className="flex flex-wrap gap-2">
        {awards.map((award, index) => {
          const style = getIconAndColor(award);
          return (
            <div key={index} className={`flex items-center px-3 py-1.5 rounded-full border ${style.border}`}>
              <span className="text-lg mr-2">{style.icon}</span>
              <span className={`text-sm font-bold ${style.color}`}>{award}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PlayerDetailProps {
  player: Player;
  history: GameSession[];
  players: Player[]; 
  ratingLogs?: RatingLogEntry[];
  onBack: () => void;
}

const PlayerDetail: React.FC<PlayerDetailProps> = ({ player, history, players, ratingLogs, onBack }) => {
  
  // 1. Statistieken berekenen (Winst, Verlies, Goals)
  const stats = useMemo(() => {
    let matchesPlayed = 0;
    let goalsScored = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    history.forEach(session => {
        const allMatches = [...session.round1Results, ...session.round2Results];
        
        allMatches.forEach(match => {
            const team1 = session.teams[match.team1Index];
            const team2 = session.teams[match.team2Index];
            
            // Check of speler in team 1 zit
            if (team1?.some(p => p.id === player.id)) {
                matchesPlayed++;
                const myGoals = match.team1Goals.find(g => g.playerId === player.id)?.count || 0;
                goalsScored += myGoals;
                
                const score1 = match.team1Goals.reduce((a, b) => a + b.count, 0);
                const score2 = match.team2Goals.reduce((a, b) => a + b.count, 0);
                
                if (score1 > score2) wins++;
                else if (score1 === score2) draws++;
                else losses++;
            }
            // Check of speler in team 2 zit
            else if (team2?.some(p => p.id === player.id)) {
                matchesPlayed++;
                const myGoals = match.team2Goals.find(g => g.playerId === player.id)?.count || 0;
                goalsScored += myGoals;
                
                const score1 = match.team1Goals.reduce((a, b) => a + b.count, 0);
                const score2 = match.team2Goals.reduce((a, b) => a + b.count, 0);
                
                if (score2 > score1) wins++;
                else if (score1 === score2) draws++;
                else losses++;
            }
        });
    });

    return { matchesPlayed, goalsScored, wins, draws, losses };
  }, [player, history]);

  // 2. Grafiek data voorbereiden
  const chartData = useMemo(() => {
      // Haal logs op voor DEZE speler
      const playerLogs = (ratingLogs || [])
        .filter(log => log.playerId === player.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // We voegen de HUIDIGE rating toe als het puntje van vandaag
      const allPoints = [...playerLogs];
      
      // Als de laatste log niet van vandaag is, voeg huidige stand toe voor mooie lijn
      const today = new Date().toISOString().split('T')[0];
      const hasTodayLog = playerLogs.some(l => l.date.startsWith(today));
      
      if (!hasTodayLog) {
          allPoints.push({
              date: new Date().toISOString(),
              playerId: player.id,
              rating: player.rating
          });
      }

      const labels = allPoints.map(log => new Date(log.date));
      const dataPoints = allPoints.map(log => log.rating);

      return {
          labels,
          datasets: [{
              label: 'Rating',
              data: dataPoints,
              borderColor: 'rgb(34, 211, 238)', // Cyan-400
              backgroundColor: 'rgba(34, 211, 238, 0.1)',
              borderWidth: 3,
              pointBackgroundColor: 'rgb(34, 211, 238)',
              pointRadius: 4,
              fill: true,
              tension: 0.3 // Maakt de lijn een beetje vloeiend
          }]
      };
  }, [player, ratingLogs]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
         mode: 'index' as const,
         intersect: false,
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'month' as const, tooltipFormat: 'd MMM yyyy' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' }
      }
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 min-h-[80vh]">
      <button onClick={onBack} className="mb-6 text-cyan-400 hover:text-cyan-300 font-bold flex items-center transition-colors">
        ← Terug naar overzicht
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-4 border-gray-600 shadow-xl shrink-0">
           {player.photoBase64 ? (
               <img src={player.photoBase64} alt={player.name} className="w-full h-full object-cover" />
           ) : (
               <UsersIcon className="w-12 h-12 text-gray-500" />
           )}
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white">{player.name}</h2>
          <div className="flex items-center mt-2 space-x-3">
             <div className="text-2xl font-bold text-cyan-400">{player.rating.toFixed(2)} <span className="text-sm text-gray-400 font-normal">Rating</span></div>
             {player.isKeeper && <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wider">Keeper</span>}
          </div>
        </div>
      </div>

      {/* DE PRIJZENKAST */}
      <TrophyCabinet awardsString={player.awards} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wide">Wedstrijden</div>
          <div className="text-2xl font-bold text-white">{stats.matchesPlayed}</div>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wide">Doelpunten</div>
          <div className="text-2xl font-bold text-cyan-400">{stats.goalsScored}</div>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wide">Winst %</div>
          <div className="text-2xl font-bold text-green-400">
            {stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0}%
          </div>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wide">W-G-V</div>
          <div className="text-lg font-bold text-white">{stats.wins} - {stats.draws} - {stats.losses}</div>
        </div>
      </div>

      <div className="bg-gray-700 p-4 rounded-lg h-64 md:h-80">
        <h3 className="text-white font-bold mb-4">Rating Verloop</h3>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default PlayerDetail;
