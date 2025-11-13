
import React from 'react';
import type { Player } from '../types';
import UsersIcon from './icons/UsersIcon';

interface PlayerListProps {
  players: Player[];
  attendingPlayerIds: Set<number>;
  onPlayerToggle: (playerId: number) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({ players, attendingPlayerIds, onPlayerToggle }) => {
  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-4">
        <UsersIcon className="w-6 h-6 text-cyan-400" />
        <h2 className="ml-3 text-2xl font-bold text-white">Spelerslijst</h2>
      </div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
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
              <span className="ml-4 text-lg font-medium text-gray-200">{player.name}</span>
              {player.isKeeper && (
                <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">
                  K
                </span>
              )}
            </div>
            <span className="text-sm font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">
              {player.rating}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;