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
          /* 1. Maak de hele pagina onzichtbaar */
          body * {
            visibility: hidden;
          }

          /* 2. Maak ALLEEN de print-container en alles daarin weer zichtbaar */
          .print-only, .print-only * {
            visibility: visible;
          }

          /* 3. Positioneer de print-container strak in de linkerbovenhoek van het papier */
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }

          /* 4. Pagina-instellingen */
          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .page-break {
            page-break-before: always !important;
            display: block !important;
            padding-top: 20px;
          }

          /* Voorkom lege pagina aan het begin */
          .page-break:first-of-type {
            page-break-before: avoid !important;
            padding-top: 0 !important;
          }

          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 20px !important; 
            page-break-inside: avoid !important;
            padding: 15px !important;
            color: black !important;
          }

          h1, h2, h3, div, span, table, td, th {
            color: black !important;
          }
          
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 2px solid black !important;
          }

          th, td {
            border: 1px solid black !important;
            padding: 8px !important;
          }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT (RONDE PER PAGINA) */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-8">
            <h1 className="text-3xl font-black mb-6 text-center border-b-4 border-black pb-2 uppercase">
              NK OVERZICHT - RONDE {round.roundNumber}
            </h1>
            <div className="grid grid-cols-1 gap-8">
              {round.matches.map(m => (
                <div key={m.id} className="match-card rounded-lg">
                  <div className="flex justify-between font-black text-xl mb-4 border-b-2 border-black pb-2">
                    <span>ZAAL: {m.hallName}</span>
                    <span>SCHEIDS: {m.referee?.name}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <div className="flex-1">
                      <div className="font-black underline mb-1 uppercase text-sm">TEAM BLAUW</div>
                      {m.team1.map(p => <div key={p.id} className="font-bold">{p.name}</div>)}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-black underline mb-1 uppercase text-sm">TEAM GEEL</div>
                      {m.team2.map(p => <div key={p.id} className="font-bold">{p.name}</div>)}
                    </div>
                  </div>
                  <div className="mt-4 pt-2 border-t-2 border-dashed border-black flex justify-around text-sm font-bold italic">
                    <span>Reserve 1: {m.subHigh?.name}</span>
                    <span>Reserve 2: {m.subLow?.name}</span>
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
              <tr className="bg-gray-200 text-black">
                <th className="p-2">RD</th>
                <th className="p-2">TEAM BLAUW</th>
                <th className="p-2">SCORE</th>
                <th className="p-2">TEAM GEEL</th>
                <th className="p-2">SCHEIDS</th>
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(r => {
                const m = r.matches.find(match => match.hallName === hall);
                if (!m) return null;
                return (
                  <tr key={r.roundNumber} className="text-center font-bold">
                    <td className="p-4 text-2xl">{r.roundNumber}</td>
                    <td className="p-2 text-sm uppercase">{m.team1.map(p => p.name).join(', ')}</td>
                    <td className="p-2 w-20 h-12 border-2 border-black"></td>
                    <td className="p-2 text-sm uppercase">{m.team2.map(p => p.name).join(', ')}</td>
                    <td className="p-2">{m.referee?.name}</td>
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
