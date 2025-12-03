import React, { useState } from 'react';
import type { Player, Trophy, TrophyType } from '../types';
import TrophyIcon from './icons/TrophyIcon';
import ShieldIcon from './icons/ShieldIcon';
import TrashIcon from './icons/TrashIcon';

interface TrophyRoomProps {
  trophies: Trophy[];
  players: Player[];
  isAuthenticated: boolean;
  onAddTrophy: (trophy: Omit<Trophy, 'id'>) => Promise<void>;
  onDeleteTrophy: (id: string) => Promise<void>;
}

// Dit is de keuzelijst voor het toevoegen (mag uitgebreid zijn)
const TROPHY_TYPES: TrophyType[] = [
  'Clubkampioen', '2de', '3de',
  'Topscoorder', 'Verdediger', 'Speler van het jaar',
  '1ste NK', '2de NK', '3de NK',
  '1ste Introductietoernooi', '2de Introductietoernooi', '3de Introductietoernooi',
  '1ste Wintertoernooi', '2de Wintertoernooi', '3de Wintertoernooi'
];

// --- NIEUW: DIT BEPAALT DE VOLGORDE VAN WEERGEVE ---
const SORT_ORDER: TrophyType[] = [
  'Clubkampioen',
  '2de',
  '3de',
  'Topscoorder',
  'Verdediger',
  'Speler van het jaar'
  // Prijzen die hier niet tussen staan, komen automatisch achteraan
];

const TrophyRoom: React.FC<TrophyRoomProps> = ({ trophies, players, isAuthenticated, onAddTrophy, onDeleteTrophy }) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');
  const [selectedType, setSelectedType] = useState<TrophyType>('Clubkampioen');
  const [year, setYear] = useState<string>(String(new Date().getFullYear())); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || !year) return;
    
    setIsSubmitting(true);
    try {
      await onAddTrophy({
        playerId: Number(selectedPlayerId),
        type: selectedType,
        year: year 
      });
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

  // Groepeer prijzen per jaar
  const trophiesByYear = [...trophies].reduce((acc, trophy) => {
    if (!acc[trophy.year]) acc[trophy.year] = [];
    acc[trophy.year].push(trophy);
    return acc;
  }, {} as { [year: string]: Trophy[] });

  // Sorteer de jaren (Nieuwste boven, Winter boven Zomer)
  const sortedYears = Object.keys(trophiesByYear).sort((a, b) => {
    const yearA = Number(a.match(/\d{4}/)?.[0]) || 0;
    const yearB = Number(b.match(/\d{4}/)?.[0]) || 0;

    if (yearA !== yearB) return yearB - yearA;

    const isWinterA = a.toLowerCase().includes('winter');
    const isWinterB = b.toLowerCase().includes('winter');

    if (isWinterA && !isWinterB) return -1;
    if (!isWinterA && isWinterB) return 1;

    return b.localeCompare(a);
  });

  const getTrophyStyle = (type: TrophyType) => {
    if (type.includes('1ste') || type === 'Clubkampioen' || type === 'Speler van het jaar') return 'text-yellow-400';
    if (type.includes('2de')) return 'text-silver-300';
    if (type.includes('3de')) return 'text-amber-600';
    if (type === 'Topscoorder') return 'text-cyan-400';
    if (type === 'Verdediger') return 'text-fuchsia-400';
    return 'text-white';
  };

  const getTrophyIcon = (type: TrophyType) => {
      // Gebruik je aangepaste afbeelding voor de verdediger als je die lokaal ook hebt
      if (type === 'Verdediger') return <ShieldIcon className="w-8 h-8" />;
      return <TrophyIcon className="w-8 h-8" />;
  };

  return (
    <div className="space-y-8">
      
      {/* --- ADMIN FORM --- */}
      {isAuthenticated && (
        <div className="bg-gray-800 border-2 border-amber-500/30 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center">
            <span className="mr-2">+</span> Prijs Uitrijken
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
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

            <div>
                <label className="block text-sm text-gray-400 mb-1">Jaar / Seizoen</label>
                <input 
                    type="text" 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)} 
                    className="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 focus:border-amber-500 outline-none"
                    placeholder="bijv. 2025/1"
                />
            </div>

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

      {/* --- DISPLAY --- */}
      <div className="space-y-8">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">De Prijzenkast 🏆</h2>
            <p className="text-gray-400">Ere wie ere toekomt.</p>
        </div>

        {sortedYears.length === 0 ? (
            <p className="text-center text-gray-500 py-10">De kast is nog leeg...</p>
        ) : (
            sortedYears.map(yearKey => {
                const yearTrophies = trophiesByYear[yearKey];

                // --- HIER GEBEURT DE SORTERING VAN DE PRIJZEN ---
                const sortedTrophies = [...yearTrophies].sort((a, b) => {
                    let indexA = SORT_ORDER.indexOf(a.type);
                    let indexB = SORT_ORDER.indexOf(b.type);

                    // Als een prijs niet in de lijst staat, zet hem achteraan (999)
                    if (indexA === -1) indexA = 999;
                    if (indexB === -1) indexB = 999;

                    return indexA - indexB;
                });
                // ------------------------------------------------

                return (
                    <div key={yearKey} className="relative">
                        <div className="flex items-center mb-6">
                            <div className="flex-grow h-px bg-gray-700"></div>
                            <span className="px-4 text-2xl font-bold text-gray-500">{yearKey}</span>
                            <div className="flex-grow h-px bg-gray-700"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {sortedTrophies.map(trophy => {
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
