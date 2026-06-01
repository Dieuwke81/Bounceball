import React, { useMemo } from 'react'; 
import type { Player } from '../types';
import UsersIcon from './icons/UsersIcon';

interface PlayerListProps {
  players: Player[];
  attendingPlayerIds: Set<number>;
  onPlayerToggle: (playerId: number) => void;
  // NIEUWE PROPS TOEGEVOEGD
  allPlayers: Player[]; 
  nonFixedMemberParticipationCounts: Map<number, number>;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  attendingPlayerIds, 
  onPlayerToggle,
  // NIEUWE PROPS ONTVANGEN
  allPlayers, 
  nonFixedMemberParticipationCounts,
}) => {
  // useMemo om een map te maken voor snelle lookup van volledige spelerinformatie
  const allPlayersMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-4">
        <UsersIcon className="w-6 h-6 text-cyan-400" />
        <h2 className="ml-3 text-2xl font-bold text-white">Spelerslijst</h2>
      </div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => {
          // Haal de volledige spelerdata op uit de allPlayersMap om zeker te zijn van isFixedMember
          const fullPlayerInfo = allPlayersMap.get(player.id) || player; 

          let nameColorClass = 'text-gray-200'; // Standaard kleur voor vaste leden
          let participationText = '';

          // Logica voor het bepalen van de naamkleur en extra tekst
          if (!fullPlayerInfo.isFixedMember) { // Als de speler GEEN vast lid is
            const participationCount = nonFixedMemberParticipationCounts.get(fullPlayerInfo.id) || 0;
            
            if (participationCount === 0) { // Nog niet meegedaan
              nameColorClass = 'text-gray-400'; // Bijvoorbeeld: lichtgrijs
              participationText = '(Nieuw)';
            } else if (participationCount <= 3) { // Eerste 1-3 keer
              nameColorClass = 'text-yellow-400'; // Bijvoorbeeld: geel voor 'proefperiode'
              participationText = `(${participationCount}e keer)`;
            } else { // Meer dan 3 keer, EN NOG STEEDS GEEN VAST LID
              nameColorClass = 'text-orange-400'; // Bijvoorbeeld: oranje om 'waarschuwing' te geven
              participationText = `(${participationCount}e keer)`;
            }
          }

          return (
            <label
              key={player.id}
              htmlFor={`player-${player.id}`}
              className="flex items-center justify-between p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors duration-200"
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`player-${player.id}`}
                  checked={attendingPlayerIds.has(player.id)}
                  onChange={() => onPlayerToggle(player.id)}
                  className="w-5 h-5 text-cyan-500 bg-gray-900 border-gray-600 rounded focus:ring-cyan-600 ring-offset-gray-800 focus:ring-2"
                />
                <span className={`ml-4 text-lg font-medium ${nameColorClass}`}>
                  {player.name}
                </span>
                {participationText && ( // Toon de deelname-tekst alleen als deze niet leeg is
                  <span className="ml-2 text-sm text-gray-500">{participationText}</span>
                )}
                {fullPlayerInfo.isKeeper && ( 
                  <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">
                    K
                  </span>
                )}
                {fullPlayerInfo.isFixedMember && ( // Toon "Lid" label voor vaste leden
                  <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">
                    Lid
                  </span>
                )}
              </div>
              {/* Je rating display (was uitgeschakeld) */}
              {/* <span className="text-sm font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">
                {player.rating}
              </span> */}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerList;
