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
            <td className="font-bold">{r.name}</td>
            <td className="right font-black">{r.value}</td>
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
        /* Forceer lichte kleurstelling voor browsers */
        :root {
          color-scheme: light !important;
        }

        @media print {
          body > *:not(.print-root) { 
            display: none !important; 
          }

          html, body {
            background-color: #ffffff !important;
            /* Geen grijs: puur zwart */
            color: #000000 !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page { 
            size: A4; 
            margin: 15mm; 
          }

          /* Forceer zwart op ALLE elementen binnen de print */
          .print-root, .print-root * {
            color: #000000 !important;
            border-color: #000000 !important;
            opacity: 1 !important;
          }

          /* Voorkom dat rijen in het midden worden gesplitst over twee pagina's */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }
        }

        .print-root {
          font-family: "Helvetica Neue", Arial, sans-serif;
          background-color: #ffffff !important;
          width: 100%;
        }

        .print-page {
          page-break-after: always;
          break-after: page;
          padding-top: 10px;
          background-color: #ffffff !important;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
          border-bottom: 3px solid #000000 !important;
          padding-bottom: 15px;
        }

        .header img {
          width: 70px;
          height: 70px;
          object-fit: contain;
        }

        h1 {
          font-size: 26px;
          margin: 0;
          font-weight: 900;
          color: #000000 !important;
        }

        p {
          margin: 4px 0 0;
          font-size: 14px;
          color: #000000 !important;
          font-style: italic;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th {
          text-align: left;
          padding: 12px 8px;
          border-bottom: 2px solid #000000 !important;
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
        }

        td {
          padding: 10px 8px;
          border-bottom: 1px solid #dddddd !important;
          font-size: 14px;
          color: #000000 !important;
        }

        .font-bold { font-weight: 700; }
        .font-black { font-weight: 900; }

        tr:nth-child(even) {
          background-color: #f2f2f2 !important;
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
