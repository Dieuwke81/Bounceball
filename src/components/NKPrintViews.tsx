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
            margin: 0.5cm;
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

          /* 5. Ronde Titel Styling */
          .print-header {
            display: block !important;
            text-align: center !important;
            border-bottom: 4px solid black !important;
            margin-bottom: 10px !important;
            padding-bottom: 5px !important;
          }

          .print-header h1 {
            font-size: 22pt !important;
            font-weight: 900 !important;
            margin: 0 !important;
            text-transform: uppercase !important;
            color: black !important;
          }

          /* 6. Match Card (Compact voor 3 per pagina) */
          .match-card { 
            border: 2px solid #000 !important; 
            margin-bottom: 10px !important; 
            page-break-inside: avoid !important;
            padding: 10px 15px !important;
            background: white !important;
            border-radius: 12px;
          }

          .player-name {
            font-size: 14pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
          }

          /* Score invulvakken */
          .score-box {
            border: 2px solid black;
            width: 35pt;
            height: 35pt;
            background: white;
          }

          /* Kleuren */
          .color-blauw { color: #0000ff !important; } 
          .color-geel { color: #ffcc00 !important; } /* Echt geel zonder randje */
          .color-scheids { color: #db2777 !important; } 
          .color-reserve { color: #15803d !important; }

          .label-small { font-size: 9pt !important; font-weight: 900; }

          /* Tabel Styling voor optie 2 en 3 */
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

      {/* OPTIE 1: COMPLEET OVERZICHT (3 kaarten per pagina) */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-4">
            <div className="print-header">
              <h1>NK OVERZICHT - RONDE {round.roundNumber}</h1>
            </div>
            
            <div className="space-y-1">
              {round.matches.map(m => (
                <div key={m.id} className="match-card">
                  {/* HEADER VAN DE KAART: ZAAL + SCHEIDS */}
                  <div className="flex justify-between items-center mb-2 border-b-2 border-black pb-1">
                    <span className="text-xl font-black uppercase">ZAAL: {m.hallName}</span>
                    <div className="flex items-center">
                      <span className="color-scheids label-small uppercase mr-2">SCHEIDS:</span>
                      <span className="player-name">{m.referee?.name}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    {/* Team Blauw */}
                    <div className="flex-1">
                      <div className="label-small underline mb-1 color-blauw uppercase tracking-widest">TEAM BLAUW</div>
                      <div className="space-y-0.5">
                        {m.team1.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>

                    {/* Scorevakken in het midden */}
                    <div className="flex items-center gap-2 px-6">
                      <div className="score-box"></div>
                      <span className="font-black text-2xl">-</span>
                      <div className="score-box"></div>
                    </div>
                    
                    {/* Team Geel */}
                    <div className="flex-1 text-right">
                      <div className="label-small underline mb-1 color-geel uppercase tracking-widest">TEAM GEEL</div>
                      <div className="space-y-0.5">
                        {m.team2.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                  </div>

                  {/* RESERVES NAAST ELKAAR */}
                  <div className="mt-3 pt-2 border-t-2 border-dashed border-black flex justify-around">
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RESERVE 1:</span>
                        <span className="player-name ml-2" style={{fontSize: '12pt'}}>{m.subHigh?.name}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="color-reserve label-small uppercase font-black">RESERVE 2:</span>
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
      {activePrintType === 'halls' && hallNames.map(hall => (
        <div key={hall} className="page-break p-8">
          <div className="print-header">
            <h1>WEDSTRIJDSCHEMA - ZAAL {hall}</h1>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-black uppercase text-[10pt]">
                <th className="p-2 w-12 text-center">RD</th>
                <th className="p-2 color-blauw text-left">TEAM BLAUW</th>
                <th className="p-2 text-center w-24">SCORE</th>
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
                    <td className="p-1">
                      <div className="flex justify-center gap-1">
                        <div className="border border-black w-8 h-8"></div>
                        <div className="border border-black w-8 h-8"></div>
                      </div>
                    </td>
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
          <div className="print-header">
            <h1>INDIVIDUEEL SPELERS SCHEMA</h1>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {playerSchedules.map(ps => (
              <div key={ps.name} className="border-2 border-black p-1 break-inside-avoid">
                <div className="font-black bg-black text-white p-1 mb-1 uppercase text-center text-md">{ps.name}</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="font-black uppercase text-[7pt] bg-gray-100">
                      <th className="p-0.5 text-center w-8">RD</th>
                      <th className="p-0.5">ZAAL</th>
                      <th className="p-0.5">ROL</th>
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
                            <td className="font-bold text-center py-0.5 border-b border-gray-300">{r.round}</td>
                            <td className="uppercase text-[8pt] py-0.5 border-b border-gray-300">{r.hall}</td>
                            <td className={`font-black uppercase text-[8pt] py-0.5 border-b border-gray-300 ${roleColor}`}>{r.role}</td>
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
