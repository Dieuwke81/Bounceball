import React, { useMemo, useState, useEffect } from 'react';
import type { GameSession, Player } from '../types';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import StatsPrintDocument, { PrintData } from './StatsPrintDocument'; // <--- DEZE IS CRUCIAAL

// Printer Icoontje
const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
);

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
  
  // --- PRINT STATE ---
  const [printData, setPrintData] = useState<PrintData | null>(null);

  // Zodra printData gevuld is, start de printer
  useEffect(() => {
      if (printData) {
          const timer = setTimeout(() => {
              window.print();
              // Na printen de data wissen, zodat je weer teruggaat naar de app
              const cleanupTimer = setTimeout(() => setPrintData(null), 500);
              return () => clearTimeout(cleanupTimer);
          }, 100);
          return () => clearTimeout(timer);
      }
  }, [printData]);

  
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // --- BEREKENINGEN ---
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

        if (team1Score > team2Score) { 
          team1Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 3));
        } else if (team2Score > team1Score) { 
          team2Players.forEach(player => stats.set(player.id, (stats.get(player.id) || 0) + 3));
        } else { 
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
    return history.map(session => ({
        date: session.date,
        count: session.teams.flat().length,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const goalDifferenceHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map(session => {
        const allMatches = [...session.round1Results, ...session.round2Results];
        if (allMatches.length === 0) return null;
        const totalDifference = allMatches.reduce((total, match) => {
            const team1Score = match.team1Goals.reduce((sum, g) => sum + g.count, 0);
            const team2Score = match.team2Goals.reduce((sum, g) => sum + g.count, 0);
            return total + Math.abs(team1Score - team2Score);
        }, 0);
        return {
            date: session.date,
            avgDiff: totalDifference / allMatches.length,
        };
    }).filter((item): item is {date: string; avgDiff: number} => item !== null).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);


  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Geen Data</h2>
        <p className="text-gray-400">Sla je eerste toernooi af om hier statistieken te zien.</p>
      </div>
    );
  }

  // --- PRINT HANDLERS: DEZE MAKEN NU EEN SCHONE LIJST ---

  const handlePrintCompetition = () => {
      const rows = competitionPoints
          .filter(p => playerMap.has(p.playerId))
          .map((p, i) => [
            i + 1, 
            playerMap.get(p.playerId)?.name || '-',
            p.points,
            p.games,
            p.avg.toFixed(2)
          ]);
      
      setPrintData({
          title: "Competitie Stand",
          headers: ["#", "Speler", "Punten", "Wedstr.", "Gem."],
          rows: rows
      });
  };

  const handlePrintTopScorers = () => {
      const rows = topScorers
        .filter(p => playerMap.has(p.playerId))
        .map((p, i) => [
            i + 1, 
            playerMap.get(p.playerId)?.name || '-',
            p.goals,
            p.games,
            p.avg.toFixed(2)
        ]);
      setPrintData({
          title: "Topscoorders",
          headers: ["#", "Speler", "Doelpunten", "Wedstr.", "Gem."],
          rows: rows
      });
  };

  const handlePrintDefense = () => {
      const rows = bestDefense
        .filter(p => playerMap.has(p.playerId))
        .map((p, i) => [
            i + 1, 
            playerMap.get(p.playerId)?.name || '-',
            (p.avg * p.games).toFixed(0),
            p.games,
            p.avg.toFixed(2)
        ]);
      setPrintData({
          title: "Beste Verdediger (Minste tegengoals)",
          headers: ["#", "Speler", "Tegengoals", "Wedstr.", "Gem."],
          rows: rows
      });
  };

  const handlePrintAttendance = () => {
      const rows = mostAttended
        .filter(p => playerMap.has(p.playerId))
        .map((p, i) => [
            i + 1, 
            playerMap.get(p.playerId)?.name || '-',
            p.count,
            `${p.percentage.toFixed(0)}%`
        ]);
      setPrintData({
          title: "Aanwezigheid",
          headers: ["#", "Speler", "Aantal", "%"],
          rows: rows
      });
  };

  const StatCard: React.FC<{ 
      title: string, 
      icon: React.ReactNode, 
      children: React.ReactNode, 
      onPrint?: () => void 
  }> = ({ title, icon, children, onPrint }) => (
    <div className={`bg-gray-800 rounded-xl shadow-lg p-6 relative group`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
            {icon}
            <h3 className="ml-3 text-2xl font-bold text-white">{title}</h3>
        </div>
        {onPrint && (
            <button 
                onClick={onPrint}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors shadow-md"
                title={`Print ${title}`}
            >
                <PrinterIcon className="w-5 h-5" />
            </button>
        )}
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
          <div className="mt-2 no-print">
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
  
  return (
    <>
      {/* HIER PLAATSEN WE HET NIEUWE PRINT DOCUMENT */}
      <StatsPrintDocument data={printData} />

      <div className="text-center mb-8">
          <p className="text-gray-400">Statistieken gebaseerd op <span className="font-bold text-white">{totalSessions}</span> speeldagen. <span className="italic">Voor de ranglijsten (gem.) moet een speler minimaal <span className="font-bold text-white">{minGames}</span> keer aanwezig zijn geweest.</span></p>
          <p className="text-green-500 text-sm mt-2 italic">Klik op een speler om de individuele statistieken te zien.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* COMPETITIE */}
        <StatCard title="Competitie" onPrint={handlePrintCompetition} icon={
            <img src="https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png" alt="Competitie" className="w-12 h-12 object-contain" />
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

        {/* TOPSCOORDER */}
        <StatCard title="Topscoorder" onPrint={handlePrintTopScorers} icon={
            <img src="https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png" alt="Topscoorder" className="w-12 h-12 object-contain" />
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

        {/* BESTE VERDEDIGER */}
        <StatCard title="Beste verdediger" onPrint={handlePrintDefense} icon={
            <img src="https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png" alt="Beste verdediger" className="w-12 h-12 object-contain" />
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
        
        {/* MEEST AANWEZIG */}
        <StatCard title="Meest aanwezig" onPrint={handlePrintAttendance} icon={<UsersIcon className="w-6 h-6 text-green-400" />}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatCard title="Aanwezigheids Trend" icon={<ChartBarIcon className="w-6 h-6 text-cyan-400" />}>
          <AttendanceChart data={attendanceHistory} />
        </StatCard>
        <StatCard title="Balans van Teams (Gem. Doelsaldo)" icon={<ChartBarIcon className="w-6 h-6 text-fuchsia-400" />}>
          <GoalDifferenceChart data={goalDifferenceHistory} />
        </StatCard>
      </div>
    </>
  );
};

export default Statistics;
