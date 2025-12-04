import React from 'react';
import { createPortal } from 'react-dom';
import type { Player } from '../types';

interface CompetitionPrintProps {
  data: {
    playerId: number;
    points: number;
    games: number;
    avg: number;
  }[];
  playerMap: Map<number, Player>;
  onClose: () => void; // Functie om de printmodus weer te sluiten
}

const CompetitionPrint: React.FC<CompetitionPrintProps> = ({ data, playerMap, onClose }) => {
  // Zodra dit component laadt, open de printer
  React.useEffect(() => {
    setTimeout(() => {
      window.print();
      // Na het printen (of annuleren) sluiten we dit scherm weer
      // Een kleine vertraging zodat de browser tijd heeft
      setTimeout(onClose, 500);
    }, 500);
  }, [onClose]);

  return createPortal(
    <div className="print-portal">
      <style>
        {`
          /* Forceer wit scherm, verberg alles van de normale app */
          @media print {
            html, body {
              background-color: white !important;
              height: 100%;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            /* Verberg alles behalve onze print-portal */
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
              z-index: 99999;
              background: white;
              color: black;
              font-family: Arial, sans-serif;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }

          /* Styling voor het A4tje */
          .print-container {
            padding: 20px;
            max-width: 210mm; /* A4 breedte */
            margin: 0 auto;
          }
          h1 {
            text-align: center;
            text-transform: uppercase;
            font-size: 24px;
            margin-bottom: 10px;
            border-bottom: 2px solid black;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 14px;
          }
          th {
            border-bottom: 2px solid black;
            text-align: left;
            padding: 5px;
            font-weight: bold;
          }
          td {
            border-bottom: 1px solid #ddd;
            padding: 8px 5px;
          }
          .rank-col { width: 40px; font-weight: bold; text-align: center; }
          .num-col { text-align: right; width: 80px; }
        `}
      </style>

      <div className="print-container">
        <h1>Competitie Stand</h1>
        
        <table>
          <thead>
            <tr>
              <th className="rank-col">#</th>
              <th>Naam</th>
              <th className="num-col">Punten</th>
              <th className="num-col">Wedstr.</th>
              <th className="num-col">Gem.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const player = playerMap.get(row.playerId);
              if (!player) return null;
              
              return (
                <tr key={row.playerId}>
                  <td className="rank-col">{index + 1}</td>
                  <td>{player.name}</td>
                  <td className="num-col">{row.points}</td>
                  <td className="num-col">{row.games}</td>
                  <td className="num-col">{row.avg.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  );
};

export default CompetitionPrint;
