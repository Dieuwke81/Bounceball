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
              margin: 15mm; /* Iets meer marge rondom */
            }
            .match-page {
              page-break-after: always;
              break-after: page;
              height: 95vh; /* Gebruik bijna de hele pagina hoogte */
              display: flex;
              flex-direction: column;
              justify-content: flex-start; /* Start bovenaan, we gebruiken margins voor verdeling */
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
            
            {/* HEADER - Meer ruimte aan de bovenkant */}
            <div className="flex items-center justify-between mb-10 border-b-2 border-gray-800 pb-4 pt-4">
               <div className="flex-shrink-0">
                 <img 
                   src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" 
                   alt="Logo" 
                   className="h-24 w-auto object-contain"
                 />
               </div>

               <div className="text-right flex-grow ml-6">
                  <h1 className="text-4xl font-bold uppercase tracking-wider text-black leading-none mb-2">
                    Wedstrijdformulier
                  </h1>
                  <div className="text-lg text-black">
                     <span className="font-bold mr-2">Datum:</span> {currentDate}
                  </div>
                  <div className="text-lg text-black">
                     <span className="font-bold mr-2">Zaal:</span> {match.matchNumber}
                  </div>
               </div>
            </div>

            {/* --- WEDSTRIJD 1 --- */}
            <div className="mb-2">
                <div className="border-2 border-black text-center font-bold text-xl py-2 mb-4 uppercase bg-gray-100 text-black">
                    Wedstrijd 1
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-1">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[20%] py-3 text-lg uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[30%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[20%] py-3 text-lg uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[30%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => {
                            const blueName = match.blue[i]?.name;
                            let blueContent = <span className="font-bold text-base text-black">{blueName}</span>;
                            if (!blueName && i === 5) {
                                blueContent = <span className="text-gray-500 italic text-sm">Gem. Rating: {avgBlue}</span>;
                            }

                            const yellowName = match.yellow[i]?.name;
                            let yellowContent = <span className="font-bold text-base text-black">{yellowName}</span>;
                            if (!yellowName && i === 5) {
                                yellowContent = <span className="text-gray-500 italic text-sm">Gem. Rating: {avgYellow}</span>;
                            }

                            return (
                                /* Iets hogere regels (h-12) om pagina beter te vullen */
                                <tr key={i} className="h-10">
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

                {/* SCORE BALK ONDER DE TABEL */}
                <div className="flex w-full items-center">
                    {/* Kolom 1: Label (30%) */}
                    <div className="w-[30%] text-right pr-4 font-bold text-xl uppercase pt-2">
                        Eindstand:
                    </div>
                    
                    {/* Kolom 2: Vakje onder Blauw Doelpunten (20%) */}
                    <div className="w-[20%] flex justify-center pt-2">
                        <div className="border-2 border-black w-20 h-12 bg-white"></div>
                    </div>

                    {/* Kolom 3: Streepje onder Geel Naam (30%) */}
                    <div className="w-[30%] flex justify-center items-center pt-2">
                        <span className="text-4xl font-bold">-</span>
                    </div>

                    {/* Kolom 4: Vakje onder Geel Doelpunten (20%) */}
                    <div className="w-[20%] flex justify-center pt-2">
                        <div className="border-2 border-black w-20 h-12 bg-white"></div>
                    </div>
                </div>
            </div>

            {/* --- WEDSTRIJD 2 --- */}
            {/* margin-top-auto zorgt dat deze sectie netjes naar beneden zakt als er ruimte over is */}
            <div className="mb-4">
                <div className="border-2 border-black text-center font-bold text-xl py-2 mb-4 uppercase bg-gray-100 text-black">
                    Wedstrijd 2
                </div>

                <table className="w-full border-collapse border border-black text-sm mb-1">
                    <thead>
                        <tr>
                            <th className="border border-black bg-blue-600 text-white w-[20%] py-3 text-lg uppercase font-bold">
                                TEAM BLAUW
                            </th>
                            <th className="border border-black w-[30%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                            <th className="border border-black bg-yellow-300 text-black w-[20%] py-3 text-lg uppercase font-bold">
                                TEAM GEEL
                            </th>
                            <th className="border border-black w-[30%] py-3 text-center text-gray-500 text-xs text-black">
                                Doelpunten
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, i) => (
                            <tr key={i} className="h-10">
                                <td className="border border-black px-3 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                                <td className="border border-black px-3 align-middle bg-white"></td>
                                <td className="border border-black bg-white"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* SCORE BALK ONDER DE TABEL */}
                <div className="flex w-full items-center">
                    <div className="w-[30%] text-right pr-4 font-bold text-xl uppercase pt-2">
                        Eindstand:
                    </div>
                    <div className="w-[20%] flex justify-center pt-2">
                        <div className="border-2 border-black w-20 h-12 bg-white"></div>
                    </div>
                    <div className="w-[30%] flex justify-center items-center pt-2">
                        <span className="text-4xl font-bold">-</span>
                    </div>
                    <div className="w-[20%] flex justify-center pt-2">
                        <div className="border-2 border-black w-20 h-12 bg-white"></div>
                    </div>
                </div>
            </div>
            
            {/* FOOTER */}
            <div className="w-full text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
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
