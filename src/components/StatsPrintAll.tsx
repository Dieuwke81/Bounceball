
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

const LOGOS = {
  competition: 'https://i.postimg.cc/mkgT85Wm/Zonder-titel-(200-x-200-px)-20251203-070625-0000.png',
  scorers: 'https://i.postimg.cc/q76tHhng/Zonder-titel-(A4)-20251201-195441-0000.png',
  defense: 'https://i.postimg.cc/4x8qtnYx/pngtree-red-shield-protection-badge-design-artwork-png-image-16343420.png',
  attendance: 'https://cdn-icons-png.flaticon.com/512/33/33308.png' 
};

const Page: React.FC<{ title: string; subtitle: string; rows: PrintRow[]; logo: string }> = ({
  title,
  subtitle,
  rows,
  logo,
}) => (
  <div className="print-page">
    <div className="header">
      <img src={logo} alt="Logo" />
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
        {rows.map((r, index) => (
          <tr key={index}>
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
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    window.onafterprint = onClose;
    return () => clearTimeout(timer);
  }, [onClose]);

  return createPortal(
    <div className="print-root">
      <style>{`
        @media print {
          body > *:not(.print-root) { display: none !important; }
          @page { size: A4; margin: 15mm; }
        }

        .print-root {
          font-family: Arial, sans-serif;
          color: #000;
        }

        .print-page {
          page-break-after: always;
          padding-top: 10px;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }

        .header img {
          width: 70px;
          height: 70px;
          object-fit: contain;
        }

        h1 {
          font-size: 24px;
          margin: 0;
          color: #000;
        }

        p {
          margin: 4px 0 0;
          color: #000;
          font-style: italic;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th {
          text-align: left;
          padding: 10px 6px;
          border-bottom: 2px solid #000;
          font-size: 14px;
        }

        td {
          padding: 8px 6px;
          border-bottom: 1px solid #ccc;
          font-size: 13px;
        }

        tr:nth-child(even) {
          background: #f9f9f9;
        }

        .right {
          text-align: right;
        }
      `}</style>

      <Page
        title={`${title} – Competitie`}
        subtitle="Punten per wedstrijd"
        rows={competition}
        logo={LOGOS.competition}
      />

      <Page
        title={`${title} – Topscoorders`}
        subtitle="Doelpunten per wedstrijd"
        rows={scorers}
        logo={LOGOS.scorers}
      />

      <Page
        title={`${title} – Beste verdedigers`}
        subtitle="Tegendoelpunten per wedstrijd (lager is beter)"
        rows={defense}
        logo={LOGOS.defense}
      />

      <Page
        title={`${title} – Aanwezigheid`}
        subtitle="Aantal speelavonden"
        rows={attendance}
        logo={LOGOS.attendance}
      />
    </div>,
    document.body
  );
};

export default StatsPrintAll;
