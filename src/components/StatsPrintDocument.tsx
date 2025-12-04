import React from 'react';
import { createPortal } from 'react-dom';

export interface PrintData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

const StatsPrintDocument: React.FC<{ data: PrintData | null }> = ({ data }) => {
  if (!data) return null;

  return createPortal(
    <div className="print-portal hidden">
      <style>
        {`
          @media print {
            html, body {
              background: white !important;
              color: black !important;
              height: 100%;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            /* Verberg de hele app */
            body > *:not(.print-portal) {
              display: none !important;
            }
            /* Toon alleen dit formulier */
            .print-portal {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              min-height: 100vh;
              z-index: 9999;
              background-color: white;
              color: black;
              font-family: sans-serif;
              padding: 20mm;
            }
            
            h1 { text-align: center; margin-bottom: 5px; font-size: 24pt; text-transform: uppercase; }
            h2 { text-align: center; margin-bottom: 30px; font-size: 16pt; color: #555; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f3f4f6; font-weight: bold; padding: 12px 8px; border: 1px solid #000; text-align: left; }
            td { padding: 10px 8px; border: 1px solid #000; font-size: 12pt; }
            tr:nth-child(even) { background-color: #f9fafb; }
            
            .rank-col { width: 50px; text-align: center; font-weight: bold; }
            .val-col { text-align: right; font-weight: bold; }
            
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 10pt;
                color: #888;
                border-top: 1px solid #ddd;
                padding-top: 10px;
            }
          }
        `}
      </style>

      <div className="print-content">
        <h1>Statistieken</h1>
        <h2>{data.title}</h2>

        <table>
          <thead>
            <tr>
              {data.headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rIndex) => (
              <tr key={rIndex}>
                {row.map((cell, cIndex) => (
                  <td key={cIndex} className={cIndex === 0 ? 'rank-col' : cIndex === row.length - 1 ? 'val-col' : ''}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="footer">
            Gegenereerd door Bounceball App - {new Date().toLocaleDateString('nl-NL')}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StatsPrintDocument;
