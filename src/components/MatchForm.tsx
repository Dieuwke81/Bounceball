import React from 'react';
import type { Player } from '../types';

interface MatchFormProps {
  teams: Player[][];
  date?: string;
}

const MatchForm: React.FC<MatchFormProps> = ({ teams, date }) => {
  // We gaan ervan uit dat Team 1 (index 0) Blauw is en Team 2 (index 1) Geel.
  // Als er meer teams zijn (toernooi), pakken we de eerste twee voor het formulier,
  // of je print meerdere blaadjes. Voor nu focussen we op de eerste wedstrijd.
  
  const teamBlue = teams[0] || [];
  const teamYellow = teams[1] || [];

  // We zorgen dat beide lijsten even lang zijn voor de tabel (vul aan met lege regels)
  const maxRows = Math.max(teamBlue.length, teamYellow.length, 6); // Minimaal 6 regels
  const rows = Array.from({ length: maxRows });

  const currentDate = date || new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black overflow-y-auto">
      {/* Container voor A4 layout */}
      <div className="max-w-[210mm] mx-auto bg-white h-full">
        
        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Wedstrijdformulier</h1>
          <p className="text-sm text-gray-500">Bounceball Competitie</p>
        </div>

        <div className="flex justify-between mb-6 text-lg border-b-2 border-gray-800 pb-2">
            <div><strong>Datum:</strong> {currentDate}</div>
            <div><strong>Zaal:</strong> _________________</div>
        </div>

        {/* WEDSTRIJD 1 */}
        <div className="mb-10">
            <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100">
                Wedstrijd 1
            </div>

            <table className="w-full border-collapse border border-black text-sm">
                <thead>
                    <tr>
                        <th className="border border-black bg-blue-200 w-1/4 py-1">TEAM BLAUW</th>
                        <th className="border border-black w-1/4 py-1">Doelpunten</th>
                        <th className="border border-black bg-yellow-100 w-1/4 py-1">TEAM GEEL</th>
                        <th className="border border-black w-1/4 py-1">Doelpunten</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((_, i) => (
                        <tr key={i} className="h-10">
                            {/* Speler Blauw */}
                            <td className="border border-black px-2 font-medium">
                                {teamBlue[i]?.name || ''}
                            </td>
                            {/* Score vakjes Blauw */}
                            <td className="border border-black"></td>
                            
                            {/* Speler Geel */}
                            <td className="border border-black px-2 font-medium">
                                {teamYellow[i]?.name || ''}
                            </td>
                            {/* Score vakjes Geel */}
                            <td className="border border-black"></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex items-end justify-between mt-4 px-10">
                <div className="text-xl font-bold">Eindstand: _______</div>
                <div className="text-xl font-bold">-</div>
                <div className="text-xl font-bold">_______</div>
            </div>
        </div>

        {/* WEDSTRIJD 2 (Leeg voor invullen in zaal) */}
        <div className="mb-4">
            <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100">
                Wedstrijd 2 (Return)
            </div>

            <table className="w-full border-collapse border border-black text-sm">
                <thead>
                    <tr>
                        <th className="border border-black bg-blue-200 w-1/4 py-1">TEAM BLAUW</th>
                        <th className="border border-black w-1/4 py-1">Doelpunten</th>
                        <th className="border border-black bg-yellow-100 w-1/4 py-1">TEAM GEEL</th>
                        <th className="border border-black w-1/4 py-1">Doelpunten</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((_, i) => (
                        <tr key={i} className="h-10">
                             {/* Hier laten we de namen leeg, of je kunt ze ook pre-fillen als je wilt */}
                            <td className="border border-black px-2"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black px-2"></td>
                            <td className="border border-black"></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex items-end justify-between mt-4 px-10">
                <div className="text-xl font-bold">Eindstand: _______</div>
                <div className="text-xl font-bold">-</div>
                <div className="text-xl font-bold">_______</div>
            </div>
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400">
            Geprint via Bounceball App
        </div>

      </div>
    </div>
  );
};

export default MatchForm;
