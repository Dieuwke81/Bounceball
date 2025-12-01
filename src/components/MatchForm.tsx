import React from 'react';
import type { Player } from '../types';

interface MatchFormProps {
  teams: Player[][];
  date?: string;
}

const MatchForm: React.FC<MatchFormProps> = ({ teams, date }) => {
  // Genereer de wedstrijden (Team 1 vs 2, Team 3 vs 4, etc.)
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (teams[i + 1]) {
      matches.push({
        blue: teams[i],
        yellow: teams[i + 1],
        matchNumber: (i / 2) + 1 // Wedstrijd 1 -> Zaal 1, etc.
      });
    }
  }

  const currentDate = date || new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] text-black">
      <style>
        {`
          @media print {
            @page { 
                size: A4; 
                margin: 10mm; 
            }
            body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
            /* Dit zorgt ervoor dat elke wedstrijd op een NIEUW blad begint */
            .match-page { 
                page-break-after: always; 
                break-after: page;
                height: 100vh; /* Forceer hoogte om layout stabiel te houden */
                display: flex;
                flex-direction: column;
            }
            /* Voorkom een leeg blad na de allerlaatste wedstrijd */
            .match-page:last-child { 
                page-break-after: auto; 
                break-after: auto;
            }
          }
        `}
      </style>

      {matches.map((match, index) => {
        // Zorg dat de tabel altijd minimaal 6 regels heeft
        const maxRows = Math.max(match.blue.length, match.yellow.length, 6);
        const rows = Array.from({ length: maxRows });

        return (
          <div key={index} className="match-page">
            
            {/* HEADER */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold uppercase tracking-wider mb-1">Wedstrijdformulier</h1>
              <p className="text-sm text-gray-500">Bounceball Competitie</p>
            </div>

            <div className="flex justify-between items-center mb-8 text-lg border-b-2 border-gray-800 pb-2">
                <div><strong>Datum:</strong> {currentDate}</div>
                {/* Automatisch Zaal 1, 2, 3... */}
                <div><strong>Zaal:</strong> {match.matchNumber}</div>
            </div>

            {/* --- WEDSTRIJD 1 --- */}
            <div className="mb-10 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100">
                    Wedstrijd 1
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-4">
                    <thead>
                        <tr>
                            {/* BLAUWE KOP */}
                            <th className="border border-black bg-blue-600 text-white w-[35%] py-2 text-lg uppercase">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[15%] py-2 text-center text-gray-500 text-xs">
                                Doelpunten
                            </th>
                            {/* GELE KOP */}
                            <th className="border border-black bg-yellow-300 text-black w-[35%] py-2 text-lg uppercase">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[15%] py-2 text-center text-gray-500 text-xs">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                {/* Naam Speler Blauw */}
                                <td className="border border-black px-2 font-bold text-base align-middle">
                                    {match.blue[i]?.name || ''}
                                </td>
                                {/* Scorevakje */}
                                <td className="border border-black"></td>
                                
                                {/* Naam Speler Geel */}
                                <td className="border border-black px-2 font-bold text-base align-middle">
                                    {match.yellow[i]?.name || ''}
                                </td>
                                {/* Scorevakje */}
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex items-end justify-center gap-6">
                    <div className="text-xl font-bold">Eindstand:</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                </div>
            </div>

            {/* --- WEDSTRIJD 2 --- */}
            <div className="mb-4 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100">
                    Wedstrijd 2
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-4">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[35%] py-2 text-lg uppercase">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[15%] py-2 text-center text-gray-500 text-xs">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[35%] py-2 text-lg uppercase">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[15%] py-2 text-center text-gray-500 text-xs">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                {/* Namen leeglaten voor wedstrijd 2 */}
                                <td className="border border-black px-2 text-gray-300"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black px-2 text-gray-300"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex items-end justify-center gap-6">
                    <div className="text-xl font-bold">Eindstand:</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                </div>
            </div>
            
            {/* Footer */}
            <div className="w-full text-center text-xs text-gray-400 mt-auto pb-4">
                Wedstrijdformulier - Zaal {match.matchNumber} - Geprint via Bounceball App
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default MatchForm;
