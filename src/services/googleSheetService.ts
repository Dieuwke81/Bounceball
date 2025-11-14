import { SCRIPT_URL, SPREADSHEET_ID, PLAYERS_SHEET_NAME } from '../config';
import type { GameSession, NewPlayer, Player } from '../types';

// Centralized error handling and JSON parsing for Apps Script calls
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorText = await response.text();
        if (errorText && (errorText.includes('<!DOCTYPE html>') || errorText.includes('<title>Google Drive</title>'))) {
            throw new Error(`Fout ${response.status}: Authenticatieprobleem met het Apps Script. Controleer of het script correct is 'gedeployed' met toegang voor 'Iedereen'.`);
        }
        try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.message || `Serverfout ${response.status}: Geen details.`);
        } catch(e) {
            throw new Error(`Serverfout ${response.status}: ${errorText || 'Geen details.'}`);
        }
    }
    const text = await response.text();
    if (!text) return { status: 'success' };
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
};

const postToAction = async (action: string, data: object): Promise<any> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ action, data }),
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
    });
    return handleResponse(response);
  } catch (error) {
    console.error(`[postToAction Error] Action: "${action}"`, error);
    if (error instanceof TypeError) {
      throw new Error(`Netwerkfout bij actie "${action}". Mogelijke oorzaken: 1) Foute SCRIPT_URL in config.ts. 2) Google Apps Script is niet correct 'gedeployed' (toegang moet op 'Iedereen' staan). 3) Geen internetverbinding.`);
    }
    throw error;
  }
};

// Function to fetch players directly from the sheet via CSV export
const getPlayersFromCsv = async (): Promise<Player[]> => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(PLAYERS_SHEET_NAME)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Catch network-level errors first.
            throw new Error(`Kon de Google Sheet niet bereiken. Status: ${response.status}. Controleer de SPREADSHEET_ID.`);
        }
        const csvText = await response.text();

        // Check 1: Detect if Google returned an HTML login/error page.
        if (csvText.trim().toLowerCase().startsWith('<!doctype html') || csvText.trim().toLowerCase().includes('<html')) {
            throw new Error("Toegang tot de Google Sheet is geweigerd. Zorg ervoor dat de deelinstellingen correct zijn: ga naar 'Delen' > 'Algemene toegang' en stel deze in op 'Iedereen met de link' kan 'Viewer' zijn.");
        }
        
        const lines = csvText.replace(/\r/g, '').split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
            // Empty or effectively empty response
            return [];
        }

        // Check 2: Robustly verify the header row.
        const headerLine = (lines[0] || '').toLowerCase().replace(/"/g, '');
        const actualHeaders = headerLine.split(',').map(h => h.trim());
        const expectedHeaders = ['id', 'naam', 'rating', 'iskeeper', 'isvastlid'];
        
        const headersOk = expectedHeaders.every((expected, index) => actualHeaders[index] === expected);

        if (!headersOk) {
             throw new Error(`De kolomkoppen in de Google Sheet komen niet overeen met wat de app verwacht.
1. Controleer of de eerste 5 kolommen exact zijn: 'Id', 'Naam', 'Rating', 'IsKeeper', 'IsVastLid' (in die volgorde, spelling is belangrijk).
2. Controleer of de naam van het tabblad in uw Google Sheet exact '${PLAYERS_SHEET_NAME}' is (hoofdlettergevoelig).
3. Controleer nogmaals de deelinstellingen ('Iedereen met de link').
Huidige gedetecteerde koppen: "${lines[0]}"`);
        }

        const rows = lines.slice(1);
        
        const players = rows
            .map((row): Player | null => {
                // The regex handles values that might contain commas if they are quoted.
                const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                if (columns.length < 5) return null;

                // Strip quotes from all columns after matching
                const [id, name, rating, isKeeper, isFixedMember, photoBase64] = columns.map(col => col.replace(/"/g, '').trim());
                
                const playerId = parseInt(id, 10);
                const playerRating = parseFloat(rating);

                if (isNaN(playerId) || !name) return null;

                return {
                    id: playerId,
                    name: name,
                    rating: isNaN(playerRating) ? 7.0 : playerRating,
                    isKeeper: isKeeper.toLowerCase() === 'true',
                    isFixedMember: isFixedMember.toLowerCase() === 'true',
                    photoBase64: photoBase64 || undefined
                };
            })
            .filter((p): p is Player => p !== null);

        // This check is now less critical due to the robust header check, but still good to have.
        if (players.length === 0 && rows.filter(r => r.trim()).length > 0) {
            throw new Error("Spelerslijst bevat rijen, maar kon geen geldige spelers verwerken. Controleer op lege rijen of fouten in de data.");
        }

        return players;
    } catch (error: any) {
        console.error("Fout bij het ophalen van spelers uit CSV:", error);
        // Re-throw the specific error message from the try block, or a generic one.
        throw new Error(error.message || `Kon spelers niet laden. Controleer SPREADSHEET_ID en PLAYERS_SHEET_NAME in config.ts en uw internetverbinding.`);
    }
};


// Main function to fetch all initial data
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string }> => {
  try {
    const playersPromise = getPlayersFromCsv();
    
    const secondaryDataPromise = fetch(new URL(SCRIPT_URL).toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    }).then(handleResponse).catch(err => {
        console.warn("Fout bij ophalen secundaire data (geschiedenis/naam):", err.message);
        return { history: [], competitionName: '' }; // Return default values on failure
    });

    // We prioritize showing players, even if history fails.
    const [players, secondaryData] = await Promise.all([playersPromise, secondaryDataPromise]);

    return {
      players,
      history: secondaryData.history || [],
      competitionName: secondaryData.competitionName || '',
    };
  } catch (error: any) {
    // This will catch the critical error from getPlayersFromCsv and display it to the user
    console.error("Failed to fetch initial data:", error);
    throw new Error(error.message);
  }
};


// Functie om de game session en rating updates op te slaan
export const saveGameSession = (session: GameSession, updatedRatings: {id: number, rating: number}[]) => {
  return postToAction('saveSession', { session, updatedRatings });
};

// --- Player Management ---
export const addPlayer = (player: NewPlayer): Promise<{ newId: number }> => {
    return postToAction('addPlayer', { ...player, photoBase64: player.photoBase64 || "" });
};

export const updatePlayer = (player: Player) => {
    return postToAction('updatePlayer', { ...player, photoBase64: player.photoBase64 || "" });
};

export const deletePlayer = (id: number) => {
    return postToAction('deletePlayer', { id });
};

// --- Competition Management ---
export const setCompetitionName = (name: string) => {
    return postToAction('setCompetitionName', { name });
};