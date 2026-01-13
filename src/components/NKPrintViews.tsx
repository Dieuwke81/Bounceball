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
          /* 1. Verberg app-onderdelen */
          body * { visibility: hidden; }
          .print-only, .print-only * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Pagina basis */
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }

          body { margin: 0 !important; padding: 0 !important; background: white !important; }

          /* 3. Header Styling */
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

          /* 4. Pagina-eindes */
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

          /* 5. Kleuren Systeem */
          .color-blauw { color: #0000ff !important; } 
          .color-geel { color: #ffd700 !important; } 
          .color-scheids { color: #db2777 !important; } 
          .color-reserve { color: #15803d !important; }
          
          .bg-blauw-trans { background-color: rgba(0, 0, 255, 0.08) !important; }
          .bg-geel-trans { background-color: rgba(255, 215, 0, 0.12) !important; }
          .bg-scheids-trans { background-color: rgba(219, 39, 119, 0.08) !important; }
          .bg-reserve-trans { background-color: rgba(21, 128, 61, 0.08) !important; }

          /* 6. Match Card (OVERZICHT) */
          .match-card { 
            border: 3px solid #000 !important; 
            margin-bottom: 10px !important; 
            page-break-inside: avoid !important;
            padding: 10px 15px !important;
            background: white !important;
            border-radius: 12px;
          }

          .hall-label {
            font-size: 20pt !important;
            font-weight: 900 !important;
            text-transform: uppercase;
            color: black !important;
          }

          .player-name {
            font-size: 14pt !important;
            font-weight: bold !important;
            color: black !important;
            text-transform: uppercase;
          }

          .score-box {
            border: 2px solid black;
            width: 38pt;
            height: 38pt;
            background: white !important;
          }

          .label-small { font-size: 9pt !important; font-weight: 900; }

          /* 7. Tabel Styling */
          .print-table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 2px solid black !important;
            color: black !important;
          }

          .print-table th {
            border: 2px solid black !important;
            padding: 8px !important;
            font-size: 10pt !important;
            font-weight: 900 !important;
            background: #f0f0f0 !important;
            color: black !important;
          }

          .print-table td {
            border: 2px solid black !important;
            padding: 6px !important;
            vertical-align: middle !important;
            color: black !important;
          }

          .small-score-box {
            border: 1.5px solid black;
            width: 25pt;
            height: 25pt;
            display: inline-block;
            background: white !important;
          }
        }
      `}</style>

      {/* OPTIE 1: COMPLEET OVERZICHT */}
      {activePrintType === 'overview' && session.rounds.map((round) => (
        <div key={round.roundNumber} className="page-break">
          <div className="p-4">
            <div className="print-header">
              <h1>NK OVERZICHT - RONDE {round.roundNumber}</h1>
            </div>
            <div className="space-y-2">
              {round.matches.map(m => (
                <div key={m.id} className="match-card">
                  <div className="flex justify-between items-center mb-2 border-b-2 border-black pb-1">
                    <span className="hall-label">ZAAL: {m.hallName}</span>
                    <div className="flex items-center">
                      <span className="color-scheids label-small uppercase mr-2">SCHEIDS:</span>
                      <span className="player-name">{m.referee?.name}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="label-small underline mb-1 color-blauw uppercase tracking-widest">TEAM BLAUW</div>
                      <div className="space-y-0.5">
                        {m.team1.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-6">
                      <div className="score-box"></div>
                      <span className="font-black text-2xl" style={{color: 'black'}}>-</span>
                      <div className="score-box"></div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="label-small underline mb-1 color-geel uppercase tracking-widest">TEAM GEEL</div>
                      <div className="space-y-0.5">
                        {m.team2.map(p => <div key={p.id} className="player-name">{p.name}</div>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-2 border-t-2 border-dashed border-black flex justify-around">
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
      {activePrintType === 'halls' && session.hallNames.map(hall => (
        <div key={hall} className="page-break p-8">
          <div className="print-header">
            <h1>WEDSTRIJDSCHEMA - ZAAL {hall}</h1>
          </div>
          <table className="print-table">
            <thead>
              <tr className="uppercase">
                <th className="w-10">RD</th>
                <th className="color-blauw text-left">TEAM BLAUW</th>
                <th className="text-center w-28">SCORE</th>
                <th className="color-geel text-left">TEAM GEEL</th>
                <th className="color-scheids text-left">SCHEIDS</th>
                <th className="color-reserve text-left">RESERVES</th>
              </tr>
            </thead>
            <tbody>
              {session.rounds.map(r => {
                const m = r.matches.find(match => match.hallName.trim().toUpperCase() === hall.trim().toUpperCase());
                if (!m) return null;

                return (
                  <tr key={r.roundNumber} className="font-bold uppercase">
                    <td className="text-center text-xl bg-gray-50">{r.roundNumber}</td>
                    <td className="text-[9pt] bg-blauw-trans">
                      {m.team1.map(p => <div key={p.id}>{p.name}</div>)}
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center items-center gap-1">
                        <div className="small-score-box"></div>
                        <span style={{color: 'black'}}>-</span>
                        <div className="small-score-box"></div>
                      </div>
                    </td>
                    <td className="text-[9pt] bg-geel-trans">
                      {m.team2.map(p => <div key={p.id}>{p.name}</div>)}
                    </td>
                    <td className="text-[9pt] bg-scheids-trans">
                      {m.referee?.name}
                    </td>
                    <td className="text-[8pt] bg-reserve-trans">
                      <div>1: {m.subHigh?.name}</div>
                      <div>2: {m.subLow?.name}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* OPTIE 3: INDIVIDUELE SPELERS OVERZICHT (1 SPELER PER PAGINA) */}
      {activePrintType === 'players' && playerSchedules.map(ps => (
        <div key={ps.name} className="page-break p-6">
          <div className="print-header">
            <h1>PERSOONLIJK SCHEMA: {ps.name}</h1>
          </div>
          
          <table className="print-table" style={{marginTop: '10px'}}>
            <thead>
              <tr className="bg-gray-100 uppercase text-[9pt] color-black">
                <th className="w-12 text-center">RD</th>
                <th className="w-20 text-center">ZAAL</th>
                <th className="text-left">ROL</th>
                <th className="w-28 text-center">PUNTEN (3, 1, 0)</th>
              </tr>
            </thead>
            <tbody>
              {ps.rounds.map((r: any) => {
                  let roleClass = "";
                  if (r.role === "BLAUW") roleClass = "bg-blauw-trans";
                  if (r.role === "GEEL") roleClass = "bg-geel-trans";
                  if (r.role === "REF") roleClass = "bg-scheids-trans";
                  if (r.role === "RES") roleClass = "bg-reserve-trans";
                  
                  let roleTextColor = "";
                  if (r.role === "BLAUW") roleTextColor = "color-blauw";
                  if (r.role === "GEEL") roleTextColor = "color-geel";
                  if (r.role === "REF") roleTextColor = "color-scheids";
                  if (r.role === "RES") roleTextColor = "color-reserve";

                  return (
                    <tr key={r.round} className={roleClass}>
                      <td className="text-center text-xl py-2 font-black">{r.round}</td>
                      <td className="text-center text-3xl font-black uppercase">{r.hall}</td>
                      <td className={`font-black uppercase text-lg ${roleTextColor}`}>{r.role}</td>
                      <td className="text-center">
                        {r.hall !== '-' && (r.role === "BLAUW" || r.role === "GEEL") ? (
                           <div className="border-2 border-black w-10 h-10 mx-auto bg-white"></div>
                        ) : (
                           <span className="text-gray-400 text-[7pt]">N.v.t.</span>
                        )}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
            {/* TOTAAL VAK ONDERAAN DE TABEL */}
            <tfoot>
                <tr className="bg-gray-50">
                    <td colSpan={2} className="border-none"></td>
                    <td className="text-right font-black text-xl py-4 pr-4 uppercase">TOTAAL:</td>
                    <td className="text-center">
                        <div className="border-4 border-black w-14 h-14 mx-auto bg-white"></div>
                    </td>
                </tr>
            </tfoot>
          </table>
          
          <div className="mt-4 text-center p-3 border-2 border-dashed border-gray-400 rounded-xl">
             <p className="text-gray-500 font-bold uppercase text-[9px] tracking-widest">
                Vul na elke wedstrijd je behaalde punten in in het vakje. 3 voor winst, 1 voor gelijkspel, 0 voor verlies.
             </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NKPrintViews;
