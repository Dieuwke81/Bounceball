import React, { useState } from 'react';
import { SCRIPT_URL, PLAYERS_SHEET_NAME } from '../config';

const Spinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ConnectionDoctor: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'done'>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const testConnection = async () => {
    setStatus('testing');
    setResult(null);
    setAnalysis(null);

    try {
      const url = new URL(SCRIPT_URL);
      url.searchParams.append('action', 'getInitialData');
      url.searchParams.append('t', new Date().getTime().toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      });
      
      const rawText = await response.text();
      setResult(rawText);

      if (!response.ok) {
        if (rawText.includes('<title>Google Drive</title>') || rawText.includes('accounts.google.com')) {
          setAnalysis({ message: `Fout: Toegang geweigerd. Het script is niet correct 'gedeployed'. Ga naar je Apps Script > Implementeren > Implementaties beheren. Kies de actieve implementatie, klik op bewerken (potloodje) en zorg dat 'Wie heeft toegang' op 'Iedereen' staat. Maak daarna een NIEUWE implementatie aan.`, type: 'error' });
        } else {
          setAnalysis({ message: `Fout: Serverfout ${response.status}. De server gaf een onverwacht antwoord. Dit kan een fout zijn in het Apps Script zelf.`, type: 'error' });
        }
      } else {
        try {
          const data = JSON.parse(rawText);
          if (data.status === 'error') {
            setAnalysis({ message: `Succesvolle verbinding, maar het script meldt een fout:\n\n${data.message}`, type: 'error' });
          } else if (data.players && Array.isArray(data.players)) {
            if (data.players.length > 0) {
              setAnalysis({ message: `✅ SUCCES! De app heeft succesvol ${data.players.length} spelers en ${data.history ? data.history.length : 0} sessies uit je Google Sheet geladen. De koppeling werkt! Je kunt nu proberen de app opnieuw te laden.`, type: 'success' });
            } else {
              setAnalysis({ message: `Waarschuwing: Verbinding gelukt, maar 0 spelers gevonden. Dit betekent dat de koppeling werkt, maar er iets mis is in de Google Sheet zelf. Controleer of de tabbladnaam exact '${PLAYERS_SHEET_NAME}' is en of er daadwerkelijk spelers in staan.`, type: 'warning' });
            }
          } else {
            setAnalysis({ message: "Waarschuwing: Verbinding gelukt, maar de data is in een onverwacht formaat. Het script stuurt geen 'players' array terug. Controleer het Apps Script.", type: 'warning' });
          }
        } catch (e) {
          setAnalysis({ message: "Fout: De server gaf een antwoord, maar het is geen geldige JSON. Dit duidt meestal op een fout in het Apps Script zelf. Open het script in de editor en kijk of je foutmeldingen ziet.", type: 'error' });
        }
      }
    } catch (e: any) {
      setResult(e.message || 'Onbekende fout');
      if (e instanceof TypeError) {
         setAnalysis({ message: "Netwerkfout. Dit wordt meestal veroorzaakt door een van deze drie problemen:\n1. Je hebt geen internetverbinding.\n2. De SCRIPT_URL in `src/config.ts` is incorrect.\n3. Het script is niet correct gedeployed (CORS-fout). Volg de implementatiestappen opnieuw.", type: 'error' });
      } else {
         setAnalysis({ message: "Er is een onbekende fout opgetreden tijdens de test.", type: 'error' });
      }
    } finally {
      setStatus('done');
    }
  };
  
  const analysisClasses = {
      success: 'bg-green-900/50 border-green-700 text-green-200',
      warning: 'bg-amber-900/50 border-amber-700 text-amber-200',
      error: 'bg-red-900/50 border-red-700 text-red-200',
  }

  return (
    <div className="mt-6 border-t-2 border-fuchsia-500 pt-6">
        <button 
            onClick={testConnection}
            disabled={status === 'testing'}
            className="w-full mb-6 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg flex items-center justify-center disabled:bg-gray-500"
        >
            {status === 'testing' && <Spinner />}
            {status === 'testing' ? 'Verbinding wordt getest...' : 'Start de verbindingstest'}
        </button>

        {status === 'done' && (
            <div className="space-y-4">
                {analysis && (
                    <div>
                        <h4 className="font-bold text-white mb-2">Analyse:</h4>
                        <div className={`p-4 rounded-md text-sm whitespace-pre-wrap ${analysisClasses[analysis.type]}`}>
                            {analysis.message}
                        </div>
                    </div>
                )}
                {result && (
                    <div>
                        <h4 className="font-bold text-white mb-2">Ruwe Data van Server:</h4>
                        <pre className="bg-gray-900 p-4 rounded-md text-xs text-gray-300 max-h-60 overflow-auto whitespace-pre-wrap break-all">
                            {result}
                        </pre>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ConnectionDoctor;
