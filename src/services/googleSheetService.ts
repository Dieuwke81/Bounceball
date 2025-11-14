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

// Main function to fetch all initial data
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string }> => {
  try {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', 'getInitialData');
    url.searchParams.append('t', new Date().getTime().toString()); // Cache busting

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    });
    
    const data = await handleResponse(response);
    
    if (data.status === 'error') {
      throw new Error(data.message);
    }

    // CRITICAL CHECK: Ensure players are loaded. If not, the setup is incomplete.
    // This prevents the "blank screen" silent failure.
    if (!data.players || data.players.length === 0) {
        throw new Error(`Er zijn geen spelers gevonden in het tabblad '${PLAYERS_SHEET_NAME}'.
Dit is de meest voorkomende oorzaak van een 'lege' app. Controleer a.u.b. het volgende:
1. De naam van het tabblad in Google Sheets is exact '${PLAYERS_SHEET_NAME}'.
2. De deel-instellingen van de Google Sheet staan op 'Iedereen met de link' kan 'Viewer' zijn.
3. Er staan daadwerkelijk spelers in de sheet onder de juiste kolomkoppen (Id, Naam, Rating, etc.).
4. Het Apps Script is correct 'gedeployed' (stap 5 uit de handleiding).`);
    }

    return {
      players: data.players,
      history: data.history || [],
      competitionName: data.competitionName || '',
    };
  } catch (error: any) {
    console.error("Failed to fetch initial data:", error);
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