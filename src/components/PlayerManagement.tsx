import React, { useState } from 'react';
import type { Player, NewPlayer } from '../types';
import PlayerForm from './PlayerForm';
import UsersIcon from './icons/UsersIcon';
import EditIcon from './icons/EditIcon';
import TrashIcon from './icons/TrashIcon';

interface PlayerManagementProps {
  players: Player[];
  onAdd: (player: NewPlayer) => void;
  onUpdate: (player: Player) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}

const PlayerManagement: React.FC<PlayerManagementProps> = ({ players, onAdd, onUpdate, onDelete, isLoading }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  const handleOpenForm = (player?: Player) => {
    setEditingPlayer(player || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingPlayer(null);
    setIsFormOpen(false);
  };

  const handleSubmit = (playerData: NewPlayer | Player) => {
    if ('id' in playerData) {
      onUpdate(playerData as Player);
    } else {
      onAdd(playerData as NewPlayer);
    }
    handleCloseForm();
  };
  
  const handleConfirmDelete = () => {
    if (confirmingDeleteId !== null) {
      onDelete(confirmingDeleteId);
    }
    setConfirmingDeleteId(null);
  };

  const handleCancelDelete = () => {
    setConfirmingDeleteId(null);
  };


  return (
    <>
      <div className="bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <UsersIcon className="w-8 h-8 text-green-500" />
            <h2 className="ml-3 text-3xl font-bold text-white">Spelersbeheer</h2>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 transform hover:scale-105"
          >
            Speler Toevoegen
          </button>
        </div>

        {isLoading && confirmingDeleteId === null && <p className="text-center text-gray-400">Bezig met verwerken...</p>}

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {players.sort((a, b) => a.name.localeCompare(b.name)).map(player => (
            <div key={player.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center">
                <span className="text-lg font-medium text-gray-200">{player.name}</span>
                {player.isKeeper && (
                  <span className="ml-2 text-xs font-semibold bg-amber-500 text-white py-0.5 px-2 rounded-full">K</span>
                )}
                {player.isFixedMember && (
                  <span className="ml-2 text-xs font-semibold bg-green-500 text-white py-0.5 px-2 rounded-full">Lid</span>
                )}
              </div>
              <div className="flex items-center space-x-3">
                 {confirmingDeleteId === player.id ? (
                    <>
                        <span className="text-sm text-amber-300 font-semibold">Zeker?</span>
                        <button onClick={handleConfirmDelete} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-3 rounded-md transition-colors disabled:opacity-50">
                            {isLoading ? '...' : 'Verwijder'}
                        </button>
                        <button onClick={handleCancelDelete} disabled={isLoading} className="bg-gray-500 hover:bg-gray-400 text-white text-sm font-bold py-1 px-3 rounded-md transition-colors disabled:opacity-50">
                            Annuleren
                        </button>
                    </>
                 ) : (
                    <>
                        <span className="text-sm font-semibold bg-cyan-500 text-white py-1 px-3 rounded-full">
                            {player.rating}
                        </span>
                        <button onClick={() => handleOpenForm(player)} disabled={isLoading} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <EditIcon className="w-5 h-5 pointer-events-none"/>
                        </button>
                        <button onClick={() => setConfirmingDeleteId(player.id)} disabled={isLoading} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <TrashIcon className="w-5 h-5 pointer-events-none"/>
                        </button>
                    </>
                 )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isFormOpen && (
        <PlayerForm
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          initialData={editingPlayer}
        />
      )}
    </>
  );
};

export default PlayerManagement;
