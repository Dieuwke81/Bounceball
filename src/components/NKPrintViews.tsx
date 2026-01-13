import React from 'react';
import { NKSession } from '../types';

interface NKPrintViewsProps {
  session: NKSession;
  activePrintType: 'overview' | 'halls' | 'players' | null;
  hallNames: string[];
  playerSchedules: any[];
}

const NKPrintViews: React.FC<NKPrintViewsProps> = ({ session, activePrintType, hallNames, playerSchedules }) => {
  if (!activePrintType) return null;

  return (
    <div className="print-only">
      <style>{`
        @media print {
          /* 1. Verberg ALLES van de app */
          body * { visibility: hidden; }
          
          /* 2. Maak alleen de print-container en ALLES daarin zichtbaar */
          .print-only, .print-only * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 3. Positionering op papier */
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 4. Pagina basis instellingen */
          @page {
            size: A4;
            margin: 1cm;
          }

          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            width: 100%;
          }

          .page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* 5. Ronde Titel (Zorg dat deze bovenaan staat) */
          .print-title {
            display: block !important;
            text-align: center !important;
            font-size: 22pt !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            border-bottom: 4px solid black !important;
            margin-bottom: 15px !important;
            padding-bottom: 5px !important;
            color: black !important;
          }

          /* 6. Match Card (Zeer compact voor 3 zalen op 1 vel) */
          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 12px !important; 
            page-break-inside: avoid !important;
            padding: 8px 12px !important;
            background: white !important;
            border-radius: 8px;
          }

          .player-name {
            font-size: 14pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
            line-height: 1.1;
          }

          .score-box {
            border: 2px solid black;
            width: 32pt;
            height: 32pt;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: white;
          }

          /* Kleuren */
          .color-blauw { color: #0000ff !important; } 
          .color-geel { color: #ffcc00 !important; } /* Helder geel, geen stroke */
          .color-scheids { color: #db2777 !important; } 
          .color-reserve { color: #15803d !important; }

          .label-small { font-size: 8pt !important; font-weight: 900; }

          /* Tabel (Halls/Players) */
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 2px solid black !important;
          }

          th, td {
            border: 1px solid black !important;
            padding: 4px !important;
            font-size: 10pt !important;
          }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-2">
            <div className="print-title">
              NK OVERZICHT - RONDE {round.roundNumber}
            </div>
            
            <div className="space-y-1">
              {round.matches.map(m => (
                <div key={m.id} className="match-card">
                  <div className="flex justify-between items-center mb-1 border-b border-black pb-1">
                    <span className="text-lg font-black uppercase">ZAAL: {m.hallName}</span>
                    <div className="flex items-center">
                      <span className="color-scheids label-small uppercase mr-2">SCHEIDS:</span>
                      <span className="player-name">{m.referee?.name}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    {/* Team Blauw */}
                    <div className="flex-1">
                      <div className="label-small underline mb-1 color-blauw uppercase">TEAM BLAUW</div>
                      <div className="space-y-0">
                        {m.team1.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>

                    {/* Score Invulvakken */}
                    <div className="flex items-center gap-2 px-6">
                      <div className="score-box"></div>
                      <span className="font-black text-xl">-</span>
                      <div className="score-box"></div>
                    </div>
                    
                    {/* Team Geel */}
                    <div className="flex-1 text-right">
                      <div className="label-small underline mb-1 color-geel uppercase">TEAM GEEL</div>
                      <div className="space-y-0">
                        {m.team2.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-dashed border-black flex justify-around">
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RES 1:</span>
                        <span className="player-name ml-2" style={{fontSize: '12pt'}}>{m.subHigh?.name}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RES 2:</span>
                        <span className="player-name ml-2" style={{fontSize: '12pt'}}>{m.subLow?.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* OPTIE 2: PER ZAAL */}
      {active
