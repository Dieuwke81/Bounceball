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
            /* 1. Verberg alles van de normale app */
            html, body {
              background: white !important;
              height: 100%;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            body > *:not(.print-portal) {
              display: none !important;
            }

            /* 2. Toon en stijl het print formulier */
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
            
            /* Header */
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 20px;
            }
            h1 { 
                font-size: 28pt; 
                text-transform: uppercase; 
                margin: 0 0 10px 0; 
                letter-spacing: 2px;
            }
            h2 { 
                font-size: 18pt; 
                font-weight: normal; 
                margin: 0; 
                color: #444; 
            }
            
            /* Tabel */
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px; 
            }
            th { 
                background-color: #f3f4f6; 
                font-weight: bold; 
                padding: 12px 8px; 
                border: 1px solid #000; 
                text-align: left; 
                font-size: 12pt;
            }
            td { 
                padding: 10px 8px; 
                border: 1px solid #000; 
                font-size: 12pt; 
            }
            tr:nth-child(even) { 
                background-color: #f9fafb; 
            }
            
            /* Kolom specifieke styling */
            .col-rank { width: 60px; text-align: center; font-weight: bold; }
            .col-name { font-weight: 600; }
            .col-value { text-align: right; }
            
            /* Footer */
            .footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                text-align: center;
                font-size: 9pt;
                color: #888;
                padding-bottom: 10mm;
            }
          }
        `}
      </style>

      <div className="print-content">
        <div className="header">
            <h1>Bounceball</h1>
            <h2>{data.title}</h2>
        </div>

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
                  <td key={cIndex} className={
                      cIndex === 0 ? 'col-rank' : 
                      cIndex === 1 ? 'col-name' : 
                      cIndex > 1 ? 'col-value' : ''
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
