import React, { useState, useEffect } from 'react';
import { SPREADSHEET_ID, PLAYERS_SHEET_NAME } from '../config';
import { getScriptUrl, saveScriptUrl, clearScriptUrl } from '../services/configService';
import { runDiagnostics } from '../services/googleSheetService';

interface SetupGuideProps {
  error: string;
  onRetry: () => void;
}

interface DiagnosticResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    message: string;
    details?: string | string[];
  }[];
}

const Spinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const SetupGuide: React.FC<SetupGuideProps> = ({ error, onRetry }) => {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
  const [scriptUrlInput, setScriptUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [analysis, setAnalysis] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    setScriptUrlInput(getScriptUrl());
  }, []);

  const handleTestAndSave = async () => {
    setIsTesting(true);
    setAnalysis(null);
    saveScriptUrl(scriptUrlInput);

    try {
      if (!scriptUrlInput || !scriptUrlInput.trim().endsWith('/exec')) {
          throw new Error("Ongeldige URL. Zorg ervoor dat de URL correct is en eindigt op '/exec'.");
      }
      
      const url = new URL(scriptUrlInput);
      url.searchParams.append('action', 'getInitialData');
      url.searchParams.append('t', new Date().getTime().toString());

      const response = await fetch(url.toString(), { method: 'GET', mode: 'cors', cache: 'no-cache' });
      const rawText = await response.text();

      if (!response.ok) {
        if (rawText.includes('<title>Google Drive</title>') || rawText.includes('accounts.google.com')) {
          throw new Error("Toegang geweigerd. Het script is niet correct 'gedeployed'. Zorg dat 'Wie heeft toegang' op 'Iedereen' staat bij een NIEUWE implementatie.");
        } else {
          throw new Error(`Serverfout ${response.status}. Details: ${rawText}`);
        }
      }

      const data = JSON.parse(rawText);
      if (data.status === 'error') {
        throw new Error(`Scriptfout: ${data.message}`);
      }

      if (!Array.isArray(data.players)) {
        setAnalysis({ message: `⚠️ WAARSCHUWING: Verbinding gelukt, maar de data is onvolledig. Het script stuurt geen 'players' array terug. Controleer de code.gs en de kolomkoppen in je sheet.`, type: 'warning' });
        return;
      }

      if (data.players.length === 0) {
        setAnalysis({ message: `⚠️ WAARSCHUWING: Verbinding gelukt, maar 0 spelers gevonden. Controleer of de tabbladnaam exact '${PLAYERS_SHEET_NAME}' is en of er spelers in staan.`, type: 'warning' });
        return;
      }

      setAnalysis({ message: `✅ SUCCES! De app heeft succesvol ${data.players.length} spelers gevonden. De app wordt nu herladen...`, type: 'success' });
      setTimeout(() => onRetry(), 1500);

    } catch (e: any) {
      setAnalysis({ message: `❌ FOUT: ${e.message}`, type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const result = await runDiagnostics();
      setDiagnosticResult(result);
    } catch (e: any) {
      setDiagnosticResult({
        success: false,
        steps: [{
          name: "Verbinding",
          success: false,
          message: `Kon geen verbinding maken met het script.`,
          details: e.message
        }]
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleReset = () => {
      if (window.confirm("Weet je zeker dat je de opgeslagen URL wilt wissen? De app zal terugvallen op de standaardwaarde.")) {
          clearScriptUrl();
          window.location.reload();
      }
  }
  
  const analysisClasses = {
      success: 'bg-green-800/50 border-green-600 text-green-200',
      warning: 'bg-amber-800/50 border-amber-600 text-amber-200',
      error: 'bg-red-800/50 border-red-600 text-red-200',
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-4 bg-gray-900">
      <div className="bg-gray-800 border-2 border-red-700/50 p-6 md:p-8 rounded-2xl shadow-2xl max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-red-300 mb-4">Configuratie Vereist</h1>
        <p className="text-gray-300 mb-6">
          De app kan geen verbinding maken met je Google Sheet. Dit is vaak een eenmalige instelling. Voer hieronder de juiste 'Web App URL' in en test de verbinding.
        </p>

        {/* --- INTERACTIVE CONFIGURATION --- */}
        <div className="bg-gray-700/50 p-6 rounded-lg mb-6">
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
                    {isTesting ? <Spinner /> : null}
                    <span>{isTesting ? 'Testen...' : 'Test & Bewaar Verbinding'}</span>
                </button>
            </div>
             <button onClick={handleReset} className="text-xs text-gray-500 hover:text-red-400 mt-3 transition-colors">
                Reset configuratie naar standaard
            </button>
        </div>
        
        {analysis && (
            <div className={`p-4 rounded-md text-sm whitespace-pre-wrap mb-6 border ${analysisClasses[analysis.type]}`}>
                <strong className="font-bold block mb-2">Diagnose:</strong>
                {analysis.message}
            </div>
        )}

        <div className="bg-gray-900/70 p-4 rounded-lg mb-8 border border-gray-700">
          <p className="text-sm font-semibold text-amber-300 mb-2">Huidige Foutmelding van App:</p>
          <pre className="text-red-200 text-sm whitespace-pre-wrap font-mono break-words">{error}</pre>
        </div>

        {/* --- ADVANCED DIAGNOSTICS --- */}
        <details className="bg-gray-700/30 rounded-lg mb-6">
            <summary className="font-bold text-lg text-white p-4 cursor-pointer hover:bg-gray-700/50 rounded-lg">
                Geavanceerde Diagnose
            </summary>
            <div className="p-4 border-t border-gray-600 space-y-4">
                <p className="text-sm text-gray-400">Deze tool controleert stap-voor-stap de verbinding en de configuratie van je Google Sheet. Dit kan de exacte oorzaak van het probleem aanwijzen.</p>
                <button
                    onClick={handleRunDiagnostics}
                    disabled={isDiagnosing}
                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-500 disabled:cursor-wait"
                >
                    {isDiagnosing && <Spinner />}
                    {isDiagnosing ? 'Diagnose bezig...' : 'Voer Diagnostische Test Uit'}
                </button>
                {diagnosticResult && (
                    <div className="mt-4 space-y-2 text-sm">
                        {diagnosticResult.steps.map((step, index) => (
                            <div key={index} className={`p-3 rounded-md border ${step.success ? 'bg-green-800/30 border-green-700' : 'bg-red-800/30 border-red-700'}`}>
                                <p className={`font-bold ${step.success ? 'text-green-300' : 'text-red-300'}`}>
                                    {step.success ? '✓' : '✗'} Stap {index + 1}: {step.name}
                                </p>
                                <p className="ml-5 text-gray-300">{step.message}</p>
                                {step.details && (
                                    <pre className="ml-5 mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 whitespace-pre-wrap break-all">
                                        {Array.isArray(step.details) ? step.details.join('\n') : step.details}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </details>

        {/* --- TROUBLESHOOTING GUIDE --- */}
        <details className="bg-gray-700/30 rounded-lg" open>
            <summary className="font-bold text-lg text-white p-4 cursor-pointer hover:bg-gray-700/50 rounded-lg">
                Problemen? Open de Gids voor Probleemoplossing
            </summary>
            <div className="p-4 border-t border-gray-600 space-y-4">
                <div>
                    <h3 className="font-bold text-md text-amber-300 mb-2">1. Foutmelding "0 spelers gevonden"? (Meest waarschijnlijk)</h3>
                    <p className="text-sm text-gray-400 mb-2">Als de verbinding slaagt maar geen spelers vindt, controleer dan het volgende in je Google Sheet:</p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-2">
                        <li>Het tabblad met de spelerslijst heet <strong className="text-white">exact</strong> <code className="bg-gray-900 px-1 rounded">{PLAYERS_SHEET_NAME}</code>. (Hoofdlettergevoelig!)</li>
                        <li>De <strong className="text-white">allereerste rij</strong> (rij 1) van dit tabblad bevat <strong className="text-white">exact</strong> deze kolomkoppen. De volgorde is belangrijk.
                            <code className="block bg-gray-900 p-2 rounded mt-1 text-xs whitespace-pre-wrap">ID   |   Naam   |   Rating   |   Keeper   |   Lid   |   Foto (Base64)</code>
                        </li>
                        <li>De kolom <strong className="text-white">'Naam'</strong> is voor elke speler ingevuld. Rijen zonder naam worden genegeerd.</li>
                        <li>De kolom <strong className="text-white">'ID'</strong> moet leeg zijn voor nieuwe spelers. Deze wordt automatisch door de app beheerd.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="font-bold text-md text-cyan-300 mb-2">2. Andere verbindingsfouten (bv. Toegang Geweigerd, Serverfout)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300 pl-2">
                        <li>Open het Apps Script via je spreadsheet (Extensies &gt; Apps Script).</li>
                        <li>Klik op de blauwe <strong className="text-white">"Implementeren"</strong> knop en kies <strong className="text-white">"Nieuwe implementatie"</strong>.</li>
                        <li>Zorg dat bij <strong className="text-white">"Wie heeft toegang"</strong> de optie <strong className="text-white">"Iedereen"</strong> is geselecteerd (niet 'Iedereen binnen [uw organisatie]').</li>
                        <li>Klik op "Implementeren". Je krijgt nu de <strong className="text-white">Web App URL</strong> om hierboven in te vullen. <strong className="text-amber-300">Let op:</strong> na elke wijziging in het script moet je een NIEUWE implementatie maken.</li>
                    </ol>
                </div>
                <div>
                    <h3 className="font-bold text-md text-cyan-300 mb-2">3. Deel-instellingen van de Sheet</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300 pl-2">
                        <li>Open je spreadsheet: <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold">Klik hier</a>.</li>
                        <li>Klik op de blauwe <strong className="text-white">"Delen"</strong> knop (rechtsboven).</li>
                        <li>Onder <strong className="text-white">"Algemene toegang"</strong>, stel in op <strong className="text-white">"Iedereen met de link"</strong>. De rol maakt niet uit.</li>
                    </ol>
                </div>
            </div>
        </details>
      </div>
    </div>
  );
};

export default SetupGuide;