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

  const calculateAverage = (team: Player[]): string => {
    if (!team || team.length === 0) return '0.00';
    const total = team.reduce((sum, p) => sum + (p.rating || 0), 0);
    return (total / team.length).toFixed(2);
  };

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            html, body {
              background: white !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
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
              height: 100%;
              z-index: 9999;
              background-color: white;
              color: black;
              font-family: sans-serif;
            }
            @page {
              size: A4;
              margin: 10mm; 
            }
            .match-page {
              page-break-after: always;
              break-after: page;
              height: auto; /* Laat de hoogte natuurlijk vloeien */
              min-height: 95vh;
              display: flex;
              flex-direction: column;
            }
            .match-page:last-child {
              page-break-after: auto;
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

        const avgBlue = calculateAverage(match.blue);
        const avgYellow = calculateAverage(match.yellow);

        return (
          <div key={index} className="match-page">
            
            {/* HEADER - Compacte margin */}
            <div className="flex items-center justify-between mb-4 border-b-2 border-gray-800 pb-2">
               <div className="flex-shrink-0">
                 <img 
                   src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" 
                   alt="Logo" 
                   className="h-20 w-auto object-contain"
                 />
               </div>

               <div className="text-right flex-grow ml-6">
                  <h1 className="text-3xl font-bold uppercase tracking-wider text-black leading-none mb-1">
                    Wedstrijdformulier
                  </h1>
                  <div className="text-sm text-black">
                     <span className="font-bold mr-2">Datum:</span> {currentDate}
                  </div>
                  <div className="text-sm text-black">
                     <span className="font-bold mr-2">Zaal:</span> {match.matchNumber}
                  </div>
               </div>
            </div>

            {/* --- WEDSTRIJD 1 --- */}
            <div className="mb-6">
                <div className="border-2 border-black text-center font-bold text-lg py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 1
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-1">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[30%] py-2 text-base uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[20%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[30%] py-2 text-base uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[20%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => {
                            const blueName = match.blue[i]?.name;
                            let blueContent = <span className="font-bold text-sm text-black">{blueName}</span>;
                            if (!blueName && i === 5) {
                                blueContent = <span className="text-gray-500 italic text-xs">Gem. Rating: {avgBlue}</span>;
                            }

                            const yellowName = match.yellow[i]?.name;
                            let yellowContent = <span className="font-bold text-sm text-black">{yellowName}</span>;
                            if (!yellowName && i === 5) {
                                yellowContent = <span className="text-gray-500 italic text-xs">Gem. Rating: {avgYellow}</span>;
                            }

                            return (
                                /* Terug naar h-10 voor ruimtebesparing */
                                <tr key={i} className="h-10">
                                    <td className="border border-black px-2 align-middle bg-white">
                                        {blueContent || ''}
                                    </td>
                                    <td className="border border-black bg-white"></td>
                                    <td className="border border-black px-2 align-middle bg-white">
                                        {yellowContent || ''}
                                    </td>
                                    <td className="border border-black bg-white"></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* SCORE BALK: Exact uitgelijnd met de kolommen hierboven */}
                <div className="flex w-full items-center text-black">
                    {/* Kolom 1: Label rechts uitgelijnd (30%) */}
                    <div className="w-[30%] text-right pr-2 font-bold text-lg uppercase pt-1">
                        Eindstand:
                    </div>
                    
                    {/* Kolom 2: Vakje gecentreerd (20%) */}
                    <div className="w-[20%] flex justify-center pt-1">
                        <div className="border-2 border-black w-16 h-10 bg-white"></div>
                    </div>

                    {/* Kolom 3: Streepje gecentreerd (30%) */}
                    <div className="w-[30%] flex justify-center items-center pt-1">
                        <span className="text-2xl font-bold">-</span>
                    </div>

                    {/* Kolom 4: Vakje gecentreerd (20%) */}
                    <div className="w-[20%] flex justify-center pt-1">
                        <div className="border-2 border-black w-16 h-10 bg-white"></div>
                    </div>
                </div>
            </div>

            {/* --- WEDSTRIJD 2 --- */}
            {/* mt-auto duwt deze sectie naar beneden, maar niet te agressief */}
            <div className="mb-2 mt-auto">
                <div className="border-2 border-black text-center font-bold text-lg py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 2
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-1">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[30%] py-2 text-base uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[20%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[30%] py-2 text-base uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[20%] py-2 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                <td className="border border-black px-2 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                                <td className="border border-black px-2 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* SCORE BALK W2 */}
                <div className="flex w-full items-center text-black">
                    <div className="w-[30%] text-right pr-2 font-bold text-lg uppercase pt-1">
                        Eindstand:
                    </div>
                    <div className="w-[20%] flex justify-center pt-1">
                        <div className="border-2 border-black w-16 h-10 bg-white"></div>
                    </div>
                    <div className="w-[30%] flex justify-center items-center pt-1">
                        <span className="text-2xl font-bold">-</span>
                    </div>
                    <div className="w-[20%] flex justify-center pt-1">
                        <div className="border-2 border-black w-16 h-10 bg-white"></div>
                    </div>
                </div>
            </div>
            
            {/* FOOTER */}
            <div className="w-full text-center text-[10px] text-gray-400 pt-2 border-t border-gray-200">
                Gegenereerd door Bounceball App
            </div>

          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default MatchForm;
