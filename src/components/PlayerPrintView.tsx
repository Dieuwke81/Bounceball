import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Trophy, TrophyType } from '../types';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';

interface PlayerPrintViewProps {
  player: Player;
  stats: any;
  trophies: Trophy[];
  players: Player[]; // Hebben we nodig om namen op te zoeken bij relaties
  onClose: () => void;
}

const PlayerPrintView: React.FC<PlayerPrintViewProps> = ({ player, stats, trophies, players, onClose }) => {

  // Maak een map om snel namen op te zoeken bij ID's
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  useEffect(() => {
    // Korte vertraging om zeker te zijn dat plaatjes geladen zijn
    const printTimer = setTimeout(() => {
        window.print();
    }, 500);

    const closeTimer = setTimeout(() => onClose(), 1500); // Fallback

    window.onafterprint = () => {
        clearTimeout(closeTimer);
        onClose();
    };

    return () => {
        clearTimeout(printTimer);
        clearTimeout(closeTimer);
    };
  }, [onClose]);

  // HIER ZITTEN DE PLAATJES IN VERWERKT
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
      if (url) {
          return <img src={url} alt={type} className="w-10 h-10 object-contain" />;
      }

      // Fallback iconen
      if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8 text-black" />;
      return <TrophyIcon className="w-8 h-8 text-black" />;
  };

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            body::before { display: none !important; }
            html, body { background: white !important; height: 100%; margin: 0; padding: 0; }
            body > *:not(.print-portal) { display: none !important; }
            .print-portal {
              display: block !important; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
              background: white; color: black; font-family: sans-serif; z-index: 9999;
            }
            @page { size: A4; margin: 10mm; }
            .stat-box { border: 2px solid #e5e7eb; padding: 10px; border-radius: 8px; text-align: center; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          }
        `}
      </style>

      <div className="p-6 max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
           <div className="flex items-center">
               {player.photoBase64 ? (
                   <img src={player.photoBase64} alt={player.name} className="w-24 h-24 rounded-full object-cover border-2 border-black mr-6" />
               ) : (
                   <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-black mr-6 flex items-center justify-center text-3xl font-bold">
                       {player.name.charAt(0)}
                   </div>
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
            <div className="stat-box">
                <div className="text-[10px] uppercase text-gray-500 font-bold">Gespeeld</div>
                <div className="text-2xl font-black">{stats.gamesPlayed}</div>
            </div>
            <div className="stat-box">
                <div className="text-[10px] uppercase text-gray-500 font-bold">Gewonnen</div>
                <div className="text-2xl font-black">{Math.round((stats.wins / (stats.gamesPlayed || 1)) * 100)}%</div>
            </div>
            <div className="stat-box">
                <div className="text-[10px] uppercase text-gray-500 font-bold">Goals</div>
                <div className="text-2xl font-black">{stats.goalsScored}</div>
            </div>
            <div className="stat-box">
                <div className="text-[10px] uppercase text-gray-500 font-bold">Gem. Punten</div>
                <div className="text-2xl font-black">{(stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0).toFixed(2)}</div>
            </div>
        </div>

        {/* TROPHIES */}
        {trophies.length > 0 && (
            <div className="mb-8">
                <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 uppercase">Prijzenkast</h3>
                <div className="grid grid-cols-2 gap-3">
                    {trophies.map(t => (
                        <div key={t.id} className="flex items-center border border-gray-200 p-2 rounded bg-gray-50">
                            <div className="mr-3 text-gray-800">
                                {getTrophyContent(t.type)}
                            </div>
                            <div>
                                <div className="font-bold text-sm">{t.type}</div>
                                <div className="text-xs text-gray-500">{t.year}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* RELATIES - MET ECHTE NAMEN */}
        <div className="grid grid-cols-2 gap-8">
            <div>
                <h4 className="font-bold uppercase text-xs mb-2 text-gray-600">Beste Medespelers</h4>
                <ul className="text-sm">
                    {stats.bestTeammates.slice(0,3).map(([id, c]: any) => {
                         const p = playerMap.get(id);
                         return (
                            <li key={id} className="flex justify-between border-b border-gray-200 py-1">
                                <span>{p ? p.name : `Speler ${id}`}</span> 
                                <span className="font-bold">{c}x winst</span>
                            </li>
                         );
                    })}
                </ul>
            </div>
            <div>
                <h4 className="font-bold uppercase text-xs mb-2 text-gray-600">Makkelijke Tegenstanders</h4>
                 <ul className="text-sm">
                    {stats.bestOpponents.slice(0,3).map(([id, c]: any) => {
                         const p = playerMap.get(id);
                         return (
                            <li key={id} className="flex justify-between border-b border-gray-200 py-1">
                                <span>{p ? p.name : `Speler ${id}`}</span> 
                                <span className="font-bold">{c}x winst</span>
                            </li>
                         );
                    })}
                </ul>
            </div>
        </div>
        
        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 mt-8 pt-4 border-t border-gray-200">
            Bounceball Spelerskaart
        </div>

      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
