
import { getScriptUrl } from './configService';
import type { GameSession, NewPlayer, Player, RatingLogEntry, Trophy } from '../types';

// Centralized error handling and JSON parsing for Apps Script calls
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    if (
      errorText &&
      (errorText.includes('<!DOCTYPE html>') ||
        errorText.includes('<title>Google Drive</title>'))
    ) {
      throw new Error(
        `Fout ${response.status}: Authenticatieprobleem met het Apps Script. Controleer of het script correct is 'gedeployed' met toegang voor 'Iedereen'.`
      );
    }
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.message || `Serverfout ${response.status}: Geen details.`);
    } catch (e) {
      throw new Error(`Serverfout ${response.status}: ${errorText || 'Geen details.'}`);
    }
  }

  const text = await response.text();
  if (!text) return { status: 'success' };

  try {
    return JSON.parse(text);
  } catch (e) {
    if (text.includes('<!DOCTYPE html>')) {
      throw new Error(
        'De server stuurde een HTML-pagina terug in plaats van data. Dit wijst meestal op een inlog- of permissieprobleem bij Google.'
      );
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
      throw new Error(
        `Netwerkfout bij actie "${action}". Mogelijke oorzaken: 1) De ingevoerde SCRIPT_URL is incorrect. 2) Google Apps Script is niet correct 'gedeployed' (CORS-fout). 3) Geen internetverbinding.`
      );
    }
    throw error;
  }
};

// ROBUUSTE PARSER: Werkt voor zowel 'rating' als 'Rating', 'SpelerID' als 'playerId', en '.' als ','
const parseRatingLogs = (logs: any[]): RatingLogEntry[] => {
  if (!Array.isArray(logs)) return [];

  return logs
    .map((log) => {
      const rawRating =
        log.rating !== undefined ? log.rating : log.Rating !== undefined ? log.Rating : undefined;

      const rawPlayerId =
        log.playerId !== undefined
          ? log.playerId
          : log.SpelerID !== undefined
            ? log.SpelerID
            : log.playerid !== undefined
              ? log.playerid
              : undefined;

      const rawDate =
        log.date !== undefined ? log.date : log.Datum !== undefined ? log.Datum : undefined;

      if (rawRating === undefined || rawPlayerId === undefined || rawDate === undefined) {
        return null;
      }

      const ratingStr = String(rawRating).replace(',', '.');
      const dateStr = String(rawDate);

      return {
        date: dateStr,
        playerId: Number(rawPlayerId),
        rating: Number(ratingStr),
      };
    })
    .filter((log): log is RatingLogEntry => {
      return log !== null && !isNaN(log.playerId) && !isNaN(log.rating) && log.playerId !== 0;
    });
};

/**
 * ✅ NEW: normaliseer history zodat round2Teams (en varianten) goed binnenkomen.
 * - history kan soms een JSON-string zijn
 * - round2Teams kan terugkomen als round2teams / round2_teams / Round2Teams / etc.
 *
 * ✅ FIX: ook dubbel-gequote JSON-strings (bijv "\"[ ... ]\"") worden nu correct geparsed.
 */
const normalizeHistory = (rawHistory: any): GameSession[] => {
  /**
   * Probeert JSON te parsen, maar ook:
   * - strip wrapping quotes ("...") of ('...') als het daarna JSON lijkt
   * - probeert een paar keer (voor double-encoded situaties)
   */
  const tryParseJson = (v: any) => {
    let cur = v;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (typeof cur !== 'string') return cur;

      let s = cur.trim();
      if (!s) return cur;

      // 1) Als het lijkt op JSON: parse direct
      if (s.startsWith('{') || s.startsWith('[')) {
        try {
          cur = JSON.parse(s);
          continue; // misschien nog een keer nodig bij nested strings
        } catch {
          return cur;
        }
      }

      // 2) Als het wrapping quotes heeft: strip en probeer opnieuw
      const hasDoubleWrap = s.startsWith('"') && s.endsWith('"') && s.length >= 2;
      const hasSingleWrap = s.startsWith("'") && s.endsWith("'") && s.length >= 2;

      if (hasDoubleWrap || hasSingleWrap) {
        s = s.slice(1, -1).trim();
        cur = s;
        continue;
      }

      // 3) Soms komen er nog escapings in mee (\"[ ... ]\")
      //    Als het ergens een '{' of '[' bevat, proberen we dat stuk te pakken.
      const idxObj = s.indexOf('{');
      const idxArr = s.indexOf('[');
      const idx = idxArr === -1 ? idxObj : idxObj === -1 ? idxArr : Math.min(idxArr, idxObj);

      if (idx > 0) {
        const candidate = s.slice(idx).trim();
        if (candidate.startsWith('{') || candidate.startsWith('[')) {
          cur = candidate;
          continue;
        }
      }

      return cur;
    }

    return cur;
  };

  const h = tryParseJson(rawHistory);
  if (!Array.isArray(h)) return [];

  return h
    .map((row: any) => {
      const obj = tryParseJson(row);
      if (!obj || typeof obj !== 'object') return null;

      const date = obj.date ?? obj.Datum ?? obj.datum ?? '';
      const teams = tryParseJson(obj.teams ?? obj.Teams ?? []);
      const round1Results = tryParseJson(obj.round1Results ?? obj.round1results ?? obj.Ronde1 ?? []);
      const round2Results = tryParseJson(obj.round2Results ?? obj.round2results ?? obj.Ronde2 ?? []);

      // alle varianten die we in het wild zien:
      const r2t =
        obj.round2Teams ??
        obj.round2teams ??
        obj.round2_teams ??
        obj.Round2Teams ??
        obj.Round2teams ??
        obj.Ronde2Teams ??
        undefined;

      const round2TeamsParsed = r2t !== undefined ? tryParseJson(r2t) : undefined;

      const session: GameSession = {
        date: String(date),
        teams: Array.isArray(teams) ? teams : [],
        round1Results: Array.isArray(round1Results) ? round1Results : [],
        round2Results: Array.isArray(round2Results) ? round2Results : [],
        ...(Array.isArray(round2TeamsParsed) ? { round2Teams: round2TeamsParsed } : {}),
      };

      return session;
    })
    .filter((s: GameSession | null): s is GameSession => !!s && typeof s.date === 'string' && !!s.date);
};

// Main function to fetch all initial data
// AANGEPAST: Retourneert nu ook 'trophies'
export const getInitialData = async (): Promise<{
  players: Player[];
  history: GameSession[];
  competitionName: string;
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[];
}> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
    throw new Error(
      "De geconfigureerde SCRIPT_URL is ongeldig. Voer een geldige 'Web App URL' in via het configuratiescherm."
    );
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

    const validPlayers = data.players.filter(
      (p: Player | null): p is Player =>
        p !== null && p.id != null && typeof p.name === 'string' && p.name.trim() !== ''
    );

    return {
      players: validPlayers,
      // ✅ history normaliseren (incl. double-encoded round2Teams)
      history: normalizeHistory(data.history),
      competitionName: typeof data.competitionName === 'string' ? data.competitionName : '',
      ratingLogs: parseRatingLogs(data.ratingLogs),
      trophies: Array.isArray(data.trophies) ? data.trophies : [],
    };
  } catch (error: any) {
    console.error('Failed to fetch initial data:', error);
    throw new Error(`Kon de gegevens niet laden. Details: ${error.message}`);
  }
};

export const runDiagnostics = async (): Promise<any> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
    throw new Error('De geconfigureerde SCRIPT_URL is ongeldig.');
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
    console.error('Diagnostische test mislukt:', error);
    throw error;
  }
};

// Functie om de game session en rating updates op te slaan
export const saveGameSession = (session: GameSession, updatedRatings: { id: number; rating: number }[]) => {
  // ✅ niks extra nodig hier: round2Teams zit al in session en gaat mee
  return postToAction('saveSession', { session, updatedRatings });
};

// --- Player Management ---
export const addPlayer = (player: NewPlayer): Promise<{ newId: number }> => {
  return postToAction('addPlayer', { ...player, photoBase64: player.photoBase64 || '' });
};

export const updatePlayer = (player: Player) => {
  return postToAction('updatePlayer', { ...player, photoBase64: player.photoBase64 || '' });
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
