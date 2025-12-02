import React from 'react';
import { createPortal } from 'react-dom';
import type { Player } from '../types';

interface MatchFormProps {
  teams: Player[][];
  date?: string;
}

const MatchForm: React.FC<MatchFormProps> = ({ teams, date }) => {
  // We koppelen teams aan elkaar (Team 0 vs Team 1, Team 2 vs Team 3, etc.)
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

  // Datum formatteren
  const currentDate = date || new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  // Hulpfunctie: Bereken gemiddelde rating van een team
  const calculateAverage = (team: Player[]): string => {
    if (!team || team.length === 0) return '0.0';
    const total = team.reduce((sum, p) => sum + (p.rating || 0), 0);
    return (total / team.length).toFixed(1);
  };

  // We gebruiken createPortal om buiten de normale app-structuur te renderen (handig voor print)
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
            /* Verberg de normale app interface */
            body > *:not(.print-portal) {
              display: none !important;
            }
            /* Toon het print formulier */
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
              font-family: sans-serif;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
            .match-page {
              page-break-after: always;
              break-after: page;
              min-height: 95vh; /* Iets verhoogd om de pagina mooi te vullen */
              display: flex;
              flex-direction: column;
            }
            .match-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            /* Zorg dat achtergrondkleuren (blauw/geel) geprint worden */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {matches.map((match, index) => {
        // Zorg altijd voor minimaal 6 rijen, zodat het formulier constant blijft
        const maxRows = Math.max(match.blue.length, match.yellow.length, 6);
        const rows = Array.from({ length: maxRows });

        // Bereken de gemiddeldes voor dit wedstrijdpaar
        const avgBlue = calculateAverage(match.blue);
        const avgYellow = calculateAverage(match.yellow);

        return (
          <div key={index} className="match-page">
            
            {/* --- HEADER MET LOGO --- */}
            <div className="flex items-center justify-between mb-6 border-b-2 border-gray-800 pb-4">
               {/* Het Logo links */}
               <div className="flex-shrink-0">
                 <img 
                   src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" 
                   alt="Logo" 
                   className="h-24 w-auto object-contain"
                 />
               </div>

               {/* Titel en Info rechts/midden */}
               <div className="text-right flex-grow ml-6">
                  <h1 className="text-4xl font-bold uppercase tracking-wider text-black leading-none mb-2">
                    Wedstrijdformulier
                  </h1>
                  <div className="text-lg text-black">
                     <span className="font-bold mr-4">Datum:</span> {currentDate}
                  </div>
                  <div className="text-lg text-black">
                     <span className="font-bold mr-4">Zaal:</span> {match.matchNumber}
                  </div>
               </div>
            </div>

            {/* --- WEDSTRIJD 1 SECTIE --- */}
            <div className="mb-8 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 1
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-6">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[25%] py-3 text-lg uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[25%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[25%] py-3 text-lg uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[25%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => {
                            // --- LOGICA VOOR BLAUW ---
                            const blueName = match.blue[i]?.name;
                            let blueContent = <span className="font-bold text-base text-black">{blueName}</span>;
                            
                            // Als er geen naam is, en het is de 6e rij (index 5), toon gemiddelde
                            if (!blueName && i === 5) {
                                blueContent = <span className="text-gray-500 italic text-sm">Gem. Rating: {avgBlue}</span>;
                            }

                            // --- LOGICA VOOR GEEL ---
                            const yellowName = match.yellow[i]?.name;
                            let yellowContent = <span className="font-bold text-base text-black">{yellowName}</span>;
                            
                            if (!yellowName && i === 5) {
                                yellowContent = <span className="text-gray-500 italic text-sm">Gem. Rating: {avgYellow}</span>;
                            }

                            return (
                                <tr key={i} className="h-12">
                                    <td className="border border-black px-3 align-middle bg-white">
                                        {blueContent || ''}
                                    </td>
                                    <td className="border border-black bg-white"></td>
                                    <td className="border border-black px-3 align-middle bg-white">
                                        {yellowContent || ''}
                                    </td>
                                    <td className="border border-black bg-white"></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Score vakken Wedstrijd 1 */}
                <div className="flex items-end justify-center gap-4 text-black mb-4">
                    <div className="text-xl font-bold mb-1">Eindstand:</div>
                    <div className="border-2 border-black w-24 h-12 flex items-center justify-center bg-white"></div>
                    <div className="text-2xl font-bold mb-1">-</div>
                    <div className="border-2 border-black w-24 h-12 flex items-center justify-center bg-white"></div>
                </div>
            </div>

            {/* --- WEDSTRIJD 2 SECTIE --- */}
            <div className="mb-4 flex-grow">
                <div className="border-2 border-black text-center font-bold text-xl py-1 mb-2 uppercase bg-gray-100 text-black">
                    Wedstrijd 2
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-6">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[25%] py-3 text-lg uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[25%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[25%] py-3 text-lg uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[25%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-12">
                                <td className="border border-black px-3 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                                <td className="border border-black px-3 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Score vakken Wedstrijd 2 */}
                <div className="flex items-end justify-center gap-4 text-black">
                    <div className="text-xl font-bold mb-1">Eindstand:</div>
                    <div className="border-2 border-black w-24 h-12 flex items-center justify-center bg-white"></div>
                    <div className="text-2xl font-bold mb-1">-</div>
                    <div className="border-2 border-black w-24 h-12 flex items-center justify-center bg-white"></div>
                </div>
            </div>
            
            {/* FOOTER */}
            <div className="w-full text-center text-xs text-gray-400 mt-auto pt-4 border-t border-gray-200">
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
