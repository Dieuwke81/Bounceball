import React, { useMemo, useState } from 'react';
import type { GameSession, Player } from '../types';

// --- IMPORTS (De iconen die je al hebt) ---
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';

// --- PRINTER ICON (Inline, zodat hij altijd werkt) ---
const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
);

// --- DE SLIMME PRINT FUNCTIE ---
const printSection = (elementId: string) => {
    // We maken een tijdelijk stijlblok aan dat ALLEEN tijdens het printen geldt
    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            /* Verberg ALLES op de pagina */
            body * {
                visibility: hidden;
            }
            
            /* Maak het gekozen blokje (en de inhoud) zichtbaar */
            #${elementId}, #${elementId} * {
                visibility: visible;
            }

            /* Positioneer het blokje linksboven op het papier */
            #${elementId} {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
                background-color: white !important; /* Wit papier bespaart inkt */
                color: black !important; /* Zwarte tekst voor leesbaarheid */
                box-shadow: none !important;
            }

            /* Verberg de printknop zelf op het papier */
            #${elementId} button {
                display: none !important;
            }
            
            /* Zorg dat achtergrondkleurtjes van labels (groen/geel) wel geprint worden */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    window.print();
    
    // Ruim de stijl weer op na het printen (anders blijft je scherm raar)
    setTimeout(() => {
        document.head.removeChild(style);
    }, 500);
};

// ============================================================================

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
  
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  const { playerGames, totalSessions, minGames } = useMemo(() => {
    const playerGamesMap = new Map<number, number>();
    const sessions = history.length;
    if (sessions === 0) return { playerGames: playerGamesMap, totalSessions: 0, minGames: 0 };

    history.forEach(session => {
        const attendingIds = new Set<number>();
        session.teams.flat().forEach(player => {
            attendingIds.add(player.id);
        });
        attendingIds.forEach(id => {
            playerGamesMap.set(id, (playerGamesMap.get(id) || 0) + 1);
        });
    });
    
    return { playerGames: playerGamesMap, totalSessions: sessions, minGames: Math.max(1, Math.round(sessions / 2)) };
  }, [history]);

  const playerMatches = useMemo(() => {
    const map = new Map<number, number>();
    history.forEach(session => {
        [...session.round1Results, ...session.round2Results].forEach(match => {
            if (session.teams[match.team1Index] && session.teams[match.team2Index]) {
                const playersInMatch = [
                    ...session.teams[match.team1Index],
                    ...session.teams[match.team2Index]
                ];
                playersInMatch.forEach(player => {
                    map.set(player.id, (map.get(player.id) || 0) + 1);
                });
            }
        });
    });
    return map;
  }, [history]);

  const topScorers = useMemo(() => {
    const stats = new Map<number, number>();
    history.forEach(session => {
      [...session.round1Results, ...session.round2Results].forEach(match => {
        [...match.team1Goals, ...match.team2Goals].forEach(goal => {
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
    history.forEach(session => {
      [...session.round1Results, ...session.round2Results].forEach(match => {
        if (!session.teams[match.team1Index] || !session.teams[match.team2Index]) return;
        const team1Players = session.teams[match.team1Index];
        const team2Players = session.teams[match.team2Index];
        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        if (team1Score > team2Score) { // Team 1 wins
          team1Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 3));
        } else if (team2Score > team1Score) { // Team 2 wins
          team2Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 3));
        } else { // Draw
          team1Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 1));
          team2Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 1));
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
    history.forEach(session => {
      [...session.round1Results, ...session.round2Results].forEach(match => {
        if (!session.teams[match.team1Index] || !session.teams[match.team2Index]) return;
        const team1Players = session.teams[match.team1Index];
        const team2Players = session.teams[match.team2Index];
        const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
        const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);

        team1Players.forEach(player => {
          stats.set(player.id, (stats.get(player.id) || 0) + team2Score);
        });
        team2Players.forEach(player => {
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
        }))
        .sort((a, b) => b.count - a.count);
  }, [playerGames, totalSessions]);

  const attendanceHistory = useMemo(() => {
    if (!history) return [];
    return history
        .map(session => ({
            date: session.date,
            count: session.teams.flat().length,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const goalDifferenceHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    return history
        .map(session => {
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
        .filter((item): item is {date: string; avgDiff: number} => item !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);


  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Data</h2>
        <p className="text-gray-400">Sla je eerste toernooi af om hier statistieken te zien.</p>
      </div>
    );
  }

  // --- STATCARD MET UNIEK ID VOOR PRINTEN ---
  const StatCard: React.FC<{ 
      id: string, // Dit ID is cruciaal voor de printfunctie
      title: string, 
      icon: React.ReactNode, 
      children: React.ReactNode, 
      className?: string 
  }> = ({ id, title, icon, children, className }) => (
    <div id={id} className={`bg-gray-800 rounded-xl shadow-lg p-6 ${className} relative group`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
            {icon}
            <h3 className="ml-3 text-2xl font-bold text-white">{title}</h3>
        </div>
        {/* De Printknop die de printSection functie aanroept met het specifieke ID */}
        <button 
            onClick={() => printSection(id)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors"
            title={`Print ${title}`}
        >
            <PrinterIcon className="w-5 h-5" />
        </button>
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
    <button onClick={() => onSelectPlayer(player.id)} className="w-full flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-left">
      <div className="flex items-center min-w-0">
        <span className="text-sm font-bold text-cyan-400 w-6 text-center flex-shrink-0">{rank}.</span>
        <span className={`ml-3 font-medium truncate ${meetsThreshold ? 'text-gray-200' : 'text-red-400'}`}>{player.name}</span>
        {player.isFixedMember && (
          <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full" title="Vast lid">Lid</span>
        )}
        {player.isKeeper && (
          <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full" title="Keeper">K</span>
        )}
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <span className="text-lg font-bold bg-gray-600 text-white py-1 px-3 rounded-full">{value}</span>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
    </button>
  );

  const StatList: React.FC<{
      data: any[];
      showAllFlag: boolean,
      toggleShowAll: () => void,
      renderRow: (item: any, index: number) => React.ReactNode
  }> = ({ data, showAllFlag, toggleShowAll, renderRow }) => {
    const filteredData = data.filter(item => item && item.playerId && playerMap.has(item.playerId));
    const displayedData = showAllFlag ? filteredData : filteredData.slice(0, 10);
    return (
      <>
        {displayedData.map((item, index) => {
            const player = playerMap.get(item.playerId);
            if (!player) return null;
            return renderRow(item, index);
        })}
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

  const AttendanceChart: React.FC<{ data: {date: string, count: number}[] }> = ({ data }) => {
      if (data.length < 2) {
          return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
      }

      const W = 500, H = 200, P = 30;
      const minCount = Math.min(...data.map(d => d.count));
      const maxCount = Math.max(...data.map(d => d.count));
      const countRange = Math.max(1, maxCount - minCount);

      const points = data.map((d, i) => {
          const x = (i / (data.length - 1)) * (W - P * 2) + P;
          const y = H - P - ((d.count - minCount) / countRange) * (H - P * 2);
          return `${x},${y}`;
      }).join(' ');
      
      const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

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
                    <circle key={i} cx={x} cy={y} r="3" className="fill-cyan-400 stroke-gray-800" strokeWidth="2">
                        <title>{`${formatDate(d.date)}: ${d.count} spelers`}</title>
                    </circle>
                );
            })}
             <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">{formatDate(data[0].date)}</text>
             <text x={W - P} y={H - P + 15} textAnchor="end" className="fill-gray-400 text-xs">{formatDate(data[data.length - 1].date)}</text>
        </svg>
    );
  };
  
    const GoalDifferenceChart: React.FC<{ data: { date: string, avgDiff: number }[] }> = ({ data }) => {
    if (data.length < 2) {
      return <p className="text-gray-400 text-center py-8">Niet genoeg data voor een grafiek.</p>;
    }

    const W = 500, H = 200, P = 30;
    const minDiff = Math.min(...data.map(d => d.avgDiff));
    const maxDiff = Math.max(...data.map(d => d.avgDiff));
    const diffRange = Math.max(0.1, maxDiff - minDiff);

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (W - P * 2) + P;
      const y = H - P - ((d.avgDiff - minDiff) / diffRange) * (H - P * 2);
      return `${x},${y}`;
    }).join(' ');

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });

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
                <circle key={i} cx={x} cy={y} r="3" className="fill-fuchsia-400 stroke-gray-800" strokeWidth="2">
                    <title>{`${formatDate(d.date)}: gem. doelsaldo ${d.avgDiff.toFixed(2)}`}</title>
                </circle>
            );
        })}
        <text x={P} y={H - P + 15} textAnchor="start" className="fill-gray-400 text-xs">{formatDate(data[0].date)}</text>
        <text x={W - P} y={H - P + 15} textAnchor="end" className="fill-gray-400 text-xs">{formatDate(data[data.length - 1].date)}</text>
      </svg>
    );
  };
  
  return (
    <>
      <div className="flex justify-between items-center mb-6 px-2">
         <h2 className="text-2xl font-bold text-white">Statistieken</h2>
         {/* ALGEMENE PRINT KNOP */}
         <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg transition-colors text-sm font-bold shadow-md hover:shadow-lg"
            title="Print Alles"
         >
            <PrinterIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Alles Printen</span>
         </button>
      </div>

      <div className="text-center mb-8">
          <p className="text-gray-400">Statistieken gebaseerd op <span className="font-bold text-white">{totalSessions}</span> speeldagen. <span className="italic">Voor de ranglijsten (gem.) moet een speler minimaal <span className="font-bold text-white">{minGames}</span> keer aanwezig zijn geweest.</span></p>
          <p className="text-green-500 text-sm mt-2 italic">Klik op een speler om de individuele statistieken te zien.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* ID TOEGEVOEGD: COMPETITIE */}
        <StatCard id="stat-competition" title="Competitie" icon={
            <img 
                src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png" 
                alt="Competitie" 
                className="w-12 h-12 object-contain" 
            />
        }>
           <StatList
            data={competitionPoints}
            showAllFlag={showAll.points}
            toggleShowAll={() => setShowAll(s => ({...s, points: !s.points}))}
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

        {/* ID TOEGEVOEGD: TOPSCOORDER */}
        <StatCard id="stat-topscorers" title="Topscoorder" icon={
            <img 
                src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png" 
                alt="Topscoorder" 
                className="w-12 h-12 object-contain" 
            />
        }>
           <StatList
            data={topScorers}
            showAllFlag={showAll.scorers}
            toggleShowAll={() => setShowAll(s => ({...s, scorers: !s.scorers}))}
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

        {/* ID TOEGEVOEGD: VERDEDIGER */}
        <StatCard id="stat-defense" title="Beste verdediger" icon={
            <img 
                src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png" 
                alt="Beste verdediger" 
                className="w-12 h-12 object-contain" 
            />
        }>
          <StatList
            data={bestDefense}
            showAllFlag={showAll.defense}
            toggleShowAll={() => setShowAll(s => ({...s, defense: !s.defense}))}
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
        
        {/* ID TOEGEVOEGD: AANWEZIGHEID */}
        <StatCard id="stat-attendance" title="Meest aanwezig" icon={<UsersIcon className="w-6 h-6 text-green-400" />}>
          <StatList
            data={mostAttended}
            showAllFlag={showAll.attendance}
            toggleShowAll={() => setShowAll(s => ({...s, attendance: !s.attendance}))}
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
                    />
                );
            }}
           />
        </StatCard>
      </div>

      <div id="stat-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative group">
        <div className="absolute top-2 right-2 z-10">
             {/* SPECIFIEKE PRINTKNOP VOOR GRAFIEKEN */}
             <button 
                onClick={() => printSection('stat-charts')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors shadow-lg"
                title="Print Grafieken"
            >
                <PrinterIcon className="w-5 h-5" />
            </button>
        </div>

        <StatCard id="chart-attendance" title="Aanwezigheids Trend" icon={<ChartBarIcon className="w-6 h-6 text-cyan-400" />}>
          <AttendanceChart data={attendanceHistory} />
        </StatCard>
        <StatCard id="chart-balance" title="Balans van Teams (Gem. Doelsaldo)" icon={<ChartBarIcon className="w-6 h-6 text-fuchsia-400" />}>
          <GoalDifferenceChart data={goalDifferenceHistory} />
        </StatCard>
      </div>
    </>
  );
};

export default Statistics;
