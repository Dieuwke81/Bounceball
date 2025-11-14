
import React, { useState, useRef, useEffect } from 'react';
import type { GameSession } from '../types';
import { SPREADSHEET_ID } from '../config';
import ArchiveIcon from './icons/ArchiveIcon';
import DownloadIcon from './icons/DownloadIcon';
import UploadIcon from './icons/UploadIcon';
import EditIcon from './icons/EditIcon';

interface CompetitionManagementProps {
  currentHistory: GameSession[];
  onViewArchive: (history: GameSession[]) => void;
  onRefresh: () => void;
  currentCompetitionName: string | null;
  onSetCompetitionName: (name: string) => Promise<void>;
}

const CompetitionManagement: React.FC<CompetitionManagementProps> = ({ currentHistory, onViewArchive, onRefresh, currentCompetitionName, onSetCompetitionName }) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
  
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    const getCurrentCompetition = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const season = month < 6 ? 1 : 2;
        return `Competitie ${year}/${season}`;
    };
    setNameInput(currentCompetitionName || getCurrentCompetition());
  }, [currentCompetitionName]);

  const handleSaveName = async () => {
      if (isSavingName || !nameInput.trim()) return;
      setIsSavingName(true);
      try {
        await onSetCompetitionName(nameInput.trim());
      } finally {
        setIsSavingName(false);
      }
  };

  const handleDownload = () => {
    if (currentHistory.length === 0) {
      alert("Er is geen geschiedenis om te downloaden.");
      return;
    }
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(currentHistory, null, 2)
      )}`;
      const link = document.createElement("a");
      link.href = jsonString;
      const date = new Date().toISOString().split('T')[0];
      link.download = `competitie-archief-${date}.json`;
      link.click();
    } catch (error) {
      console.error("Fout bij het maken van het downloadbestand:", error);
      alert("Er is een fout opgetreden bij het voorbereiden van de download.");
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error("Kon bestand niet lezen.");
        
        const parsed = JSON.parse(content);
        
        if (Array.isArray(parsed) && (parsed.length === 0 || (parsed[0].date && parsed[0].teams))) {
            onViewArchive(parsed as GameSession[]);
        } else {
            throw new Error("Bestandsstructuur is niet correct.");
        }
      } catch (error) {
        console.error("Fout bij het parsen van archiefbestand:", error);
        alert("Ongeldig of corrupt archiefbestand. Zorg ervoor dat het een ongewijzigd .json-bestand is dat door deze app is gedownload.");
      }
    };
    reader.readAsText(file);
    
    if (event.target) {
        event.target.value = '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <ArchiveIcon className="w-8 h-8 text-cyan-400" />
        <h2 className="ml-3 text-3xl font-bold text-white">Competitiebeheer</h2>
      </div>

      <div className="bg-gray-700 rounded-lg p-6 mb-8">
            <div className="flex items-center mb-4">
                <EditIcon className="w-6 h-6 text-amber-400" />
                <h3 className="ml-3 text-xl font-bold text-white">Competitienaam Aanpassen</h3>
            </div>
            <p className="text-gray-400 mb-4">
                Pas de naam aan die bovenaan de app wordt weergegeven. Dit wordt centraal opgeslagen in de Google Sheet.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="bv. Competitie 2026/1"
                    aria-label="Competitienaam"
                />
                <button 
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-cyan-800 disabled:cursor-wait flex items-center justify-center"
                >
                    {isSavingName ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Opslaan...</span>
                        </>
                    ) : 'Opslaan'}
                </button>
            </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Archiveren & Bekijken</h3>
          <p className="text-gray-400 mb-4">Sla de volledige geschiedenis van de huidige competitie op, of laad een eerder archief in om het te bekijken.</p>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              <DownloadIcon className="w-5 h-5 mr-2" />
              Download Huidig Archief
            </button>
            <button onClick={handleTriggerUpload} className="flex-1 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              <UploadIcon className="w-5 h-5 mr-2" />
              Bekijk een Archief
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Nieuwe Competitie Starten</h3>
          <p className="text-gray-400 mb-4">Klaar voor een nieuw seizoen? Volg de instructies om de competitie te resetten met behoud van spelersratings.</p>
          <button onClick={() => setShowInstructions(!showInstructions)} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            {showInstructions ? 'Verberg Instructies' : 'Toon Instructies'}
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
          <h3 className="text-2xl font-bold text-amber-400 mb-4">Handleiding: Nieuwe Competitie Starten</h3>
          <p className="text-gray-300 mb-4">Om een nieuwe, schone competitie te starten met de huidige spelersratings, volg je deze stappen in je Google Sheet. <strong className="text-white">Tip: download eerst het archief van de huidige competitie!</strong></p>
          <ol className="list-decimal list-inside space-y-3 text-gray-300">
            <li>Open je Google Sheet: <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold">Klik hier</a>.</li>
            <li>Klik onderaan met de <strong className="text-white">rechtermuisknop</strong> op de 'Geschiedenis' tab.</li>
            <li>Kies de optie '<strong className="text-white">Naam wijzigen</strong>' en geef het een duidelijke naam, bijvoorbeeld <code className="bg-gray-700 px-1 rounded">Competitie 2025-2</code>.</li>
            <li>Klik op de '<strong className="text-white">+</strong>' knop (Een blad toevoegen) linksonderaan om een nieuw, leeg blad te maken.</li>
            <li>Hernoem dit nieuwe blad naar exact <code className="bg-gray-700 px-1 rounded">Geschiedenis</code> (hoofdlettergevoelig).</li>
            <li>Kopieer de kolomkoppen van je oude, gearchiveerde blad naar het nieuwe 'Geschiedenis' blad. De koppen moeten zijn: <code className="bg-gray-700 px-1 rounded">Datum</code>, <code className="bg-gray-700 px-1 rounded">Teams</code>, <code className="bg-gray-700 px-1 rounded">Ronde 1 Resultaten</code>, <code className="bg-gray-700 px-1 rounded">Ronde 2 Resultaten</code>.</li>
            <li>Kom terug naar deze app en klik op de knop hieronder om de data te herladen. Je bent nu klaar voor het nieuwe seizoen!</li>
          </ol>
          <div className="mt-6 text-center">
            <button onClick={onRefresh} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg">
                Data Herladen & Afronden
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionManagement;
