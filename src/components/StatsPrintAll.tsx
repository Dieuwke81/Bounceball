
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PrintRow {
  rank: number;
  name: string;
  value: string | number;
  sub?: string;
}

interface StatsPrintAllProps {
  title: string;
  competition: PrintRow[];
  scorers: PrintRow[];
  defense: PrintRow[];
  attendance: PrintRow[];
  onClose: () => void;
}

const LOGO =
  'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png';

const Page: React.FC<{ title: string; subtitle: string; rows: PrintRow[] }> = ({
  title,
  subtitle,
  rows,
}) => (
  <div className="print-page">
    <div className="header">
      <img src={LOGO} alt="Logo" />
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Speler</th>
          <th className="right">Waarde</th>
          <th className="right">Info</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rank}>
            <td>{r.rank}</td>
            <td>{r.name}</td>
            <td className="right">{r.value}</td>
            <td className="right">{r.sub ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatsPrintAll: React.FC<StatsPrintAllProps> = ({
  title,
  competition,
  scorers,
  defense,
  attendance,
  onClose,
}) => {
  useEffect(() => {
    window.print();
    window.onafterprint = onClose;
  }, [onClose]);

  return createPortal(
    <div className="print-root">
      <style>{`
        @media print {
          body > *:not(.print-root) { display: none !important; }
          @page { size: A4; margin: 18mm; }
        }

        .print-root {
          font-family: Arial, sans-serif;
          color: #0f172a;
        }

        .print-page {
          page-break-after: always;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
        }

        .header img {
          width: 60px;
          height: auto;
        }

        h1 {
          font-size: 26px;
          margin: 0;
        }

        p {
          margin: 2px 0 0;
          color: #475569;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th {
          text-align: left;
          padding: 8px 6px;
          border-bottom: 2px solid #000;
        }

        td {
          padding: 6px;
          border-bottom: 1px solid #e5e7eb;
        }

        tr:nth-child(even) {
          background: #f1f5f9;
        }

        .right {
          text-align: right;
        }
      `}</style>

      <Page
        title={`${title} – Competitie`}
        subtitle="Punten per wedstrijd"
        rows={competition}
      />

      <Page
        title={`${title} – Topscoorder`}
        subtitle="Doelpunten per wedstrijd"
        rows={scorers}
      />

      <Page
        title={`${title} – Beste verdediger`}
        subtitle="Tegendoelpunten per wedstrijd (lager is beter)"
        rows={defense}
      />

      <Page
        title={`${title} – Aanwezigheid`}
        subtitle="Aantal speelavonden"
        rows={attendance}
      />
    </div>,
    document.body
  );
};

export default StatsPrintAll;
