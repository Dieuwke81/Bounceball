import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface StatsPrintViewProps {
  title: string;
  data: any[]; // De lijst met spelers/data
  type: 'points' | 'goals' | 'defense' | 'attendance';
  onClose: () => void;
}

const StatsPrintView: React.FC<StatsPrintViewProps> = ({ title, data, type, onClose }) => {
  
  useEffect(() => {
    // Start printen zodra dit component geladen is
    window.print();
    
    // Luister naar het sluiten van het printvenster (of annuleren)
    // Helaas werkt onafterprint niet in alle browsers consistent, 
    // maar we voeren de onClose uit om de state in de parent te resetten.
    const timeout = setTimeout(() => {
        onClose();
    }, 1000);

    window.onafterprint = () => {
        clearTimeout(timeout);
        onClose();
    };

    return () => clearTimeout(timeout);
  }, [onClose]);

  const headers = {
      points: ['Rank', 'Speler', 'Punten', 'Wedstrijden', 'Gemiddelde'],
      goals: ['Rank', 'Speler', 'Doelpunten', 'Wedstrijden', 'Gemiddelde'],
      defense: ['Rank', 'Speler', 'Tegengoals', 'Wedstrijden', 'Gemiddelde'],
      attendance: ['Rank', 'Speler', 'Aanwezig', 'Percentage', '']
  }[type];

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            /* Verberg de app achtergrond */
            body::before { display: none !important; }
            
            html, body {
              background: white !important;
              height: 100%;
              margin: 0;
              padding: 0;
            }
            body > *:not(.print-portal) { display: none !important; }
            .print-portal {
              display: block !important;
              position: absolute;
              top: 0; left: 0; width: 100%; height: 100%;
              background: white; color: black;
              font-family: sans-serif;
              z-index: 9999;
            }
            @page { size: A4; margin: 15mm; }
            tr:nth-child(even) { background-color: #f3f4f6; }
          }
        `}
      </style>

      <div className="p-8 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-gray-800 pb-4">
            <img 
                src="https://www.obverband.nl/wp-content/uploads/2019/01/logo-goed.png" 
                alt="Logo" 
                className="h-20 w-auto object-contain"
            />
            <div className="text-right">
                <h1 className="text-3xl font-bold uppercase tracking-wider">{title}</h1>
                <p className="text-gray-500">Statistieken Overzicht</p>
                <p className="text-sm text-gray-400 mt-1">Datum: {new Date().toLocaleDateString('nl-NL')}</p>
            </div>
        </div>

        {/* TABEL */}
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b-2 border-black">
                    {headers.map((h, i) => (
                        <th key={i} className={`py-2 px-2 font-bold uppercase text-sm ${i > 1 ? 'text-right' : ''}`}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.slice(0, 25).map((row, index) => (
                    <tr key={index} className="border-b border-gray-300">
                        <td className="py-3 px-2 font-bold w-12">{index + 1}.</td>
                        
                        {/* SPELER NAAM */}
                        <td className="py-3 px-2 font-semibold">
                            {/* We moeten even checken hoe de data binnenkomt, dit is een gok op basis van Statistics.tsx */}
                            {/* In Statistics sturen we objecten. We moeten de naam uit de map halen in de parent of hier. */}
                            {/* Omdat we 'playerMap' niet hebben hier, verwacht ik dat 'data' de verrijkte objecten bevat met 'playerName'. */}
                            {row.playerName}
                        </td>

                        {/* WAARDES (Afhankelijk van type) */}
                        {type === 'points' && (
                            <>
                                <td className="text-right px-2 font-bold">{row.points}</td>
                                <td className="text-right px-2">{row.games}</td>
                                <td className="text-right px-2">{row.avg.toFixed(2)}</td>
                            </>
                        )}
                        {type === 'goals' && (
                            <>
                                <td className="text-right px-2 font-bold">{row.goals}</td>
                                <td className="text-right px-2">{row.games}</td>
                                <td className="text-right px-2">{row.avg.toFixed(2)}</td>
                            </>
                        )}
                        {type === 'defense' && (
                            <>
                                <td className="text-right px-2 font-bold">{Math.round(row.avg * row.games)}</td>
                                <td className="text-right px-2">{row.games}</td>
                                <td className="text-right px-2">{row.avg.toFixed(2)}</td>
                            </>
                        )}
                        {type === 'attendance' && (
                            <>
                                <td className="text-right px-2 font-bold">{row.count}</td>
                                <td className="text-right px-2">{row.percentage.toFixed(0)}%</td>
                                <td></td>
                            </>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
        
        <div className="mt-8 text-center text-xs text-gray-400">
            Gegenereerd door Bounceball App
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StatsPrintView;
