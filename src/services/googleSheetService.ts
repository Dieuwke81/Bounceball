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
        const csvText = await response.text();

        // **CRITICAL CHECK 1**: If Google returns an HTML page, it means the sheet is not public.
        if (csvText.trim().toLowerCase().startsWith('<!doctype html') || csvText.trim().toLowerCase().includes('<html')) {
            throw new Error("Toegang tot de Google Sheet is geweigerd. Zorg ervoor dat de deelinstellingen correct zijn: ga naar 'Delen' > 'Algemene toegang' en stel deze in op 'Iedereen met de link' kan 'Viewer' zijn.");
        }
        
        const lines = csvText.replace(/\r/g, '').split('\n');
        const header = (lines[0] || '').toLowerCase();
        
        // **CRITICAL CHECK 2**: Verify if we got a valid CSV header.
        if (!header.includes('id') || !header.includes('naam') || !header.includes('rating')) {
             throw new Error(`De app kreeg een onverwachte reactie van Google Sheets en kon de spelerslijst niet lezen. Controleer het volgende:
1. Is de naam van het tabblad in uw Google Sheet exact '${PLAYERS_SHEET_NAME}' (hoofdlettergevoelig)? Pas dit eventueel aan in 'src/config.ts'.
2. Heeft de sheet de kolommen 'Id', 'Naam', en 'Rating'?
3. Staan de deelinstellingen op 'Iedereen met de link'?`);
        }

        const rows = lines.slice(1);
        
        const players = rows
            .map((row): Player | null => {
                const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                if (columns.length < 5) return null;

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

        if (players.length === 0 && rows.filter(r => r.trim()).length > 0) {
            throw new Error("Spelerslijst kon niet worden verwerkt. Controleer of de kolomvolgorde in de sheet correct is: 'Id', 'Naam', 'Rating', 'IsKeeper', 'IsVastLid'.");
        }

        return players;
    } catch (error: any) {
        console.error("Fout bij het ophalen van spelers uit CSV:", error);
        throw new Error(error.message || `Kon spelers niet laden. Controleer SPREADSHEET_ID en PLAYERS_SHEET_NAME in config.ts.`);
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