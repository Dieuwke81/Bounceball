import React, { useState, useEffect } from 'react';
import { SPREADSHEET_ID } from '../config';
import ConnectionDoctor from './ConnectionDoctor';
import { getScriptUrl, saveScriptUrl, clearScriptUrl } from '../services/configService';

interface SetupGuideProps {
  error: string;
  onRetry: () => void;
}

const SetupGuide: React.FC<SetupGuideProps> = ({ error, onRetry }) => {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
  const [scriptUrlInput, setScriptUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setScriptUrlInput(getScriptUrl());
  }, []);

  const handleTestAndSave = async () => {
    setIsTesting(true);
    saveScriptUrl(scriptUrlInput);
    // Wacht een fractie van een seconde om de save te laten propageren,
    // en roep dan de retry-functie aan die de data opnieuw ophaalt.
    await new Promise(resolve => setTimeout(resolve, 100));
    onRetry();
    // Blijf in 'testing' state totdat de ouder-component opnieuw rendert
    // of de fout-state update. De gebruiker ziet de spinner totdat
    // de pagina herlaadt of de foutmelding verandert.
  };
  
  const handleReset = () => {
      if (window.confirm("Weet je zeker dat je de opgeslagen URL wilt wissen? De app zal terugvallen op de standaardwaarde.")) {
          clearScriptUrl();
          window.location.reload();
      }
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-4 bg-gray-900">
      <div className="bg-gray-800 border-2 border-red-700/50 p-6 md:p-8 rounded-2xl shadow-2xl max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-red-300 mb-4">Configuratie Vereist</h1>
        <p className="text-gray-300 mb-6">
          De app kan geen verbinding maken met je Google Sheet. Dit is vaak een eenmalige instelling. Voer hieronder de juiste 'Web App URL' in en test de verbinding.
        </p>

        {/* --- INTERACTIVE CONFIGURATION --- */}
        <div className="bg-gray-700/50 p-6 rounded-lg mb-8">
            <label htmlFor="script-url-input" className="block text-xl font-bold text-fuchsia-300 mb-3">
                Jouw Web App URL
            </label>
            <p className="text-gray-300 mb-4 text-sm">
                Deze URL krijg je na het 'deployen' van het Google Apps Script. Hij eindigt altijd op <code className="bg-gray-900 px-1 rounded">/exec</code>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    id="script-url-input"
                    type="url"
                    value={scriptUrlInput}
                    onChange={(e) => setScriptUrlInput(e.target.value)}
                    className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Plak hier de URL..."
                />
                <button
                    onClick={handleTestAndSave}
                    disabled={isTesting || !scriptUrlInput}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-500 disabled:cursor-wait"
                >
                    {isTesting ? (
                         <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Testen...</span>
                        </>
                    ) : 'Test & Bewaar Verbinding'}
                </button>
            </div>
             <button onClick={handleReset} className="text-xs text-gray-500 hover:text-red-400 mt-3 transition-colors">
                Reset configuratie naar standaard
            </button>
        </div>
        
        <div className="bg-gray-900/70 p-4 rounded-lg mb-8 border border-gray-700">
          <p className="text-sm font-semibold text-amber-300 mb-2">Actieve Foutmelding:</p>
          <pre className="text-red-200 text-sm whitespace-pre-wrap font-mono break-words">{error}</pre>
        </div>

        {/* --- TROUBLESHOOTING GUIDE --- */}
        <details className="bg-gray-700/30 rounded-lg">
            <summary className="font-bold text-lg text-white p-4 cursor-pointer hover:bg-gray-700/50 rounded-lg">
                Problemen? Open de Gids voor Probleemoplossing
            </summary>
            <div className="p-4 border-t border-gray-600 space-y-4">
                <div>
                    <h3 className="font-bold text-md text-cyan-300 mb-2">1. Deel-instellingen (Meest voorkomende oorzaak)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300 pl-2">
                    <li>Open je spreadsheet: <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold">Klik hier</a>.</li>
                    <li>Klik op de blauwe <strong className="text-white">"Delen"</strong> knop (rechtsboven).</li>
                    <li>Onder <strong className="text-white">"Algemene toegang"</strong>, stel in op <strong className="text-white">"Iedereen met de link"</strong> met de rol <strong className="text-white">"Viewer"</strong>.</li>
                    </ol>
                </div>
                <div>
                    <h3 className="font-bold text-md text-cyan-300 mb-2">2. Google Apps Script Deployment</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300 pl-2">
                    <li>Open het Apps Script via je spreadsheet (Extensies > Apps Script).</li>
                    <li>Klik op de blauwe <strong className="text-white">"Implementeren"</strong> knop en kies <strong className="text-white">"Nieuwe implementatie"</strong>.</li>
                    <li>Zorg dat bij <strong className="text-white">"Wie heeft toegang"</strong> de optie <strong className="text-white">"Iedereen"</strong> is geselecteerd.</li>
                    <li>Klik op "Implementeren". Je krijgt nu de <strong className="text-white">Web App URL</strong> om hierboven in te vullen.</li>
                    </ol>
                </div>
            </div>
        </details>
      </div>
    </div>
  );
};

export default SetupGuide;
