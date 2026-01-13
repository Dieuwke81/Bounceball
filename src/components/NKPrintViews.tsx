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
          /* 1. Verberg de volledige App structuur zodat deze 0 pixels inneemt */
          #root > *:not(.print-only), 
          header, nav, footer, .no-print {
            display: none !important;
          }

          /* 2. Reset de body voor print */
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 3. Forceer de print-container strak bovenaan */
          .print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }

          /* 4. Pagina-eindes beheren */
          .page-break {
            page-break-before: always !important;
            display: block !important;
            clear: both !important;
          }

          /* VOORKOM DAT DE EERSTE PAGINA LEEG IS */
          .page-break:first-of-type {
            page-break-before: avoid !important;
            margin-top: 0 !important;
          }

          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 20px !important; 
            page-break-inside: avoid !important; 
            color: black !important;
          }

          h1, h2, h3, div, span, table, td, th {
            color: black !important;
            background: none !important;
            border-color: black !important;
          }
          
          table { border-collapse: collapse !important; width: 100% !important; }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT (RONDE PER PAGINA) */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break p-8">
          <h1 className="text-3xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase">
            NK OVERZICHT - RONDE {round.roundNumber}
          </h1>
          <div className="grid grid-cols-1 gap-8">
            {round.matches.map(m => (
              <div key={m.id} className="border-4 border-black p-4 rounded-lg">
                <div className="flex justify-between font-black text-xl mb-4 border-b-2 border-black">
                  <span>ZAAL: {m.hallName}</span>
                  <span>SCHEIDS: {m.referee?.name}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <div className="flex-1">
                    <div className="font-black underline mb-1 uppercase">TEAM BLAUW</div>
                    {m.team1.map(p => <div key={p.id}>{p.name}</div>)}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-black underline mb-1 uppercase">TEAM GEEL</div>
                    {m.team2.map(p => <div key={p.id}>{p.name}</div>)}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t-2 border-dashed border-black flex justify-around text-sm font-bold">
                  <span>Reserve 1: {m.subHigh?.name}</span>
                  <span>Reserve 2: {m.subLow?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* OPTIE 2: PER ZAAL */}
      {activePrintType === 'halls' && hallNames.map(hall => (
        <div key={hall} className="page-break p-8">
          <h1 className="text-3xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase tracking-tighter">
            WEDSTRIJDSCHEMA - ZAAL {hall}
          </h1>
          <table className="w-full border-collapse border-4 border-black">
            <thead>
              <tr className="bg-black text-white">
                <th className="border-2 border-black p-2">RD</th>
                <th className="border-2 border-black p-2">TEAM BLAUW</th>
                <th className="border-2 border-black p-2">SCORE</th>
                <th className="border-2 border-black p-2">TEAM GEEL</th>
                <th className="border-2 border-black p-2">SCHEIDS</th>
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(r => {
                const m = r.matches.find(match => match.hallName === hall);
                if (!m) return null;
                return (
                  <tr key={r.roundNumber} className="text-center font-bold">
                    <td className="border-2 border-black p-4 text-2xl">{r.roundNumber}</td>
                    <td className="border-2 border-black p-2 text-sm">{m.team1.map(p => p.name).join(', ')}</td>
                    <td className="border-2 border-black p-2 w-24"></td>
                    <td className="border-2 border-black p-2 text-sm">{m.team2.map(p => p.name).join(', ')}</td>
                    <td className="border-2 border-black p-2">{m.referee?.name}</td>
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
              <div key={ps.name} className="border-2 border-black p-2 text-[10px] break-inside-avoid">
                <div className="font-black bg-black text-white p-1 mb-1 uppercase">{ps.name}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-black font-black uppercase text-[8px]">
                      <th>RD</th>
                      <th>ZAAL</th>
                      <th>ROL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ps.rounds.map((r: any) => (
                      <tr key={r.round}>
                        <td className="w-6">{r.round}</td>
                        <td>{r.hall}</td>
                        <td className="font-bold">{r.role}</td>
                      </tr>
                    ))}
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
