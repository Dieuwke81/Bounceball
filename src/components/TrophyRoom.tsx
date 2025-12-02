import React, { useState } from 'react';
import type { Player, Trophy, TrophyType } from '../types';
import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import FutbolIcon from './icons/FutbolIcon'; // Of gebruik een img tag als je die hebt
import TrashIcon from './icons/TrashIcon';

interface TrophyRoomProps {
  trophies: Trophy[];
  players: Player[];
  isAuthenticated: boolean;
  onAddTrophy: (trophy: Omit<Trophy, 'id'>) => Promise<void>;
  onDeleteTrophy: (id: string) => Promise<void>;
}

const TROPHY_TYPES: TrophyType[] = [
  'Clubkampioen', '2de', '3de',
  'Topscoorder', 'Verdediger', 'Speler van het jaar',
  '1ste NK', '2de NK', '3de NK',
  '1ste Introductietoernooi', '2de Introductietoernooi', '3de Introductietoernooi',
  '1ste Wintertoernooi', '2de Wintertoernooi', '3de Wintertoernooi'
];

const TrophyRoom: React.FC<TrophyRoomProps> = ({ trophies, players, isAuthenticated, onAddTrophy, onDeleteTrophy }) => {
  // Form State
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');
  const [selectedType, setSelectedType] = useState<TrophyType>('Clubkampioen');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) return;
    
    setIsSubmitting(true);
    try {
      await onAddTrophy({
        playerId: Number(selectedPlayerId),
        type: selectedType,
        year: year
      });
      // Reset form on success (maar jaar laten staan, handig voor batch invoer)
      setSelectedPlayerId('');
    } catch (error) {
      alert("Er ging iets mis bij het opslaan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(window.confirm("Weet je zeker dat je deze prijs wilt verwijderen uit de kast?")) {
        await onDeleteTrophy(id);
    }
  }

  // Group trophies by year
  const trophiesByYear = [...trophies].sort((a, b) => b.year - a.year).reduce((acc, trophy) => {
    if (!acc[trophy.year]) acc[trophy.year] = [];
    acc[trophy.year].push(trophy);
    return acc;
  }, {} as { [year: number]: Trophy[] });

  // Helper voor styling op basis van prijs
  const getTrophyStyle = (type: TrophyType) => {
    if (type.includes('1ste') || type === 'Clubkampioen' || type === 'Speler van het jaar') return 'text-yellow-400';
    if (type.includes('2de')) return 'text-gray-300'; // Zilver
    if (type.includes('3de')) return 'text-amber-600'; // Brons
    if (type === 'Topscoorder') return 'text-cyan-400';
    if (type === 'Verdediger') return 'text-fuchsia-400';
    return 'text-white';
  };

  const getTrophyIcon = (type: TrophyType) => {
      if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8" />;
      // Je kunt hier ook je custom images gebruiken met <img src="..." />
      return <TrophyIcon className="w-8 h-8" />;
  };

  return (
    <div className="space-y-8">
      
      {/* --- ADMIN: TOEVOEGEN FORMULIER --- */}
      {isAuthenticated && (
        <div className="bg-gray-800 border-2 border-amber-500/30 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center">
            <span className="mr-2">+</span> Prijs Uitrijken
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            {/* 1. Welke Prijs */}
            <div>
                <label className="block text-sm text-gray-400 mb-1">Prijs</label>
                <select 
                    value={selectedType} 
                    onChange={(e) => setSelectedType(e.target.value as TrophyType)}
                    className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 focus:border-amber-500 outline-none"
                >
                    {TROPHY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {/* 2. Welke Speler */}
            <div>
                <label className="block text-sm text-gray-400 mb-1">Winnaar</label>
                <select 
                    value={selectedPlayerId} 
                    onChange={(e) => setSelectedPlayerId(Number(e.target.value))}
                    className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 focus:border-amber-500 outline-none"
                    required
                >
                    <option value="">Kies speler...</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {/* 3. Jaartal */}
            <div>
                <label className="block text-sm text-gray-400 mb-1">Jaar</label>
                <input 
                    type="number" 
                    value={year} 
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 focus:border-amber-500 outline-none"
                />
            </div>

            {/* 4. Knop */}
            <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
            >
                {isSubmitting ? 'Bezig...' : 'Toevoegen'}
            </button>
          </form>
        </div>
      )}

      {/* --- DISPLAY: DE PRIJZENKAST --- */}
      <div className="space-y-8">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">De Prijzenkast 🏆</h2>
            <p className="text-gray-400">Ere wie ere toekomt.</p>
        </div>

        {Object.keys(trophiesByYear).length === 0 ? (
            <p className="text-center text-gray-500 py-10">De kast is nog leeg...</p>
        ) : (
            // Sorteer jaren aflopend (nieuwste boven)
            Object.keys(trophiesByYear).sort((a,b) => Number(b) - Number(a)).map(yearKey => {
                const yearNum = Number(yearKey);
                const yearTrophies = trophiesByYear[yearNum];

                return (
                    <div key={yearNum} className="relative">
                        {/* Jaartal Divider */}
                        <div className="flex items-center mb-6">
                            <div className="flex-grow h-px bg-gray-700"></div>
                            <span className="px-4 text-2xl font-bold text-gray-500">{yearNum}</span>
                            <div className="flex-grow h-px bg-gray-700"></div>
                        </div>

                        {/* Grid met Prijzen */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {yearTrophies.map(trophy => {
                                const player = players.find(p => p.id === trophy.playerId);
                                return (
                                    <div key={trophy.id} className="bg-gray-800 rounded-lg p-4 flex items-center shadow-md border border-gray-700 relative group hover:border-gray-500 transition-colors">
                                        <div className={`mr-4 ${getTrophyStyle(trophy.type)}`}>
                                            {getTrophyIcon(trophy.type)}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${getTrophyStyle(trophy.type)}`}>{trophy.type}</h4>
                                            <p className="text-white text-lg font-medium truncate">{player ? player.name : 'Onbekend'}</p>
                                        </div>
                                        
                                        {/* Verwijder knop (alleen zichtbaar voor admin) */}
                                        {isAuthenticated && (
                                            <button 
                                                onClick={() => handleDelete(trophy.id)}
                                                className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            })
        )}
      </div>
    </div>
  );
};

export default TrophyRoom;
