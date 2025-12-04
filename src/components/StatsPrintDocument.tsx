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
            body > *:not(.print-portal) {
              display: none !important;
            }
            .print-portal {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              min-height: 100vh;
              z-index: 99999;
              background: white;
              color: black;
              font-family: sans-serif;
              padding: 20mm;
            }
            
            h1 { text-align: center; font-size: 24pt; margin-bottom: 10px; text-transform: uppercase; }
            h2 { text-align: center; font-size: 16pt; color: #555; margin-top: 0; margin-bottom: 30px; }
            
            table { width: 100%; border-collapse: collapse; font-size: 12pt; }
            th { background: #f0f0f0; font-weight: bold; border-bottom: 2px solid black; text-align: left; padding: 8px; }
            td { border-bottom: 1px solid #ddd; padding: 8px; }
            tr:nth-child(even) td { background: #f9f9f9; }
            
            .col-rank { width: 50px; text-align: center; font-weight: bold; }
            .col-right { text-align: right; }
            
            .footer {
                position: fixed; bottom: 0; left: 0; right: 0;
                text-align: center; font-size: 9pt; color: #888;
            }
          }
        `}
      </style>

      <div className="print-content">
        <h1>Bounceball</h1>
        <h2>{data.title}</h2>

        <table>
          <thead>
            <tr>
              {data.headers.map((h, i) => (
                <th key={i} className={i === 0 ? 'col-rank' : i > 1 ? 'col-right' : ''}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rIndex) => (
              <tr key={rIndex}>
                {row.map((cell, cIndex) => (
                  <td key={cIndex} className={
                    cIndex === 0 ? 'col-rank' : 
                    cIndex === 1 ? 'font-bold' : 
                    'col-right'
                  }>
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
