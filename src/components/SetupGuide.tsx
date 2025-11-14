import React, { useState } from 'react';
import { SPREADSHEET_ID, PLAYERS_SHEET_NAME } from '../config';
import ConnectionDoctor from './ConnectionDoctor';

interface SetupGuideProps {
  error: string;
  onRetry: () => void;
}

const SetupGuide: React.FC<SetupGuideProps> = ({ error, onRetry }) => {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
  const [showDoctor, setShowDoctor] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center text-white p-4">
      <div className="bg-gray-800 border-2 border-red-700/50 p-6 md:p-8 rounded-2xl shadow-2xl max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-red-300 mb-4">Oeps! De koppeling met Google Sheets is mislukt.</h1>
        <p className="text-gray-300 mb-6">
          Geen zorgen, we lossen dit samen op! De foutmelding hieronder en de "Connection Doctor" helpen je de oorzaak te vinden.
        </p>

        <div className="bg-gray-900/70 p-4 rounded-lg mb-8 border border-gray-700">
          <p className="text-sm font-semibold text-amber-300 mb-2">Technische Foutmelding:</p>
          <pre className="text-red-200 text-sm whitespace-pre-wrap font-mono break-words">{error}</pre>
        </div>
        
        <div className="bg-gray-700/50 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold text-fuchsia-300 mb-3">Connection Doctor</h2>
            <p className="text-gray-300 mb-4 text-sm">
                Dit is de beste manier om het probleem te vinden. De "Connection Doctor" test de directe verbinding met je Google Sheet en geeft gedetailleerde, technische feedback.
            </p>
            <button
                onClick={() => setShowDoctor(!showDoctor)}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
                {showDoctor ? 'Verberg Connection Doctor' : 'Start Connection Doctor'}
            </button>
            
            {showDoctor && <ConnectionDoctor />}
        </div>


        <h2 className="text-2xl font-bold text-white mb-4">Standaard Controlelijst</h2>
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-cyan-300 mb-2">1. Deel-instellingen (Meest voorkomende oorzaak)</h3>
            <p className="text-gray-300 text-sm">
              Je Google Sheet moet openbaar (maar niet bewerkbaar) zijn, zodat de app de spelerslijst kan lezen.
            </p>
            <ol className="list-decimal list-inside space-y-1 mt-3 text-sm text-gray-300 pl-2">
              <li>Open je spreadsheet: <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold">Klik hier</a>.</li>
              <li>Klik op de blauwe <strong className="text-white">"Delen"</strong> knop (rechtsboven).</li>
              <li>Zoek naar <strong className="text-white">"Algemene toegang"</strong>.</li>
              <li>Stel deze in op <strong className="text-white">"Iedereen met de link"</strong>.</li>
              <li>Zorg dat de rol ernaast is ingesteld op <strong className="text-white">"Viewer"</strong> (lezer).</li>
            </ol>
          </div>

          {/* Step 2 */}
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-cyan-300 mb-2">2. Tabbladnaam & Kolommen</h3>
            <p className="text-gray-300 text-sm">
              De app zoekt naar een specifieke naam en structuur. Controleer dit nauwkeurig.
            </p>
             <ul className="list-disc list-inside space-y-1 mt-3 text-sm text-gray-300 pl-2">
                <li>De naam van het tabblad moet exact <code className="bg-gray-900 px-2 py-1 rounded text-amber-300">{PLAYERS_SHEET_NAME}</code> zijn (hoofdlettergevoelig, geen extra spaties).</li>
                <li>De <strong className="text-white">allereerste rij</strong> (rij 1) moet deze kolomkoppen bevatten, in deze volgorde:</li>
                <li className="flex items-center space-x-2 flex-wrap pl-4 pt-1">
                    <code className="bg-gray-900 px-2 py-1 rounded text-white">Id</code>
                    <code className="bg-gray-900 px-2 py-1 rounded text-white">Naam</code>
                    <code className="bg-gray-900 px-2 py-1 rounded text-white">Rating</code>
                    <code className="bg-gray-900 px-2 py-1 rounded text-white">IsKeeper</code>
                    <code className="bg-gray-900 px-2 py-1 rounded text-white">IsVastLid</code>
                </li>
             </ul>
          </div>

          {/* Step 3 */}
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-cyan-300 mb-2">3. Configuratie van de App</h3>
            <p className="text-gray-300 text-sm">
              Dit zijn de ID's die de app momenteel gebruikt. Controleer of ze overeenkomen met jouw gegevens in <code className="bg-gray-900 px-1 rounded">src/config.ts</code>.
            </p>
            <div className="mt-3 space-y-2 text-sm">
                <p className="text-gray-400">SPREADSHEET_ID: <code className="bg-gray-900 px-2 py-1 rounded text-white break-all">{SPREADSHEET_ID}</code></p>
                <p className="text-gray-400">PLAYERS_SHEET_NAME: <code className="bg-gray-900 px-2 py-1 rounded text-white">{PLAYERS_SHEET_NAME}</code></p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
            <button
                onClick={onRetry}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
            >
                Probeer Opnieuw te Laden
            </button>
        </div>
      </div>
    </div>
  );
};

export default SetupGuide;
