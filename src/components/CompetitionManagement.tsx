
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GameSession, Player } from '../types';
import { SPREADSHEET_ID } from '../config';
import DownloadIcon from './icons/DownloadIcon';
import UploadIcon from './icons/UploadIcon';
import EditIcon from './icons/EditIcon';
import {
  setSeasonStartDate as setSeasonStartDateService,
  bulkUpdateStartRatings as bulkUpdateStartRatingsService,
} from '../services/googleSheetService';

interface CompetitionManagementProps {
  currentHistory: GameSession[];
  players: Player[]; // ✅ nieuw
  onViewArchive: (history: GameSession[]) => void;
  onRefresh: () => void;
  currentCompetitionName: string | null;
  onSetCompetitionName: (name: string) => Promise<void>;
  seasonStartDate?: string; // ✅ nieuw
}

const CompetitionManagement: React.FC<CompetitionManagementProps> = ({
  currentHistory,
  players,
  onViewArchive,
  onRefresh,
  currentCompetitionName,
  onSetCompetitionName,
  seasonStartDate,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

  // competitienaam
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // seizoen start datum
  const [seasonDateInput, setSeasonDateInput] = useState('');
  const [isSavingSeasonDate, setIsSavingSeasonDate] = useState(false);

  // start ratings editor
  const [showStartRatings, setShowStartRatings] = useState(false);
  const [isSavingStartRatings, setIsSavingStartRatings] = useState(false);
  const [startRatingsDraft, setStartRatingsDraft] = useState<Record<number, string>>({});

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

  useEffect(() => {
    setSeasonDateInput(seasonStartDate || '');
  }, [seasonStartDate]);

  useEffect(() => {
    // init start ratings from players
    const map: Record<number, string> = {};
    players.forEach((p) => {
      const sr = p.startRating;
      map[p.id] =
        sr === undefined || sr === null || !Number.isFinite(sr) ? '' : String(sr);
    });
    setStartRatingsDraft(map);
  }, [players]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

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
      alert('Er is geen geschiedenis om te downloaden.');
      return;
    }
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(currentHistory, null, 2)
      )}`;
      const link = document.createElement('a');
      link.href = jsonString;
      const date = new Date().toISOString().split('T')[0];
      link.download = `competitie-archief-${date}.json`;
      link.click();
    } catch (error) {
      console.error('Fout bij het maken van het downloadbestand:', error);
      alert('Er is een fout opgetreden bij het voorbereiden van de download.');
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
        if (typeof content !== 'string') throw new Error('Kon bestand niet lezen.');

        const parsed = JSON.parse(content);

        if (Array.isArray(parsed) && (parsed.length === 0 || (parsed[0].date && parsed[0].teams))) {
          onViewArchive(parsed as GameSession[]);
        } else {
          throw new Error('Bestandsstructuur is niet correct.');
        }
      } catch (error) {
        console.error('Fout bij het parsen van archiefbestand:', error);
        alert(
          'Ongeldig of corrupt archiefbestand. Zorg ervoor dat het een ongewijzigd .json-bestand is dat door deze app is gedownload.'
        );
      }
    };
    reader.readAsText(file);

    if (event.target) event.target.value = '';
  };

  const handleSaveSeasonStartDate = async () => {
    if (isSavingSeasonDate) return;

    // allow empty (clears)
    const v = (seasonDateInput || '').trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      alert('Gebruik formaat YYYY-MM-DD (bv. 2025-08-01).');
      return;
    }

    setIsSavingSeasonDate(true);
    try {
      await setSeasonStartDateService(v);
      alert('Seizoen startdatum opgeslagen ✅');
      onRefresh();
    } catch (e: any) {
      alert(`Fout bij opslaan: ${e?.message || e}`);
    } finally {
      setIsSavingSeasonDate(false);
    }
  };

  const handleSaveStartRatings = async () => {
    if (isSavingStartRatings) return;

    const payload = sortedPlayers.map((p) => ({
      id: p.id,
      startRating: startRatingsDraft[p.id] ?? '',
    }));

    setIsSavingStartRatings(true);
    try {
      await bulkUpdateStartRatingsService(payload);
      alert('Start ratings opgeslagen ✅');
      onRefresh();
    } catch (e: any) {
      alert(`Fout bij opslaan: ${e?.message || e}`);
    } finally {
      setIsSavingStartRatings(false);
    }
  };

  const handleCopyCurrentRatingsToStart = () => {
    if (
      !window.confirm(
        'Weet je het zeker? Dit zet voor ALLE spelers de startRating gelijk aan de huidige rating.'
      )
    )
      return;

    const map: Record<number, string> = {};
    players.forEach((p) => (map[p.id] = String(p.rating ?? '')));
    setStartRatingsDraft(map);
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <img
          src="https://cdn-icons-png.flaticon.com/512/14887/14887963.png"
          alt="Beheer"
          className="w-8 h-8 object-contain"
        />
        <h2 className="ml-3 text-3xl font-bold text-white">Competitiebeheer</h2>
      </div>

      {/* Competitienaam */}
      <div className="bg-gray-700 rounded-lg p-6 mb-8">
        <div className="flex items-center mb-4">
          <EditIcon className="w-6 h-6 text-cyan-600" />
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
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-cyan-800 disabled:cursor-wait"
          >
            {isSavingName ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {/* ✅ Seizoensinstellingen */}
      <div className="bg-gray-700 rounded-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-2">Seizoensinstellingen</h3>
        <p className="text-gray-300 text-sm mb-4">
          Deze instellingen zorgen dat je grafieken kloppen:
          <br />
          - <span className="font-semibold">All-time</span> loopt door over alle seizoenen
          <br />
          - <span className="font-semibold">Seizoen</span> start opnieuw vanaf de ingestelde startdatum
        </p>

        <div className="bg-gray-900/40 rounded-lg p-4 border border-gray-600/40 mb-4">
          <div className="text-sm font-semibold text-gray-100 mb-2">Seizoen startdatum</div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="date"
              value={seasonDateInput}
              onChange={(e) => setSeasonDateInput(e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleSaveSeasonStartDate}
              disabled={isSavingSeasonDate}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-green-800 disabled:cursor-wait"
            >
              {isSavingSeasonDate ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button
              onClick={() => {
                if (!window.confirm('Seizoen startdatum leegmaken?')) return;
                setSeasonDateInput('');
              }}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Leegmaken
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Tip: zet dit op de eerste speeldag van het seizoen (YYYY-MM-DD).
          </p>
        </div>

        <div className="bg-gray-900/40 rounded-lg p-4 border border-gray-600/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-100">Start ratings (per speler)</div>
              <div className="text-xs text-gray-400">
                Dit bepaalt het startpunt van de seizoensgrafiek (als er nog geen logs vóór de startdatum zijn).
              </div>
            </div>
            <button
              onClick={() => setShowStartRatings((v) => !v)}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {showStartRatings ? 'Verberg' : 'Open'}
            </button>
          </div>

          {showStartRatings && (
            <div className="mt-4">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <button
                  onClick={handleCopyCurrentRatingsToStart}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Zet startRating = huidige rating
                </button>

                <button
                  onClick={handleSaveStartRatings}
                  disabled={isSavingStartRatings}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-green-800 disabled:cursor-wait"
                >
                  {isSavingStartRatings ? 'Opslaan...' : 'Start ratings opslaan'}
                </button>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-600/40">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr>
                      <th className="text-left p-2 text-gray-200">Speler</th>
                      <th className="text-left p-2 text-gray-200 w-40">Start rating</th>
                      <th className="text-left p-2 text-gray-200 w-40">Huidige rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((p) => (
                      <tr key={p.id} className="border-t border-gray-700">
                        <td className="p-2 text-gray-100">{p.name}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={startRatingsDraft[p.id] ?? ''}
                            onChange={(e) =>
                              setStartRatingsDraft((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }))
                            }
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="bv 6.5"
                          />
                        </td>
                        <td className="p-2 text-gray-300">{Number(p.rating).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Let op: je mag ook leeg laten. Dan gebruikt de app automatisch “laatste log vóór seizoenstart”, en anders je huidige rating.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Archief / upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Archiveren & Bekijken</h3>
          <p className="text-gray-400 mb-4">
            Sla de volledige geschiedenis van de huidige competitie op, of laad een eerder archief in om het te bekijken.
          </p>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              <DownloadIcon className="w-5 h-5 mr-2" />
              Download Huidig Archief
            </button>
            <button
              onClick={handleTriggerUpload}
              className="flex-1 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              <UploadIcon className="w-5 h-5 mr-2" />
              Bekijk een Archief
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json, .txt"
              className="hidden"
            />
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Nieuwe Competitie Starten</h3>
          <p className="text-gray-400 mb-4">
            Klaar voor een nieuw seizoen? Volg de instructies om de competitie te resetten met behoud van spelersratings.
          </p>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            {showInstructions ? 'Verberg Instructies' : 'Toon Instructies'}
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
          <h3 className="text-2xl font-bold text-amber-400 mb-4">Handleiding: Nieuwe Competitie Starten</h3>
          <p className="text-gray-300 mb-4">
            Om een nieuwe, schone competitie te starten met de huidige spelersratings, volg je deze stappen in je Google Sheet.
            <strong className="text-white"> Tip: download eerst het archief van de huidige competitie!</strong>
          </p>
          <ol className="list-decimal list-inside space-y-3 text-gray-300">
            <li>
              Open je Google Sheet:{' '}
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline font-semibold"
              >
                Klik hier
              </a>
              .
            </li>
            <li>Klik onderaan met de <strong className="text-white">rechtermuisknop</strong> op de 'Geschiedenis' tab.</li>
            <li>Kies '<strong className="text-white">Naam wijzigen</strong>' en geef het een duidelijke naam, bv. <code className="bg-gray-700 px-1 rounded">Competitie 2025-2</code>.</li>
            <li>Klik op '<strong className="text-white">+</strong>' (blad toevoegen) linksonder om een nieuw blad te maken.</li>
            <li>Hernoem het nieuwe blad naar exact <code className="bg-gray-700 px-1 rounded">Geschiedenis</code>.</li>
            <li>Kopieer de kolomkoppen naar het nieuwe blad: <code className="bg-gray-700 px-1 rounded">Datum</code>, <code className="bg-gray-700 px-1 rounded">Teams</code>, <code className="bg-gray-700 px-1 rounded">Ronde 1 Resultaten</code>, <code className="bg-gray-700 px-1 rounded">Ronde 2 Resultaten</code>.</li>
            <li>Kom terug naar de app en klik hieronder op herladen.</li>
          </ol>
          <div className="mt-6 text-center">
            <button
              onClick={onRefresh}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
            >
              Data Herladen & Afronden
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionManagement;
