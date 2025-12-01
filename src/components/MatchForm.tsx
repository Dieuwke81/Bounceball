import React from 'react';
import { createPortal } from 'react-dom';
import type { Player } from '../types';

interface MatchFormProps {
  teams: Player[][];
  date?: string;
}

const MatchForm: React.FC<MatchFormProps> = ({ teams, date }) => {
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (teams[i + 1]) {
      matches.push({
        blue: teams[i],
        yellow: teams[i + 1],
        matchNumber: (i / 2) + 1
      });
    }
  }

  const currentDate = date || new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            html, body {
              background: white !important;
              background-image: none !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body > *:not(.print-portal) {
              display: none !important;
            }
            .print-portal {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              margin: 0;
              z-index: 9999;
              background-color: white;
              color: black;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
            .match-page {
              page-break-after: always;
              break-after: page;
              min-height: 90vh;
              display: flex;
              flex-direction: column;
            }
            .match-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {matches.map((match, index) => {
        const maxRows = Math.max(match.blue.length, match.yellow.length, 6);
        const rows = Array.from({ length: maxRows });

        return (
          <div key={index} className="match-page">
            
            {/* HEADER */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold uppercase tracking-wider mb-1 text-black">Wedstrijdformulier</h1>
              <p className="text-sm text-gray-500">Bounceball Competitie</p>
            </div>

            <div className="flex justify-between items-center mb-8 text-lg border-b-2 border-gray-800 pb-2 text-black">
                <div><strong>Datum:</strong> {currentDate}</div>
                <div><strong>Zaal:</strong> {match.matchNumber}</div>
            </div>

            {/* --- WEDSTRIJD 1 --- */}
            <div className="mb-10 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 1
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-4">
                    <thead>
                        <tr>
                            {/* AANGEPAST: Breedte van 35% naar 25% voor namen */}
                            <th className="border border-black bg-blue-600 text-white w-[25%] py-2 text-lg uppercase">
                                TEAM BLAUW
                            </th>
                            {/* AANGEPAST: Breedte van 15% naar 25% voor doelpunten */}
                            <th className="border border-black w-[25%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            
                            {/* Zelfde aanpassing voor Geel */}
                            <th className="border border-black bg-yellow-300 text-black w-[25%] py-2 text-lg uppercase">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[25%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                <td className="border border-black px-2 font-bold text-base align-middle text-black">
                                    {match.blue[i]?.name || ''}
                                </td>
                                <td className="border border-black"></td>
                                <td className="border border-black px-2 font-bold text-base align-middle text-black">
                                    {match.yellow[i]?.name || ''}
                                </td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex items-end justify-center gap-6 text-black">
                    <div className="text-xl font-bold">Eindstand:</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-2xl font-bold border-b-2 border-black w-20 text-center">&nbsp;</div>
                </div>
            </div>

            {/* --- WEDSTRIJD 2 --- */}
            <div className="mb-4 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 2
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-4">
                    <thead>
                        <tr>
                            {/* AANGEPAST: Ook hier 25% / 25% */}
                            <th className="border border-black bg-blue-600 text-white w-[25%] py-2 text-lg uppercase">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[25%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[25%] py-2 text-lg uppercase">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[25%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                <td className="border border-black px-2 text-gray-300"></td>
                                <td className="border border-black"></td>
                                <td className="border border-black px-2 text-gray-300"></td>
                                <td className="border border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex items-end justify-center gap-6 text-black">
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
    </div>,
    document.body
  );
};

export default MatchForm;
