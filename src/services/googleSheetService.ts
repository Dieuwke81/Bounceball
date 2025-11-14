import { SCRIPT_URL, SPREADSHEET_ID, PLAYERS_SHEET_NAME } from '../config';
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

// Functie om spelers direct uit de sheet te halen via CSV export
const getPlayersFromCsv = async (): Promise<Player[]> => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(PLAYERS_SHEET_NAME)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Kon spelersblad niet ophalen. Status: ${response.status}`);
        }
        const csvText = await response.text();
        // Verwijder eventuele carriage returns (\r) en splits op nieuwe regels
        const rows = csvText.replace(/\r/g, '').split('\n').slice(1);
        
        const players: Player[] = rows.map((row): Player | null => {
            // Robuuste CSV parsing die rekening houdt met waarden tussen aanhalingstekens
            const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
            if (columns.length < 5) return null; // Zorg voor voldoende kolommen

            const [id, name, rating, isKeeper, isFixedMember, photoBase64] = columns.map(col => col.replace(/"/g, '').trim());

            return {
                id: parseInt(id, 10),
                name: name,
                rating: parseFloat(rating),
                isKeeper: isKeeper.toLowerCase() === 'true',
                isFixedMember: isFixedMember.toLowerCase() === 'true',
                photoBase64: photoBase64 || undefined
            };
// Fix: Add explicit return type to the map callback to satisfy the type predicate in the filter.
        }).filter((p): p is Player => p !== null && !isNaN(p.id) && !!p.name); // Filter lege/ongeldige rijen

        if (players.length === 0) {
            throw new Error("Spelerslijst is leeg of kon niet worden gelezen. Controleer of het blad 'Spelers' bestaat en of de spreadsheet-link is ingesteld op 'Iedereen met de link'.");
        }

        return players;
    } catch (error: any) {
        console.error("Fout bij het ophalen van spelers uit CSV:", error);
        throw new Error(`Kon spelers niet laden. Controleer SPREADSHEET_ID en PLAYERS_SHEET_NAME in config.ts. Fout: ${error.message}`);
    }
};


// Functie om de initiële data op te halen
export const getInitialData = async (): Promise<{ players: Player[], history: GameSession[], competitionName: string }> => {
  try {
    // Start beide fetches parallel voor efficiëntie
    const playersPromise = getPlayersFromCsv();
    
    const secondaryDataPromise = fetch(new URL(SCRIPT_URL).toString(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache', // Voorkom caching problemen
    }).then(handleResponse);

    const [players, secondaryData] = await Promise.all([playersPromise, secondaryDataPromise]);

    if (secondaryData.status === 'error') {
        // Log de fout, maar ga door, de geschiedenis is minder kritisch dan de spelerslijst
        console.error("Fout bij ophalen secundaire data (geschiedenis/naam):", secondaryData.message);
    }

    return {
      players,
      history: secondaryData.history || [],
      competitionName: secondaryData.competitionName || '',
    };
  } catch (error: any) {
    console.error("Failed to fetch initial data:", error);
    throw new Error(`Kon de gegevens niet laden. ${error.message}`);
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