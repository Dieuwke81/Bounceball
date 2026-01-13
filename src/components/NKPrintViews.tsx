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
          
          /* Kolom achtergronden (doorzichtig) */
          .bg-blauw-trans { background-color: rgba(0, 0, 255, 0.08) !important; }
          .bg-geel-trans { background-color: rgba(255, 215, 0, 0.12) !important; }
          .bg-scheids-trans { background-color: rgba(219, 39, 119, 0.08) !important; }
          .bg-reserve-trans { background-color: rgba(21, 128, 61, 0.08) !important; }

          /* 6. Match Card (OVERVIEW - NIET VERANDERD) */
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

          /* 7. Tabel Styling (PER ZAAL) */
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
                <table className="w-full text-left" style={{borderCollapse: 'collapse'}}>
                  <thead>
                    <tr className="font-black uppercase text-[7pt] bg-gray-100">
                      <th className="p-0.5 text-center w-8 border border-black">RD</th>
                      <th className="p-0.5 border border-black">ZAAL</th>
                      <th className="p-0.5 border border-black">ROL</th>
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
                            <td className="font-bold text-center py-0.5 border border-black" style={{color: 'black'}}>{r.round}</td>
                            <td className="uppercase text-[8pt] py-0.5 border border-black" style={{color: 'black'}}>{r.hall}</td>
                            <td className={`font-black uppercase text-[8pt] py-0.5 border border-black ${roleTextColor}`}>{r.role}</td>
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
