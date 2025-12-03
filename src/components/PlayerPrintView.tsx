import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Trophy, TrophyType } from '../types';
import ShieldIcon from './icons/ShieldIcon';
import TrophyIcon from './icons/TrophyIcon';

interface PlayerPrintViewProps {
  player: Player;
  stats: any; // Het stats object uit PlayerDetail
  trophies: Trophy[];
  onClose: () => void;
}

const PlayerPrintView: React.FC<PlayerPrintViewProps> = ({ player, stats, trophies, onClose }) => {

  useEffect(() => {
    window.print();
    const timeout = setTimeout(() => onClose(), 1000);
    window.onafterprint = () => { clearTimeout(timeout); onClose(); };
    return () => clearTimeout(timeout);
  }, [onClose]);

  const getTrophyIcon = (type: TrophyType) => {
      // Simpele iconen voor print, plaatjes laden soms traag of niet
      if (type === 'Verdediger') return <ShieldIcon className="w-6 h-6 text-black" />;
      return <TrophyIcon className="w-6 h-6 text-black" />;
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
            @page { size: A4; margin: 15mm; }
            .stat-box { border: 2px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; }
          }
        `}
      </style>

      <div className="p-8 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-10 border-b-2 border-black pb-6">
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
                   <div className="flex gap-3 mt-2 text-sm font-bold uppercase text-gray-600">
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
                <div className="text-xs uppercase text-gray-500 font-bold">Gespeeld</div>
                <div className="text-3xl font-black">{stats.gamesPlayed}</div>
            </div>
            <div className="stat-box">
                <div className="text-xs uppercase text-gray-500 font-bold">Gewonnen</div>
                <div className="text-3xl font-black">{Math.round((stats.wins / (stats.gamesPlayed || 1)) * 100)}%</div>
            </div>
            <div className="stat-box">
                <div className="text-xs uppercase text-gray-500 font-bold">Goals</div>
                <div className="text-3xl font-black">{stats.goalsScored}</div>
            </div>
            <div className="stat-box">
                <div className="text-xs uppercase text-gray-500 font-bold">Gem. Punten</div>
                <div className="text-3xl font-black">{(stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0).toFixed(2)}</div>
            </div>
        </div>

        {/* TROPHIES */}
        {trophies.length > 0 && (
            <div className="mb-10">
                <h3 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4 uppercase">Prijzenkast</h3>
                <div className="grid grid-cols-2 gap-4">
                    {trophies.map(t => (
                        <div key={t.id} className="flex items-center border border-gray-200 p-3 rounded">
                            <div className="mr-3 text-gray-800">{getTrophyIcon(t.type)}</div>
                            <div>
                                <div className="font-bold">{t.type}</div>
                                <div className="text-sm text-gray-500">{t.year}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* RELATIES */}
        <div className="grid grid-cols-2 gap-8">
            <div>
                <h4 className="font-bold uppercase text-sm mb-2 text-gray-600">Beste Medespelers</h4>
                <ul className="text-sm">
                    {stats.bestTeammates.slice(0,3).map(([id, c]: any) => (
                         <li key={id} className="flex justify-between border-b py-1"><span>Speler {id}</span> <span>{c}x winst</span></li>
                    ))}
                </ul>
            </div>
            <div>
                <h4 className="font-bold uppercase text-sm mb-2 text-gray-600">Makkelijke Tegenstanders</h4>
                 <ul className="text-sm">
                    {stats.bestOpponents.slice(0,3).map(([id, c]: any) => (
                         <li key={id} className="flex justify-between border-b py-1"><span>Speler {id}</span> <span>{c}x winst</span></li>
                    ))}
                </ul>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default PlayerPrintView;
