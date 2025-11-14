
import { SCRIPT_URL } from '../config';
import type { GameSession, NewPlayer, Player } from '../types';

// Centralized error handling and JSON parsing
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

// Functie om de initiële data (spelers, geschiedenis, naam) op te halen
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string }> => {
  try {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('t', new Date().getTime().toString()); // Cache busting

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
    });
    
    const data = await handleResponse(response);
    
    if (data.status === 'error') {
      throw new Error(data.message);
    }

    return {
      players: data.players || [],
      history: data.history || [],
      competitionName: data.competitionName || '',
    };
  } catch (error) {
    console.error("Failed to fetch initial data from Google Sheet:", error);
    throw new Error(`Kon de gegevens niet laden. Controleer de SCRIPT_URL en de 'deployment' van het script. Fout: ${error.message}`);
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
