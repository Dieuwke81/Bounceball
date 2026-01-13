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
          /* 1. Verberg de rest van de website */
          body * {
            visibility: hidden;
          }

          /* 2. Maak de print-container en ALLES daarin (inclusief tekst) zichtbaar */
          .print-only, 
          .print-only * {
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
          }

          /* 4. Pagina-eindes per ronde */
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* 5. Kleuren en Lettertypes */
          .color-blauw { color: #0000ff !important; } /* Helder Blauw */
          .color-geel { color: #ffff00 !important; -webkit-text-stroke: 0.5px black; } /* Echt Geel met dun randje voor leesbaarheid */
          .color-scheids { color: #db2777 !important; } /* Roze */
          .color-reserve { color: #15803d !important; } /* Groen */

          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 20px !important; 
            page-break-inside: avoid !important;
            padding: 15px !important;
            background: white !important;
          }

          /* Namen van spelers en reserves overal even groot */
          .player-name {
            font-size: 16pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
          }

          h1 { font-size: 24pt !important; }
          .label-small { font-size: 10pt !important; font-weight: 900; }

          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 2px solid black !important;
          }

          th, td {
            border: 1px solid black !important;
            padding: 8px !important;
            font-size: 12pt !important;
          }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-8">
            <h1 className="text-3xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase">
              NK OVERZICHT - RONDE {round.roundNumber}
            </h1>
            <div className="grid grid-cols-1 gap-8">
              {round.matches.map(m => (
                <div key={m.id} className="match-card rounded-lg">
                  <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-2">
                    <span className="text-xl font-black uppercase tracking-tighter">ZAAL: {m.hallName}</span>
                    <span className="text-lg font-black"><span className="color-scheids uppercase">SCHEIDS</span>: <span className="player-name">{m.referee?.name}</span></span>
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="label-small underline mb-2 color-blauw uppercase tracking-widest">TEAM BLAUW</div>
                      <div className="space-y-1">
                        {m.team1.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                    
                    <div className="flex-1 text-right">
                      <div className="label-small underline mb-2 color-geel uppercase tracking-widest">TEAM GEEL</div>
                      <div className="space-y-1">
                        {m.team2.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t-2 border-dashed border-black flex justify-around">
                    <div className="text-center">
                        <span className="color-reserve label-small uppercase block">RESERVE 1</span>
                        <span className="player-name">{m.subHigh?.name}</span>
                    </div>
                    <div className="text-center">
                        <span className="color-reserve label-small uppercase block">RESERVE 2</span>
                        <span className="player-name">{m.subLow?.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* OPTIE 2: PER ZAAL */}
      {activePrintType === 'halls' && hallNames.map(hall => (
        <div key={hall} className="page-break p-8">
          <h1 className="text-3xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase tracking-tighter">
            WEDSTRIJDSCHEMA - ZAAL {hall}
          </h1>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-black uppercase">
                <th className="p-2 w-12">RD</th>
                <th className="p-2 color-blauw">TEAM BLAUW</th>
                <th className="p-2">SCORE</th>
                <th className="p-2 color-geel">TEAM GEEL</th>
                <th className="p-2 color-scheids">SCHEIDS</th>
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(r => {
                const m = r.matches.find(match => match.hallName === hall);
                if (!m) return null;
                return (
                  <tr key={r.roundNumber} className="text-center font-bold">
                    <td className="p-4 text-2xl border-r-4 border-black">{r.roundNumber}</td>
                    <td className="p-2 text-sm">{m.team1.map(p => p.name).join(', ')}</td>
                    <td className="p-2 w-24"><div className="border-2 border-black h-12 w-full"></div></td>
                    <td className="p-2 text-sm">{m.team2.map(p => p.name).join(', ')}</td>
                    <td className="p-2 text-sm uppercase">{m.referee?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* OPTIE 3: INDIVIDUELE SPELERS OVERZICHT */}
      {activePrintType === 'players' && (
        <div className="p-4">
          <h1 className="text-2xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase">
            INDIVIDUEEL SPELERS SCHEMA
          </h1>
          <div className="grid grid-cols-2 gap-4">
            {playerSchedules.map(ps => (
              <div key={ps.name} className="border-2 border-black p-2 break-inside-avoid">
                <div className="font-black bg-black text-white p-1 mb-1 uppercase text-center text-lg">{ps.name}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="font-black uppercase text-[10px]">
                      <th className="border-b-2 border-black">RD</th>
                      <th className="border-b-2 border-black">ZAAL</th>
                      <th className="border-b-2 border-black">ROL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ps.rounds.map((r: any) => {
                        let roleColor = "";
                        if (r.role === "BLAUW") roleColor = "color-blauw";
                        if (r.role === "GEEL") roleColor = "color-geel";
                        if (r.role === "REF") roleColor = "color-scheids";
                        if (r.role === "RES") roleColor = "color-reserve";

                        return (
                          <tr key={r.round}>
                            <td className="font-bold border-b border-gray-300">{r.round}</td>
                            <td className="border-b border-gray-300 uppercase">{r.hall}</td>
                            <td className={`font-black border-b border-gray-300 uppercase ${roleColor}`}>{r.role}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NKPrintViews;
