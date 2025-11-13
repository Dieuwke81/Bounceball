
import React, { useState, useMemo } from 'react';
import type { Player, Constraint, ConstraintType } from '../types';
import UsersIcon from './icons/UsersIcon';
import XIcon from './icons/XIcon';

interface TeamConstraintsProps {
  attendingPlayers: Player[];
  constraints: Constraint[];
  onAddConstraint: (constraint: Constraint) => void;
  onRemoveConstraint: (index: number) => void;
}

const constraintLabels: { [key in ConstraintType]: string } = {
  together: 'Moeten Samen Spelen',
  apart: 'Mogen Niet Samen Spelen',
  versus: 'Moeten Tegen Elkaar Spelen',
  must_be_5: 'Moet in een team van 5',
};

const TeamConstraints: React.FC<TeamConstraintsProps> = ({ attendingPlayers, constraints, onAddConstraint, onRemoveConstraint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ConstraintType>('together');
  const [player1, setPlayer1] = useState<string>('');
  const [player2, setPlayer2] = useState<string>('');
  const [error, setError] = useState('');

  const sortedPlayers = useMemo(() => 
    [...attendingPlayers].sort((a, b) => a.name.localeCompare(b.name)),
    [attendingPlayers]
  );
  
  const playerMap = useMemo(() => 
    new Map(attendingPlayers.map(p => [p.id, p.name])), 
    [attendingPlayers]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (type === 'must_be_5') {
      if (!player1) {
        setError('Selecteer een speler.');
        return;
      }
      onAddConstraint({
        type,
        playerIds: [parseInt(player1, 10)],
      });
    } else {
      if (!player1 || !player2) {
        setError('Selecteer twee spelers.');
        return;
      }
      if (player1 === player2) {
        setError('Selecteer twee verschillende spelers.');
        return;
      }
      onAddConstraint({
        type,
        playerIds: [parseInt(player1, 10), parseInt(player2, 10)],
      });
    }
    
    // Reset form
    setPlayer1('');
    setPlayer2('');
  };
  
  const getConstraintText = (constraint: Constraint): string => {
    const playerNames = constraint.playerIds.map(id => playerMap.get(id));
    if (playerNames.some(name => !name)) return "Ongeldige regel";

    const [p1Name, p2Name] = playerNames;

    switch (constraint.type) {
      case 'together': return `${p1Name} & ${p2Name} moeten samen`;
      case 'apart': return `${p1Name} & ${p2Name} mogen niet samen`;
      case 'versus': return `${p1Name} vs ${p2Name} moeten tegen elkaar`;
      case 'must_be_5': return `${p1Name} moet in een team van 5`;
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-6 flex justify-between items-center"
      >
        <div className="flex items-center">
            <UsersIcon className="w-6 h-6 text-fuchsia-400" />
            <h2 className="ml-3 text-2xl font-bold text-white">Team Restricties</h2>
            {constraints.length > 0 && <span className="ml-3 bg-fuchsia-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{constraints.length}</span>}
        </div>
        <span className={`transform transition-transform text-white ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="p-6 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="constraint-type" className="block text-sm font-medium text-gray-300 mb-1">Regel</label>
              <select
                id="constraint-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ConstraintType);
                  setPlayer1('');
                  setPlayer2('');
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
              >
                {Object.entries(constraintLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="player1" className="block text-sm font-medium text-gray-300 mb-1">{type === 'must_be_5' ? 'Speler' : 'Speler 1'}</label>
                <select id="player1" value={player1} onChange={(e) => setPlayer1(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                  <option value="">Selecteer...</option>
                  {sortedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {type !== 'must_be_5' && (
                <div>
                  <label htmlFor="player2" className="block text-sm font-medium text-gray-300 mb-1">Speler 2</label>
                  <select id="player2" value={player2} onChange={(e) => setPlayer2(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                    <option value="">Selecteer...</option>
                    {sortedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Regel Toevoegen
            </button>
          </form>

          {constraints.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Actieve Regels:</h3>
              <div className="space-y-2">
                {constraints.map((c, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                    <span className="text-gray-200">{getConstraintText(c)}</span>
                    <button onClick={() => onRemoveConstraint(i)} className="text-gray-400 hover:text-white">
                      <XIcon className="w-5 h-5"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamConstraints;