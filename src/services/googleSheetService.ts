import { getScriptUrl } from './configService';
import type { GameSession, NewPlayer, Player, RatingLogEntry, Trophy } from '../types';

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
        if (text.includes('<!DOCTYPE html>')) {
             throw new Error("De server stuurde een HTML-pagina terug in plaats van data. Dit wijst meestal op een inlog- of permissieprobleem bij Google.");
        }
        return text;
    }
};

const postToAction = async (action: string, data: object): Promise<any> => {
  const scriptUrl = getScriptUrl();
  try {
    const response = await fetch(scriptUrl, {
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
      throw new Error(`Netwerkfout bij actie "${action}". Mogelijke oorzaken: 1) De ingevoerde SCRIPT_URL is incorrect. 2) Google Apps Script is niet correct 'gedeployed' (CORS-fout). 3) Geen internetverbinding.`);
    }
    throw error;
  }
};

// ROBUUSTE PARSER: Werkt voor zowel 'rating' als 'Rating', 'SpelerID' als 'playerId', en '.' als ','
const parseRatingLogs = (logs: any[]): RatingLogEntry[] => {
    if (!Array.isArray(logs)) return [];
    
    return logs.map(log => {
        const rawRating = log.rating !== undefined ? log.rating : (log.Rating !== undefined ? log.Rating : undefined);
        const rawPlayerId = log.playerId !== undefined ? log.playerId : (log.SpelerID !== undefined ? log.SpelerID : (log.playerid !== undefined ? log.playerid : undefined));
        const rawDate = log.date !== undefined ? log.date : (log.Datum !== undefined ? log.Datum : (log.date !== undefined ? log.date : undefined));

        if (rawRating === undefined || rawPlayerId === undefined || rawDate === undefined) {
            return null;
        }

        const ratingStr = String(rawRating).replace(',', '.');
        const dateStr = String(rawDate);
        
        return {
            date: dateStr,
            playerId: Number(rawPlayerId),
            rating: Number(ratingStr)
        };
    }).filter((log): log is RatingLogEntry => {
        return log !== null && !isNaN(log.playerId) && !isNaN(log.rating) && log.playerId !== 0;
    });
};

// Main function to fetch all initial data
// AANGEPAST: Retourneert nu ook 'trophies'
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string, ratingLogs: RatingLogEntry[], trophies: Trophy[] }> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
      throw new Error("De geconfigureerde SCRIPT_URL is ongeldig. Voer een geldige 'Web App URL' in via het configuratiescherm.");
  }
  
  try {
    const url = new URL(scriptUrl);
    url.searchParams.append('action', 'getInitialData');
    url.searchParams.append('t', new Date().getTime().toString()); // Cache busting

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    });
    
    const data = await handleResponse(response);
    
    if (typeof data !== 'object' || data === null) {
        throw new Error(`Onverwacht antwoord van de server. De server stuurde geen geldige data.`);
    }

    if (data.status === 'error') {
      throw new Error(data.message);
    }
    
    if (!Array.isArray(data.players)) {
        throw new Error(`Verbinding geslaagd, maar de server stuurde geen spelerslijst terug.`);
    }

    const validPlayers = data.players.filter((p: Player | null): p is Player => p !== null && p.id != null && typeof p.name === 'string' && p.name.trim() !== '');

    return {
      players: validPlayers,
      history: Array.isArray(data.history) ? data.history : [],
      competitionName: typeof data.competitionName === 'string' ? data.competitionName : '',
      ratingLogs: parseRatingLogs(data.ratingLogs),
      // NIEUW: Haal prijzen op, of geef lege lijst terug als ze nog niet bestaan
      trophies: Array.isArray(data.trophies) ? data.trophies : [],
    };
  } catch (error: any) {
    console.error("Failed to fetch initial data:", error);
    throw new Error(`Kon de gegevens niet laden. Details: ${error.message}`);
  }
};

export const runDiagnostics = async (): Promise<any> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
      throw new Error("De geconfigureerde SCRIPT_URL is ongeldig.");
  }

  try {
    const url = new URL(scriptUrl);
    url.searchParams.append('action', 'runDiagnostics');
    url.searchParams.append('t', new Date().getTime().toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    });
    
    const result = await handleResponse(response);
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result;

  } catch (error: any) {
    console.error("Diagnostische test mislukt:", error);
    throw error;
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

// --- Trophy Management (NIEUW) ---
export const addTrophy = (trophy: Omit<Trophy, 'id'>) => {
    return postToAction('addTrophy', trophy);
};

export const deleteTrophy = (id: string) => {
    return postToAction('deleteTrophy', { id });
};
