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
          /* 1. Reset en Verberg alles */
          body * {
            visibility: hidden;
          }
          
          /* 2. Maak Print-onderdelen zichtbaar */
          .print-only, .print-only * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 3. Pagina-eindes zonder lege pagina's */
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            background: white !important;
          }

          /* Voorkom lege pagina aan het eind */
          .page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* 4. Kleuren Styling */
          .color-blauw { color: #1d4ed8 !important; } /* Blauw */
          .color-geel { color: #b45309 !important; }  /* Donkergeel (beter leesbaar op wit) */
          .color-scheids { color: #db2777 !important; } /* Roze */
          .color-reserve { color: #15803d !important; } /* Groen */

          /* 5. Kaart en Tabel styling */
          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 20px !important; 
            page-break-inside: avoid !important;
            padding: 12px !important;
            background: white !important;
          }

          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 2px solid black !important;
          }

          th, td {
            border: 1px solid black !important;
            padding: 6px !important;
          }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-6">
            <h1 className="text-3xl font-black mb-4 text-center border-b-4 border-black pb-2 uppercase">
              NK OVERZICHT - RONDE {round.roundNumber}
            </h1>
            <div className="grid grid-cols-1 gap-6">
              {round.matches.map(m => (
                <div key={m.id} className="match-card rounded-lg">
                  <div className="flex justify-between font-black text-lg mb-2 border-b border-black pb-1">
                    <span>ZAAL: {m.hallName}</span>
                    <span><span className="color-scheids uppercase">Scheids</span>: {m.referee?.name}</span>
                  </div>
                  <div className="flex justify-between text-md">
                    <div className="flex-1">
                      <div className="font-black underline mb-1 uppercase text-xs color-blauw">TEAM BLAUW</div>
                      {m.team1.map(p => <div key={p.id} className="font-bold">{p.name}</div>)}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-black underline mb-1 uppercase text-xs color-geel">TEAM GEEL</div>
                      {m.team2.map(p => <div key={p.id} className="font-bold">{p.name}</div>)}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-dashed border-black flex justify-around text-xs font-bold">
                    <span><span className="color-reserve italic">Reserve</span> 1: {m.subHigh?.name}</span>
                    <span><span className="color-reserve italic">Reserve</span> 2: {m.subLow?.name}</span>
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
              <tr className="bg-gray-100 text-black uppercase text-xs">
                <th className="p-2">RD</th>
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
                    <td className="p-4 text-2xl">{r.roundNumber}</td>
                    <td className="p-2 text-sm uppercase color-blauw">{m.team1.map(p => p.name).join(', ')}</td>
                    <td className="p-2 w-20 h-10 border-2 border-black"></td>
                    <td className="p-2 text-sm uppercase color-geel">{m.team2.map(p => p.name).join(', ')}</td>
                    <td className="p-2 color-scheids uppercase text-sm">{m.referee?.name}</td>
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
              <div key={ps.name} className="border-2 border-black p-2 text-[10px] break-inside-avoid shadow-sm">
                <div className="font-black bg-black text-white p-1 mb-1 uppercase text-center">{ps.name}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-black font-black uppercase text-[8px]">
                      <th>RD</th>
                      <th>ZAAL</th>
                      <th>ROL</th>
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
                            <td className="w-6">{r.round}</td>
                            <td>{r.hall}</td>
                            <td className={`font-bold ${roleColor}`}>{r.role}</td>
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
