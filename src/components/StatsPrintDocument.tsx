import React from 'react';
import { createPortal } from 'react-dom';

export interface PrintData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

const StatsPrintDocument: React.FC<{ data: PrintData | null }> = ({ data }) => {
  // Als er geen data is, renderen we niets (dus beïnvloeden we de app niet)
  if (!data) return null;

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            /* 1. ALLES VERBERGEN */
            html, body {
              visibility: hidden !important;
              background-color: white !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            
            /* Verberg alle elementen die niet onze portal zijn */
            body > *:not(.print-portal) {
              display: none !important;
            }

            /* 2. ALLEEN DIT FORMULIER TONEN */
            .print-portal {
              visibility: visible !important;
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              min-height: 100vh;
              z-index: 99999;
              background-color: white;
              color: black;
              font-family: sans-serif;
              padding: 20mm; /* Standaard A4 marge */
            }
            
            /* 3. DE OPMAAK VAN DE LIJST */
            .header-container {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }
            
            h1 {
                font-size: 24pt;
                text-transform: uppercase;
                margin: 0 0 10px 0;
            }
            
            h2 {
                font-size: 16pt;
                font-weight: normal;
                color: #444;
                margin: 0;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 12pt;
            }

            th {
                border-bottom: 2px solid #000;
                text-align: left;
                padding: 8px;
                font-weight: bold;
                background-color: #f0f0f0 !important; /* Lichtgrijs voor kop */
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
            }

            td {
                border-bottom: 1px solid #ddd;
                padding: 8px;
            }

            tr:nth-child(even) td {
                background-color: #f9f9f9 !important;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
            }

            /* Kolom uitlijning */
            .col-center { text-align: center; }
            .col-right { text-align: right; }
            .font-bold { font-weight: bold; }
          }
        `}
      </style>

      <div className="print-content">
        <div className="header-container">
            <h1>Bounceball</h1>
            <h2>{data.title}</h2>
        </div>

        <table>
            <thead>
                <tr>
                    {data.headers.map((h, i) => (
                        <th key={i} className={i === 0 ? 'col-center' : i > 1 ? 'col-right' : ''}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={
                                cellIndex === 0 ? 'col-center font-bold' : 
                                cellIndex === 1 ? 'font-bold' : 
                                'col-right'
                            }>
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
        
        <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '10pt', color: '#888' }}>
            Uitgedraaid op {new Date().toLocaleDateString('nl-NL')}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StatsPrintDocument;
