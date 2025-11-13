import { SCRIPT_URL, SPREADSHEET_ID } from '../config';
import type { GameSession, NewPlayer, Player } from '../types';

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

    if (response.ok) {
      const text = await response.text();
      if (!text) {
        return { status: 'success' };
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    } else {
      const errorText = await response.text();
      if (errorText && (errorText.includes('<!DOCTYPE html>') || errorText.includes('<title>Google Drive</title>'))) {
        throw new Error(`Fout ${response.status}: Authenticatieprobleem met het Apps Script. Controleer of het script correct is 'gedeployed' met toegang voor 'Iedereen'.`);
      }
      throw new Error(`Serverfout ${response.status}: ${errorText || 'Geen details.'}`);
    }
  } catch (error) {
    console.error(`[postToAction Error] Action: "${action}"`, error);
    if (error instanceof TypeError) {
      throw new Error(`Netwerkfout bij actie "${action}". Mogelijke oorzaken: 1) Foute SCRIPT_URL in config.ts. 2) Google Apps Script is niet correct 'gedeployed' (toegang moet op 'Iedereen' staan). 3) Geen internetverbinding.`);
    }
    // Re-throw custom or already processed errors
    throw error;
  }
};

/**
 * A robust CSV line parser that handles quoted fields containing commas
 * and escaped quotes (""). This is necessary because Google Sheets CSV exports
 * can be tricky for simple regex parsers.
 * @param line The CSV line to parse.
 * @returns An array of strings representing the fields.
 */
const parseCsvLine = (line: string): string[] => {
    if (!line) return [];
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    currentField += '"';
                    i++; // Skip the second quote
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === ',') {
                fields.push(currentField);
                currentField = "";
            } else if (char === '"' && currentField.length === 0) {
                inQuotes = true;
            } else {
                currentField += char;
            }
        }
    }
    fields.push(currentField);
    return fields;
};


// Functie om de spelerslijst uit de Google Sheet te halen
export const getPlayers = async (): Promise<Player[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Spelers&t=${new Date().getTime()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const csvText = await response.text();
    
    // Parse the CSV text
    const rows = csvText.split('\n').slice(1); // Skip header row
    const players: Player[] = rows.map(row => {
      if (!row.trim()) return null;
      const cleanCols = parseCsvLine(row);

      const [id, name, ratingStr, isKeeper, isFixedMember, photoBase64] = cleanCols;
      
      // Basic validation
      if (!id || !name || !ratingStr) return null;

      // Replace comma with period for decimal parsing, to support European locales
      const ratingValue = parseFloat(ratingStr.replace(',', '.'));
      if (isNaN(ratingValue)) return null;

      return {
        id: parseInt(id, 10),
        name,
        rating: ratingValue,
        isKeeper: isKeeper ? isKeeper.toUpperCase() === 'TRUE' : false,
        isFixedMember: isFixedMember ? isFixedMember.toUpperCase() === 'TRUE' : false,
        photoBase64: photoBase64 || undefined,
      };
    // FIX: Add 'p: any' to bypass a TypeScript type inference issue with the type predicate.
    }).filter((p: any): p is Player => p !== null);

    return players;
  } catch (error) {
    console.error("Failed to fetch or parse player data from Google Sheet:", error);
    throw new Error('Kon spelers niet laden uit de spreadsheet. Controleer de SPREADSHEET_ID en de deelinstellingen (Anyone with the link -> Viewer).');
  }
};

// Functie om de game session en rating updates op te slaan
export const saveGameSession = (session: GameSession, updatedRatings: {id: number, rating: number}[]) => {
  // Combine session and ratings into a single data object for the script
  return postToAction('saveSession', { session, updatedRatings });
};

/**
 * Parses a JSON string that has been properly unescaped from a CSV field.
 * @param jsonStr The JSON string to parse.
 */
const parseCsvJson = (jsonStr: string): any => {
    if (!jsonStr || jsonStr.trim() === '') {
        return null;
    }
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // The previous fallback parsers are now obsolete due to the robust CSV parser.
        // If this fails, the data is likely malformed in the sheet itself.
        console.error("Failed to parse JSON string from CSV. The data might be corrupt.", {
            jsonStringSnippet: jsonStr.substring(0, 100) + (jsonStr.length > 100 ? '...' : ''),
            error: e
        });
        throw e; // Re-throw to be caught by the outer try-catch in getHistory.
    }
}


// Functie om de volledige wedstrijdgeschiedenis uit de sheet te halen
export const getHistory = async (): Promise<GameSession[]> => {
  // Add cache-busting param to URL
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Geschiedenis&t=${new Date().getTime()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const csvText = await response.text();
    
    const rows = csvText.split('\n').slice(1).filter(row => row.trim() !== ''); // Skip header, remove empty lines
    const history: GameSession[] = rows.map(row => {
      const cleanCols = parseCsvLine(row);

      const [date, teamsStr, round1ResultsStr, round2ResultsStr] = cleanCols;

      if (!date || !teamsStr || !round1ResultsStr) return null; // round2Results can be empty
      
      try {
        const teams = parseCsvJson(teamsStr);
        const round1Results = parseCsvJson(round1ResultsStr);
        const round2Results = parseCsvJson(round2ResultsStr || '[]'); // Default to empty array if missing
        
        if (!teams || !round1Results) return null;

        return { date, teams, round1Results, round2Results };
      } catch (e) {
        console.error("Fatal error parsing history row. The row may contain malformed JSON.", { row, error: e });
        return null;
      }
    }).filter((s): s is GameSession => s !== null);

    return history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Failed to fetch or parse history data from Google Sheet:", error);
    throw new Error('Kon de geschiedenis niet laden uit de spreadsheet. Controleer de SPREADSHEET_ID en de deelinstellingen.');
  }
};

// --- Player Management ---

export const addPlayer = (player: NewPlayer): Promise<{ newId: number }> => {
    // Ensure photoBase64 is a string for consistent handling in Apps Script
    return postToAction('addPlayer', { ...player, photoBase64: player.photoBase64 || "" });
};

export const updatePlayer = (player: Player) => {
    // Ensure photoBase64 is a string for consistent handling in Apps Script
    return postToAction('updatePlayer', { ...player, photoBase64: player.photoBase64 || "" });
};

export const deletePlayer = (id: number) => {
    return postToAction('deletePlayer', { id });
};
