import { getScriptUrl } from './configService';
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
        // If parsing fails, it might be a non-JSON success message or an HTML error page
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

// Main function to fetch all initial data
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string, ratingLogs: RatingLogEntry[]}> => {
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
        throw new Error(`Onverwacht antwoord van de server. De server stuurde geen geldige data, maar dit: ${JSON.stringify(data)}`);
    }

    if (data.status === 'error') {
      throw new Error(data.message);
    }
    
    // The presence of the 'players' array is the primary indicator of a successful connection.
    if (!Array.isArray(data.players)) {
        throw new Error(`Verbinding geslaagd, maar de server stuurde geen spelerslijst terug. Controleer of het 'Spelers' tabblad in je Google Sheet correct is ingesteld met de juiste kolomkoppen.`);
    }

    // Filter out any potential null/undefined entries or players without an ID or name
    const validPlayers = data.players.filter((p: Player | null): p is Player => p !== null && p.id != null && typeof p.name === 'string' && p.name.trim() !== '');

    return {
      players: validPlayers,
      history: Array.isArray(data.history) ? data.history : [],
      competitionName: typeof data.competitionName === 'string' ? data.competitionName : '',
        ratingLogs: Array.isArray(data.ratingLogs) ? data.ratingLogs : [],
    };
  } catch (error: any) {
    console.error("Failed to fetch initial data:", error);
    throw new Error(`Kon de gegevens niet laden. Details: ${error.message}`);
  }
};

// Functie om een diagnostische test uit te voeren op de verbinding en sheet-instellingen
export const runDiagnostics = async (): Promise<any> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
      throw new Error("De geconfigureerde SCRIPT_URL is ongeldig.");
  }

  try {
    const url = new URL(scriptUrl);
    url.searchParams.append('action', 'runDiagnostics');
    url.searchParams.append('t', new Date().getTime().toString()); // Cache busting

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    });
    
    const result = await handleResponse(response);
    if (result.status === 'error') {
      // Her-werp script-side fouten om door de aanroeper te worden opgevangen
      throw new Error(result.message);
    }
    return result;

  } catch (error: any) {
    console.error("Diagnostische test mislukt:", error);
    // Laat de component de UI voor deze fout afhandelen
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
