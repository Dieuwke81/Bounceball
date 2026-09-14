import React from 'react';
import { NKSession } from '../types';

interface NKPrintViewsProps {
  session: NKSession;
  activePrintType: 'overview' | 'halls' | 'players' | 'standings' | null;
  hallNames: string[];
  playerSchedules: any[];
  currentStandings: any[];
}

const NKPrintViews: React.FC<NKPrintViewsProps> = ({
  session,
  activePrintType,
  hallNames,
  playerSchedules,
  currentStandings
}) => {
  if (!activePrintType) return null;

  return (
    <div className="print-only">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 7mm;
        }

        @media print {

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .print-only,
          .print-only * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }

          /* ==========================================
             ALGEMENE PRINTSTIJLEN
             ========================================== */

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

          .color-blauw {
            color: #0000ff !important;
          }

          .color-geel {
            color: #ffd700 !important;
          }

          .color-scheids {
            color: #db2777 !important;
          }

          .color-reserve {
            color: #15803d !important;
          }

          .bg-blauw-trans {
            background-color: rgba(0, 0, 255, 0.08) !important;
          }

          .bg-geel-trans {
            background-color: rgba(255, 215, 0, 0.12) !important;
          }

          .bg-scheids-trans {
            background-color: rgba(219, 39, 119, 0.08) !important;
          }

          .bg-reserve-trans {
            background-color: rgba(21, 128, 61, 0.08) !important;
          }

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

          .strike-name {
            text-decoration: line-through !important;
            opacity: 0.4 !important;
            color: #666 !important;
          }

          .score-box {
            border: 2px solid black;
            width: 38pt;
            height: 38pt;
            background: white !important;
          }

          .label-small {
            font-size: 9pt !important;
            font-weight: 900;
          }

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

          .time-label {
            font-size: 14pt !important;
            font-weight: 900 !important;
            color: #444 !important;
            margin-left: 10px;
          }

          /* ==========================================
             PUNTENUITLEG
             ========================================== */

          .points-explanation {
            width: 100% !important;
            margin-top: 4mm !important;
            font-size: 8pt !important;
            line-height: 1 !important;
            font-weight: bold !important;
            color: black !important;
            text-align: center !important;
            white-space: nowrap !important;
          }

          .points-explanation div {
            display: inline !important;
            margin: 0 18px !important;
          }

          /* ==========================================
             COMPLEET OVERZICHT
             ========================================== */

          .overview-round {
            page-break-after: always !important;
            break-after: page !important;
            padding: 8px !important;
            box-sizing: border-box !important;
            width: 100% !important;
          }

          .overview-round:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .overview-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .overview-match-card {
            border: 2px solid #000 !important;
            padding: 7px 10px !important;
            margin: 0 !important;
            background: white !important;
            border-radius: 8px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            min-height: 0 !important;
            box-sizing: border-box !important;
          }

          .overview-match-card .hall-label {
            font-size: 14pt !important;
          }

          .overview-match-card .player-name {
            font-size: 10pt !important;
            line-height: 1.15 !important;
          }

          .overview-match-card .label-small {
            font-size: 7pt !important;
          }

          .overview-match-card .score-box {
            width: 28pt !important;
            height: 28pt !important;
          }

          .overview-match-card .score-area {
            gap: 5px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .overview-match-card .reserve-row {
            margin-top: 5px !important;
            padding-top: 4px !important;
          }

          .overview-match-card .reserve-row .player-name {
            font-size: 8pt !important;
          }

          /* ==========================================
             PERSOONLIJK SCHEMA
             DIT IS DE BELANGRIJKE AANPASSING
             ========================================== */

          .player-print-page {
            width: 100% !important;
            height: 281mm !important;
            min-height: 281mm !important;
            max-height: 281mm !important;

            box-sizing: border-box !important;

            display: flex !important;
            flex-direction: column !important;

            padding: 0 !important;
            margin: 0 !important;

            page-break-after: always !important;
            break-after: page !important;
          }

          .player-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .player-print-page .print-header {
            flex: 0 0 auto !important;

            margin-top: 2mm !important;
            margin-bottom: 4mm !important;
            padding-bottom: 2mm !important;

            border-bottom: 3px solid black !important;
          }

          .player-print-page .print-header h1 {
            font-size: 18pt !important;
            line-height: 1 !important;
          }

          .player-table-wrap {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            width: 100% !important;

            display: flex !important;
          }

          .player-print-table {
            width: 100% !important;
            height: 100% !important;

            table-layout: fixed !important;
            border-collapse: collapse !important;

            margin: 0 !important;
          }

          .player-print-table thead {
            height: 8mm !important;
          }

          .player-print-table thead tr {
            height: 8mm !important;
          }

          .player-print-table th {
            border: 2px solid black !important;

            padding: 1.5mm 1mm !important;

            font-size: 7.5pt !important;
            line-height: 1 !important;

            font-weight: 900 !important;

            background: #f0f0f0 !important;
            color: black !important;

            vertical-align: middle !important;
          }

          .player-print-table tbody {
            height: auto !important;
          }

          .player-print-table tbody tr {
            height: 11.5mm !important;
          }

          .player-print-table td {
            border: 2px solid black !important;

            padding: 1mm 1.5mm !important;

            font-size: 9pt !important;
            line-height: 1 !important;

            font-weight: 900 !important;

            vertical-align: middle !important;

            color: black !important;
          }

          /* RD */
          .player-print-table td:nth-child(1),
          .player-print-table th:nth-child(1) {
            width: 9% !important;
            text-align: center !important;
          }

          /* TIJD */
          .player-print-table td:nth-child(2),
          .player-print-table th:nth-child(2) {
            width: 15% !important;
            text-align: center !important;
          }

          /* ZAAL */
          .player-print-table td:nth-child(3),
          .player-print-table th:nth-child(3) {
            width: 12% !important;
            text-align: center !important;
          }

          /* ROL */
          .player-print-table td:nth-child(4),
          .player-print-table th:nth-child(4) {
            width: 48% !important;
            text-align: left !important;
          }

          /* PUNTEN */
          .player-print-table td:nth-child(5),
          .player-print-table th:nth-child(5) {
            width: 16% !important;
            text-align: center !important;
          }

          .player-print-table td:nth-child(1) {
            font-size: 9pt !important;
          }

          .player-print-table td:nth-child(2) {
            font-size: 8.5pt !important;
          }

          .player-print-table td:nth-child(3) {
            font-size: 11pt !important;
            font-weight: 900 !important;
          }

          .player-print-table td:nth-child(4) {
            font-size: 9.5pt !important;
            font-weight: 900 !important;
          }

          .player-print-table td:nth-child(5) {
            font-size: 8pt !important;
          }

          /* Puntenvakjes */
          .player-print-table .player-score-box {
            width: 8mm !important;
            height: 8mm !important;

            border: 2px solid black !important;

            margin: 0 auto !important;

            background: white !important;

            box-sizing: border-box !important;
          }

          /* Totaalregel */
          .player-print-table tfoot {
            height: 16mm !important;
          }

          .player-print-table tfoot tr {
            height: 16mm !important;
          }

          .player-print-table tfoot td {
            border: 2px solid black !important;
            padding: 1mm !important;
            font-size: 10pt !important;
          }

          .player-print-table .total-label {
            text-align: right !important;
            padding-right: 5mm !important;

            font-size: 10pt !important;
            font-weight: 900 !important;

            text-transform: uppercase !important;
          }

          .player-print-table .total-box {
            width: 11mm !important;
            height: 11mm !important;

            border: 3px solid black !important;

            margin: 0 auto !important;

            background: white !important;

            box-sizing: border-box !important;
          }

          .player-points-explanation {
            flex: 0 0 auto !important;

            height: 8mm !important;

            display: flex !important;
            align-items: center !important;
            justify-content: center !important;

            white-space: nowrap !important;

            margin: 2mm 0 0 0 !important;

            font-size: 7.5pt !important;
            line-height: 1 !important;

            font-weight: bold !important;

            color: black !important;
          }

          .player-points-explanation span {
            margin: 0 12mm !important;
          }

          /* ==========================================
             PER ZAAL
             ========================================== */

          .halls-page {
            page-break-after: always !important;
            break-after: page !important;
          }

          /* ==========================================
             STAND
             ========================================== */

          .standings-page {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* =========================================================
          OPTIE 1: COMPLEET OVERZICHT
          ========================================================= */}

      {activePrintType === 'overview' &&
        session.rounds.map((round) => (
          <div
            key={round.roundNumber}
            className="overview-round"
          >
            <div className="print-header">
              <h1>
                OVERZICHT - RONDE {round.roundNumber}
                <span className="time-label">
                  {(round as any).startTime
                    ? `(${(round as any).startTime} - ${(round as any).endTime})`
                    : ''}
                </span>
              </h1>
            </div>

            <div className="overview-grid">
              {round.matches.map((m) => {
                const isFixed = (session as any).isFixedTeams;

                return (
                  <div
                    key={m.id}
                    className="overview-match-card"
                  >
                    <div className="flex justify-between items-center mb-1 border-b-2 border-black pb-1">
                      <span className="hall-label">
                        ZAAL: {m.hallName}
                      </span>

                      {!isFixed ? (
                        <div className="flex items-center">
                          <span className="color-scheids label-small uppercase mr-1">
                            SCHEIDS:
                          </span>

                          <span className="player-name">
                            {m.referee?.name}
                          </span>
                        </div>
                      ) : (
                        <span className="label-small uppercase font-black color-blauw">
                          Vaste Teams
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="label-small underline mb-1 color-blauw uppercase tracking-widest">
                          {(m as any).team1Name || 'TEAM BLAUW'}
                        </div>

                        <div className="space-y-0.5">
                          {m.team1.map((p) => {
                            const isReserve =
                              (m as any).t1ReserveId === p.id;

                            return (
                              <div
                                key={p.id}
                                className={`player-name ${
                                  isReserve ? 'strike-name' : ''
                                }`}
                              >
                                {p.name}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center score-area px-2">
                        <div className="score-box"></div>

                        <span
                          className="font-black text-xl"
                          style={{ color: 'black' }}
                        >
                          -
                        </span>

                        <div className="score-box"></div>
                      </div>

                      <div className="flex-1 text-right">
                        <div className="label-small underline mb-1 color-geel uppercase tracking-widest">
                          {(m as any).team2Name || 'TEAM GEEL'}
                        </div>

                        <div className="space-y-0.5">
                          {m.team2.map((p) => {
                            const isReserve =
                              (m as any).t2ReserveId === p.id;

                            return (
                              <div
                                key={p.id}
                                className={`player-name ${
                                  isReserve ? 'strike-name' : ''
                                }`}
                              >
                                {p.name}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {!isFixed && (
                      <div className="reserve-row mt-2 pt-1 border-t-2 border-dashed border-black flex justify-around">
                        <div className="flex items-center">
                          <span className="color-reserve label-small uppercase font-black">
                            RES 1:
                          </span>

                          <span
                            className="player-name ml-1"
                            style={{ fontSize: '8pt' }}
                          >
                            {m.subHigh?.name}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="color-reserve label-small uppercase font-black">
                            RES 2:
                          </span>

                          <span
                            className="player-name ml-1"
                            style={{ fontSize: '8pt' }}
                          >
                            {m.subLow?.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      {/* =========================================================
          OPTIE 2: PER ZAAL
          ========================================================= */}

      {activePrintType === 'halls' &&
        session.hallNames.map((hall) => (
          <div
            key={hall}
            className="page-break p-8 halls-page"
          >
            <div className="print-header">
              <h1>WEDSTRIJDSCHEMA - ZAAL {hall}</h1>
            </div>

            <table className="print-table">
              <thead>
                <tr className="uppercase text-[9px]">
                  <th className="w-8">RD</th>
                  <th className="w-20">TIJD</th>
                  <th className="color-blauw text-left">
                    TEAM BLAUW
                  </th>
                  <th className="text-center w-28">
                    SCORE
                  </th>
                  <th className="color-geel text-left">
                    TEAM GEEL
                  </th>
                  <th className="color-scheids text-left">
                    SCHEIDS
                  </th>
                  <th className="color-reserve text-left">
                    RESERVES
                  </th>
                </tr>
              </thead>

              <tbody>
                {session.rounds.map((r) => {
                  const m = r.matches.find(
                    (match) =>
                      match.hallName.trim().toUpperCase() ===
                      hall.trim().toUpperCase()
                  );

                  if (!m) return null;

                  const isFixed =
                    (session as any).isFixedTeams;

                  return (
                    <tr
                      key={r.roundNumber}
                      className="font-bold uppercase"
                    >
                      <td className="text-center text-xl bg-gray-50">
                        {r.roundNumber}
                      </td>

                      <td className="text-center text-xs">
                        {(r as any).startTime}
                        <br />
                        {(r as any).endTime}
                      </td>

                      <td className="text-[9pt] bg-blauw-trans">
                        <div className="label-small mb-1 opacity-50">
                          {(m as any).team1Name}
                        </div>

                        {m.team1.map((p) => (
                          <div
                            key={p.id}
                            className={
                              (m as any).t1ReserveId === p.id
                                ? 'strike-name'
                                : ''
                            }
                          >
                            {p.name}
                          </div>
                        ))}
                      </td>

                      <td className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          <div className="small-score-box"></div>

                          <span style={{ color: 'black' }}>
                            -
                          </span>

                          <div className="small-score-box"></div>
                        </div>
                      </td>

                      <td className="text-[9pt] bg-geel-trans">
                        <div className="label-small mb-1 opacity-50">
                          {(m as any).team2Name}
                        </div>

                        {m.team2.map((p) => (
                          <div
                            key={p.id}
                            className={
                              (m as any).t2ReserveId === p.id
                                ? 'strike-name'
                                : ''
                            }
                          >
                            {p.name}
                          </div>
                        ))}
                      </td>

                      <td className="text-[9pt] bg-scheids-trans">
                        {!isFixed ? m.referee?.name : '-'}
                      </td>

                      <td className="text-[8pt] bg-reserve-trans">
                        {!isFixed ? (
                          <>
                            <div>
                              1: {m.subHigh?.name}
                            </div>
                            <div>
                              2: {m.subLow?.name}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* =========================================================
          OPTIE 3: INDIVIDUELE SPELERS
          ========================================================= */}

      {activePrintType === 'players' &&
        playerSchedules.map((ps) => (
          <div
            key={ps.name}
            className="player-print-page"
          >
            {/* HEADER */}

            <div className="print-header">
              <h1>
                PERSOONLIJK SCHEMA: {ps.name}
              </h1>
            </div>

            {/* TABEL VULT DE BESCHIKBARE HOOGTE */}

            <div className="player-table-wrap">
              <table className="print-table player-print-table">
                <thead>
                  <tr className="uppercase">
                    <th>RD</th>
                    <th>TIJD</th>
                    <th>ZAAL</th>
                    <th className="text-left">
                      ROL
                    </th>
                    <th>PUNTEN</th>
                  </tr>
                </thead>

                <tbody>
                  {ps.rounds.map((r: any) => {
                    let roleClass = '';
                    let roleTextColor = '';

                    if (r.role === 'BLAUW') {
                      roleClass = 'bg-blauw-trans';
                      roleTextColor = 'color-blauw';
                    }

                    if (r.role === 'GEEL') {
                      roleClass = 'bg-geel-trans';
                      roleTextColor = 'color-geel';
                    }

                    if (r.role === 'REF') {
                      roleClass = 'bg-scheids-trans';
                      roleTextColor = 'color-scheids';
                    }

                    if (r.role === 'RES') {
                      roleClass = 'bg-reserve-trans';
                      roleTextColor = 'color-reserve';
                    }

                    return (
                      <tr
                        key={r.round}
                        className={roleClass}
                      >
                        <td className="text-center font-black">
                          {r.round}
                        </td>

                        <td className="text-center font-black">
                          {r.startTime}
                        </td>

                        <td className="text-center font-black uppercase">
                          {r.hall}
                        </td>

                        <td
                          className={`font-black uppercase ${roleTextColor}`}
                        >
                          {r.role}
                        </td>

                        <td className="text-center">
                          {r.hall !== '-' &&
                          (r.role === 'BLAUW' ||
                            r.role === 'GEEL') ? (
                            <div className="player-score-box"></div>
                          ) : (
                            <span className="text-gray-400 text-[7pt]">
                              N.v.t.
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td
                      colSpan={3}
                      className="border-none"
                    ></td>

                    <td className="total-label">
                      TOTAAL:
                    </td>

                    <td className="text-center">
                      <div className="total-box"></div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* PUNTENUITLEG OP ÉÉN REGEL */}

            <div className="player-points-explanation">
              <span>Winst = 3 punten</span>
              <span>Gelijk = 1 punt</span>
              <span>Verlies = 0 punten</span>
            </div>
          </div>
        ))}

      {/* =========================================================
          OPTIE 4: STAND
          ========================================================= */}

      {activePrintType === 'standings' && (
        <div className="page-break p-12 standings-page">
          <div className="print-header">
            <h1>EINDSTAND</h1>
          </div>

          <table
            className="print-table"
            style={{ marginTop: '20px' }}
          >
            <thead>
              <tr className="uppercase">
                <th className="w-16 text-center">
                  #
                </th>

                <th className="text-left">
                  {(session as any).isFixedTeams
                    ? 'TEAM NAAM'
                    : 'SPELER NAAM'}
                </th>

                <th className="w-24 text-center">
                  GESPEELD
                </th>

                <th className="w-24 text-center">
                  SALDO
                </th>

                <th className="w-24 text-center">
                  PUNTEN
                </th>
              </tr>
            </thead>

            <tbody>
              {currentStandings.map(
                (entry, idx) => (
                  <tr
                    key={idx}
                    className="font-black uppercase"
                  >
                    <td className="text-center text-2xl py-4">
                      {idx + 1}
                    </td>

                    <td className="text-xl pl-4">
                      {(entry as any).name ||
                        (entry as any).playerName}
                    </td>

                    <td className="text-center text-lg">
                      {(entry as any).matchesPlayed}
                    </td>

                    <td className="text-center text-lg">
                      {entry.goalDifference > 0
                        ? `+${entry.goalDifference}`
                        : entry.goalDifference}
                    </td>

                    <td className="text-center text-2xl bg-gray-100">
                      {entry.points}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          <div className="mt-20 text-center text-gray-400 text-xs uppercase font-bold italic">
            Gegenereerd via Bounceball Manager •{' '}
            {new Date().toLocaleDateString('nl-NL')}
          </div>
        </div>
      )}
    </div>
  );
};

export default NKPrintViews;
