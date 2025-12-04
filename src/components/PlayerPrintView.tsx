import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Trophy, TrophyType } from '../types';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';

interface PlayerPrintViewProps {
  player: Player;
  stats: any;
  trophies: Trophy[];
  players: Player[];
  seasonHistory: { date: string; rating: number }[];
  allTimeHistory: { date: string; rating: number }[];
  onClose: () => void;
}

// --- VERBETERDE GRAFIEK VOOR PRINT ---
const PrintChart: React.FC<{ data: { date: string; rating: number }[], title: string }> = ({ data, title }) => {
    if (!data || data.length < 2) return null;

    const width = 800; // Veel breder voor meer detail
    const height = 200;
    const padding = 40; // Meer ruimte voor tekst

    const minRating = Math.min(...data.map(d => d.rating));
    const maxRating = Math.max(...data.map(d => d.rating));
    // Zorg voor marge zodat de lijn niet tegen de rand plakt
    const range = maxRating - minRating || 1;
    const minY = minRating - (range * 0.1);
    const maxY = maxRating + (range * 0.1);

    const getX = (index: number) => (index / (data.length - 1)) * (width - padding * 2) + padding;
    const getY = (rating: number) => height - padding - ((rating - minY) / (maxY - minY)) * (height - padding * 2);

    const points = data.map((d, i) => `${getX(i)},${getY(d.rating)}`).join(' ');

    // Datum formatteren
    const formatDate = (dateStr: string) => {
       if (dateStr === 'Nu') return 'Nu';
       return new Date(dateStr).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
    };

    return (
        <div className="border border-gray-300 rounded p-4 bg-white mb-4 break-inside-avoid">
            <h5 className="text-sm font-bold uppercase text-black mb-2 text-center">{title}</h5>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {/* Achtergrond lijnen (Grid) */}
                <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#eee" strokeWidth="1" />
                <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#eee" strokeWidth="1" />
                <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#eee" strokeWidth="1" />
                
                {/* De Lijn */}
                <polyline fill="none" stroke="#000" strokeWidth="2.5" points={points} strokeLinejoin="round" />
                
                {/* Y-as Labels (Rating) */}
                <text x={padding - 5} y={getY(maxRating)} className="text-[12px] fill-gray-600 font-bold" textAnchor="end" dominantBaseline="middle">{maxRating.toFixed(1)}</text>
                <text x={padding - 5} y={getY(minRating)} className="text-[12px] fill-gray-600 font-bold" textAnchor="end" dominantBaseline="middle">{minRating.toFixed(1)}</text>

                {/* X-as Labels (Datum) - Alleen start, midden, eind */}
                <text x={getX(0)} y={height - 15} className="text-[12px] fill-gray-600" textAnchor="start">{formatDate(data[0].date)}</text>
                <text x={getX(Math.floor(data.length / 2))} y={height - 15} className="text-[12px] fill-gray-600" textAnchor="middle">{formatDate(data[Math.floor(data.length / 2)].date)}</text>
                <text x={getX(data.length - 1)} y={height - 15} className="text-[12px] fill-gray-600" textAnchor="end">{formatDate(data[data.length - 1].date)}</text>

                {/* Huidige Rating Bolletje + Label */}
                <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].rating)} r="4" fill="black" />
                <text x={getX(data.length - 1)} y={getY(data[data.length - 1].rating) - 10} className="text-[12px] fill-black font-bold" textAnchor="end">
                    {data[data.length - 1].rating.toFixed(2)}
                </text>
            </svg>
        </div>
    );
};

const PlayerPrintView: React.FC<PlayerPrintViewProps> = ({ player, stats, trophies, players, seasonHistory, allTimeHistory, onClose }) => {
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  useEffect(() => {
    const printTimer = setTimeout(() => { window.print(); }, 500);
    const closeTimer = setTimeout(() => onClose(), 1500);
    window.onafterprint = () => { clearTimeout(closeTimer); onClose(); };
    return () => { clearTimeout(printTimer); clearTimeout(closeTimer); };
  }, [onClose]);

  const getTrophyContent = (type: TrophyType) => {
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
      const url = images[type];
      if (url) return <img src={url} alt={type} className="w-10 h-10 object-contain" />;
      if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8 text-black" />;
      return <TrophyIcon className="w-8 h-8 text-black" />;
  };

  // Helper component voor de lijstjes
  const RelationshipSection: React.FC<{ title: string, data: [number, number][] }> = ({ title, data }) => (
      <div className="break-inside-avoid mb-4">
          <h4 className="font-bold uppercase text-xs mb-2 text-gray-600 border-b border-gray-300 pb-1">{title}</h4>
          <ul className="text-xs">
              {data.length > 0 ? (
                  data.slice(0, 5).map(([id, count]) => {
                      const p = playerMap.get(id);
                      return (
                          <li key={id} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                              <span className="font-medium">{p ? p.name : `Speler ${id}`}</span>
                              <span className="font-bold text-gray-500">{count}x</span>
                          </li>
                      );
                  })
              ) : (
                  <li className="text-gray-400 italic py-1">- Geen data -</li>
              )}
          </ul>
      </div>
  );

  const avgPoints = stats.gamesPlayed > 0 ? (Number(stats.points) || 0) / stats.gamesPlayed : 0;

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            body::before { display: none !important; }
            html, body { background: white !important; height: 100%; margin: 0; padding: 0; }
            body > *:not(.print-portal) { display: none !important; }
            .print-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; color: black; font-family: sans-serif; z-index: 9999; }
            @page { size: A4; margin: 10mm; }
            .stat-box { border: 2px solid #e5e7eb; padding: 10px; border-radius: 8px; text-align: center; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .relationships-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          }
        `}
      </style>

      <div className="p-6 max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-4">
           <div className="flex items-center">
               {player.photoBase64 ? (
                   <img src={player.photoBase64} alt={player.name} className="w-24 h-24 rounded-full object-cover border-2 border-black mr-6" />
               ) : (
                   <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-black mr-6 flex items-center justify-center text-3xl font-bold">{player.name.charAt(0)}</div>
               )}
               <div>
                   <h1 className="text-4xl font-black uppercase tracking-wide">{player.name}</h1>
                   <div className="flex gap-2 mt-2 text-sm font-bold uppercase text-gray-600">
                       {player.isKeeper && <span className="border border-black px-2 py-1 rounded">Keeper</span>}
                       {player.isFixedMember && <span className="border border-black px-2 py-1 rounded">Lid</span>}
                       <span className="border border-black px-2 py-1 rounded">Rating: {player.rating.toFixed(2)}</span>
                   </div>
               </div>
           </div>
           <img src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" alt="Logo" className="h-20 w-auto" />
        </div>

        {/* STATS GRID */}
        <div className="print-grid">
            <div className="stat-box"><div className="text-[10px] uppercase text-gray-500 font-bold">Gespeeld</div><div className="text-2xl font-black">{stats.gamesPlayed}</div></div>
            <div className="stat-box"><div className="text-[10px] uppercase text-gray-500 font-bold">Gewonnen</div><div className="text-2xl font-black">{Math.round((stats.wins / (stats.gamesPlayed || 1)) * 100)}%</div></div>
            <div className="stat-box"><div className="text-[10px] uppercase text-gray-500 font-bold">Goals</div><div className="text-2xl font-black">{stats.goalsScored}</div></div>
            <div className="stat-box"><div className="text-[10px] uppercase text-gray-500 font-bold">Gem. Punten</div><div className="text-2xl font-black">{avgPoints.toFixed(2)}</div></div>
        </div>

        {/* GRAFIEKEN (ONDER ELKAAR) */}
        <div className="mb-8">
             <PrintChart data={seasonHistory} title="Verloop Huidig Seizoen" />
             <PrintChart data={allTimeHistory} title="All-Time Verloop" />
        </div>

        {/* RELATIES (5 LIJSTEN IN 3 KOLOMMEN) */}
        <div className="mb-8">
            <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase">Statistieken vs Spelers (Top 5)</h3>
            <div className="relationships-grid">
                <RelationshipSection title="Vaakste Medespeler" data={stats.mostFrequentTeammates} />
                <RelationshipSection title="Beste Medespeler (Winst)" data={stats.bestTeammates} />
                <RelationshipSection title="Slechtste Medespeler (Verlies)" data={stats.worstTeammates} />
                <RelationshipSection title="Makkelijkste Tegenstander" data={stats.bestOpponents} />
                <RelationshipSection title="Lastigste Tegenstander" data={stats.worstOpponents} />
            </div>
        </div>

        {/* PRIJZENKAST (HELEMAAL ONDERAAN) */}
        {trophies.length > 0 && (
            <div className="mb-8 break-inside-avoid">
                <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase">Prijzenkast</h3>
                <div className="grid grid-cols-2 gap-3">
                    {trophies.map(t => (
                        <div key={t.id} className="flex items-center border border-gray-200 p-2 rounded bg-gray-50">
                            <div className="mr-3 text-gray-800">{getTrophyContent(t.type)}</div>
                            <div><div className="font-bold text-sm">{t.type}</div><div className="text-xs text-gray-500">{t.year}</div></div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* FOOTER */}
        <div className="text-center text-[10px] text-gray-400 mt-auto pt-4 border-t border-gray-200">
            Gegenereerd door Bounceball App - {new Date().toLocaleDateString('nl-NL')}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
