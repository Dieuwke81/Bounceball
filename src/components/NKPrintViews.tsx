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

          /* 2. Maak de print-container en ALLES daarin zichtbaar */
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
            padding-top: 0 !important;
          }

          /* 4. Pagina-eindes per ronde */
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            background: white !important;
            margin-top: 0 !important;
            padding-top: 20px !important;
          }

          .page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* 5. Kleuren */
          .color-blauw { color: #0000ff !important; } 
          .color-geel { color: #ffd700 !important; } /* Helder geel zonder randje */
          .color-scheids { color: #db2777 !important; } 
          .color-reserve { color: #15803d !important; }

          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 20px !important; 
            page-break-inside: avoid !important;
            padding: 15px !important;
            background: white !important;
          }

          /* Namen van spelers */
          .player-name {
            font-size: 16pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
          }

          /* Namen voor reserves (iets kleiner om naast label te passen) */
          .reserve-name {
            font-size: 14pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
            margin-left: 8px;
          }

          .round-title { 
            font-size: 26pt !important; 
            font-weight: 900 !important;
            text-align: center !important;
            border-bottom: 4px solid black !important;
            margin-bottom: 30px !important;
            padding-bottom: 10px !important;
            width: 100% !important;
            display: block !important;
          }

          .label-small { font-size: 10pt !important; font-weight: 900; }

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

      {/* OPTIE 1: COMPLEET OVERZICHT */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-8">
            {/* TITEL BOVENAAN ELKE PAGINA */}
            <h1 className="round-title uppercase">
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
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RESERVE 1:</span>
                        <span className="reserve-name">{m.subHigh?.name}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RESERVE 2:</span>
                        <span className="reserve-name">{m.subLow?.name}</span>
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
          <h1 className="round-title uppercase tracking-tighter">
            WEDSTRIJDSCHEMA - ZAAL {hall}
          </h1>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-black uppercase">
                <th className="p-2 w-12 text-center">RD</th>
                <th className="p-2 color-blauw text-left">TEAM BLAUW</th>
                <th className="p-2 text-center">SCORE</th>
                <th className="p-2 color-geel text-left">TEAM GEEL</th>
                <th className="p-2 color-scheids text-left">SCHEIDS</th>
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(r => {
                const m = r.matches.find(match => match.hallName === hall);
                if (!m) return null;
                return (
                  <tr key={r.roundNumber} className="font-bold">
                    <td className="p-4 text-2xl text-center border-r-4 border-black">{r.roundNumber}</td>
                    <td className="p-2 text-sm uppercase">{m.team1.map(p => p.name).join(', ')}</td>
                    <td className="p-2 w-24 text-center"><div className="border-2 border-black h-10 w-full bg-white"></div></td>
                    <td className="p-2 text-sm uppercase">{m.team2.map(p => p.name).join(', ')}</td>
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
          <h1 className="round-title uppercase">INDIVIDUEEL SPELERS SCHEMA</h1>
          <div className="grid grid-cols-2 gap-4">
            {playerSchedules.map(ps => (
              <div key={ps.name} className="border-2 border-black p-2 break-inside-avoid">
                <div className="font-black bg-black text-white p-1 mb-1 uppercase text-center text-lg">{ps.name}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="font-black uppercase text-[10px] bg-gray-100">
                      <th className="border-b-2 border-black p-1 text-center">RD</th>
                      <th className="border-b-2 border-black p-1">ZAAL</th>
                      <th className="border-b-2 border-black p-1">ROL</th>
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
                            <td className="font-bold border-b border-gray-300 text-center">{r.round}</td>
                            <td className="border-b border-gray-300 uppercase text-xs">{r.hall}</td>
                            <td className={`font-black border-b border-gray-300 uppercase text-xs ${roleColor}`}>{r.role}</td>
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
