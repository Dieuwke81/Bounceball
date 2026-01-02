import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PlayerRow {
  rank: number;
  name: string;
  value: string | number;
  sub?: string;
}

interface StatsPrintAllProps {
  competition: PlayerRow[];
  scorers: PlayerRow[];
  defense: PlayerRow[];
  attendance: PlayerRow[];
  onClose: () => void;
}

const Page: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="print-page">
    <h1>{title}</h1>
    {subtitle && <p className="subtitle">{subtitle}</p>}
    {children}
  </div>
);

const Table: React.FC<{ rows: PlayerRow[] }> = ({ rows }) => (
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
);

const StatsPrintAll: React.FC<StatsPrintAllProps> = ({
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
          @page { size: A4; margin: 20mm; }
        }

        .print-root {
          font-family: Arial, sans-serif;
          color: #111;
        }

        .print-page {
          page-break-after: always;
        }

        h1 {
          font-size: 28px;
          margin-bottom: 4px;
          color: #0f172a;
        }

        .subtitle {
          margin-bottom: 16px;
          color: #475569;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          border-bottom: 2px solid #000;
          padding: 8px 6px;
        }

        td {
          padding: 6px;
          border-bottom: 1px solid #ddd;
        }

        .right {
          text-align: right;
        }

        tr:nth-child(even) {
          background: #f1f5f9;
        }
      `}</style>

      <Page title="Competitie" subtitle="Punten per wedstrijd">
        <Table rows={competition} />
      </Page>

      <Page title="Topscoorder" subtitle="Doelpunten per wedstrijd">
        <Table rows={scorers} />
      </Page>

      <Page title="Beste verdediger" subtitle="Tegendoelpunten per wedstrijd (lager = beter)">
        <Table rows={defense} />
      </Page>

      <Page title="Aanwezigheid" subtitle="Aantal speelavonden">
        <Table rows={attendance} />
      </Page>
    </div>,
    document.body
  );
};

export default StatsPrintAll;
