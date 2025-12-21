
import { getScriptUrl } from './configService';
import type { GameSession, NewPlayer, Player, RatingLogEntry, Trophy } from '../types';

// ==============================
// Response helpers
// ==============================
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();

    if (
      errorText &&
      (errorText.includes('<!DOCTYPE html>') ||
        errorText.includes('<title>Google Drive</title>') ||
        errorText.includes('Service invoked too many times'))
    ) {
      throw new Error(
        `Fout ${response.status}: Apps Script gaf HTML terug i.p.v. JSON. Controleer deployment (Web app) + toegang op "Iedereen".`
      );
    }

    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.message || `Serverfout ${response.status}: Geen details.`);
    } catch {
      throw new Error(`Serverfout ${response.status}: ${errorText || 'Geen details.'}`);
    }
  }

  const text = await response.text();
  if (!text) return { status: 'success' };

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<!DOCTYPE html>')) {
      throw new Error(
        'De server stuurde een HTML-pagina terug in plaats van data (meestal permissie/deployment probleem).'
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
        `Netwerkfout bij actie "${action}". Mogelijke oorzaken: 1) SCRIPT_URL fout. 2) Web App niet correct gedeployed (CORS). 3) Geen internet.`
      );
    }
    throw error;
  }
};

// ==============================
// Robust parsing helpers
// ==============================
const tryParseJson = (v: any) => {
  let cur = v;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (typeof cur !== 'string') return cur;

    let s = cur.trim();
    if (!s) return cur;

    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        cur = JSON.parse(s);
        continue;
      } catch {
        return cur;
      }
    }

    const wrapDouble = s.startsWith('"') && s.endsWith('"') && s.length >= 2;
    const wrapSingle = s.startsWith("'") && s.endsWith("'") && s.length >= 2;
    if (wrapDouble || wrapSingle) {
      cur = s.slice(1, -1).trim();
      continue;
    }

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

      const rawDate = log.date !== undefined ? log.date : log.Datum !== undefined ? log.Datum : undefined;

      if (rawRating === undefined || rawPlayerId === undefined || rawDate === undefined) return null;

      const ratingStr = String(rawRating).replace(',', '.');
      return {
        date: String(rawDate),
        playerId: Number(rawPlayerId),
        rating: Number(ratingStr),
      };
    })
    .filter((x): x is RatingLogEntry => !!x && !isNaN(x.playerId) && !isNaN(x.rating));
};

// ==============================
// ✅ ID IS SOURCE OF TRUTH
// History normalize + rehydrate
// ==============================
type RawTeamMember = number | { id?: any; playerId?: any; name?: any } | any;

const extractId = (m: RawTeamMember): number | null => {
  if (m == null) return null;
  if (typeof m === 'number') return Number.isFinite(m) ? m : null;
  if (typeof m === 'string') {
    const n = Number(m);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof m === 'object') {
    const id = (m as any).id ?? (m as any).playerId ?? (m as any).player_id;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const toIdTeams = (teamsAny: any): number[][] => {
  const t = tryParseJson(teamsAny);
  if (!Array.isArray(t)) return [];

  return t
    .map((team: any) => {
      const arr = tryParseJson(team);
      if (!Array.isArray(arr)) return [];
      return arr.map((m: any) => extractId(m)).filter((id: number | null): id is number => id !== null);
    })
    .filter((team: number[]) => Array.isArray(team));
};

const rehydrateTeams = (idTeams: number[][], playerById: Map<number, Player>): Player[][] => {
  return idTeams.map((teamIds) =>
    teamIds.map((id) => {
      const p = playerById.get(id);
      if (p) return p;

      return {
        id,
        name: `#${id} (verwijderd)`,
        rating: 1,
        isKeeper: false,
        isFixedMember: false,
      } satisfies Player;
    })
  );
};

const normalizeHistory = (rawHistory: any): GameSession[] => {
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

      const r2t =
        obj.round2Teams ??
        obj.round2teams ??
        obj.round2_teams ??
        obj.Round2Teams ??
        obj.Round2teams ??
        obj.Ronde2Teams ??
        undefined;

      const round2Teams = r2t !== undefined ? tryParseJson(r2t) : undefined;

      const session: GameSession = {
        date: String(date),
        teams: Array.isArray(teams) ? (teams as any) : [],
        round1Results: Array.isArray(round1Results) ? round1Results : [],
        round2Results: Array.isArray(round2Results) ? round2Results : [],
        ...(round2Teams !== undefined
          ? { round2Teams: Array.isArray(round2Teams) ? (round2Teams as any) : undefined }
          : {}),
      };

      return session;
    })
    .filter((s: GameSession | null): s is GameSession => !!s && !!s.date);
};

const rehydrateHistoryById = (history: GameSession[], players: Player[]): GameSession[] => {
  const playerById = new Map(players.map((p) => [p.id, p]));

  return history.map((s) => {
    const r1IdTeams = toIdTeams(s.teams);
    const r1Teams = rehydrateTeams(r1IdTeams, playerById);

    const hasR2 = s.round2Teams !== undefined && s.round2Teams !== null;
    const r2IdTeams = hasR2 ? toIdTeams(s.round2Teams) : [];
    const r2Teams = hasR2 ? rehydrateTeams(r2IdTeams, playerById) : undefined;

    return {
      ...s,
      teams: r1Teams,
      ...(r2Teams && r2Teams.length > 0 ? { round2Teams: r2Teams } : {}),
    };
  });
};

// ==============================
// Public API
// ==============================
export const getInitialData = async (): Promise<{
  players: Player[];
  history: GameSession[];
  competitionName: string;
  ratingLogs: RatingLogEntry[];
  trophies: Trophy[];
  seasonStartDate: string;
}> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) {
    throw new Error(
      "De geconfigureerde SCRIPT_URL is ongeldig. Voer een geldige 'Web App URL' in via het configuratiescherm."
    );
  }

  const url = new URL(scriptUrl);
  url.searchParams.append('action', 'getInitialData');
  url.searchParams.append('t', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
  });

  const data = await handleResponse(response);

  if (typeof data !== 'object' || data === null) throw new Error('Onverwacht antwoord van de server (geen object).');
  if ((data as any).status === 'error') throw new Error((data as any).message || 'Onbekende serverfout.');
  if (!Array.isArray((data as any).players)) throw new Error('Verbinding geslaagd, maar er kwam geen spelerslijst terug.');

  const validPlayers: Player[] = (data as any).players
    .filter((p: any) => p && p.id != null && String(p.name || '').trim() !== '')
    .map((p: any) => ({
      id: Number(p.id),
      name: String(p.name),
      rating: Number(p.rating ?? 1),
      startRating:
        p.startRating === undefined || p.startRating === null || p.startRating === ''
          ? undefined
          : Number(String(p.startRating).replace(',', '.')),
      isKeeper: p.isKeeper === true,
      isFixedMember: p.isFixedMember === true,
      photoBase64: p.photoBase64 ? String(p.photoBase64) : '',
      excelId: p.excelId ?? p.excelID ?? undefined,
    }));

  const normalizedHistory = normalizeHistory((data as any).history);
  const rehydratedHistory = rehydrateHistoryById(normalizedHistory, validPlayers);

  return {
    players: validPlayers,
    history: rehydratedHistory,
    competitionName: typeof (data as any).competitionName === 'string' ? (data as any).competitionName : '',
    ratingLogs: parseRatingLogs((data as any).ratingLogs),
    trophies: Array.isArray((data as any).trophies) ? (data as any).trophies : [],
    seasonStartDate: typeof (data as any).seasonStartDate === 'string' ? (data as any).seasonStartDate : '',
  };
};

export const runDiagnostics = async (): Promise<any> => {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !scriptUrl.includes('/exec')) throw new Error('De geconfigureerde SCRIPT_URL is ongeldig.');

  const url = new URL(scriptUrl);
  url.searchParams.append('action', 'runDiagnostics');
  url.searchParams.append('t', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
  });

  const result = await handleResponse(response);
  if (result?.status === 'error') throw new Error(result.message || 'Diagnostiek fout.');
  return result;
};

// ✅ session carries round2Teams when present.
export const saveGameSession = (session: GameSession, updatedRatings: { id: number; rating: number }[]) => {
  return postToAction('saveSession', { session, updatedRatings });
};

// --- Player management ---
export const addPlayer = (player: NewPlayer): Promise<{ newId: number }> => {
  return postToAction('addPlayer', { ...player, photoBase64: player.photoBase64 || '' });
};

export const updatePlayer = (player: Player) => {
  return postToAction('updatePlayer', { ...player, photoBase64: player.photoBase64 || '' });
};

export const deletePlayer = (id: number) => {
  return postToAction('deletePlayer', { id });
};

// --- Competition name ---
export const setCompetitionName = (name: string) => {
  return postToAction('setCompetitionName', { name });
};

// ✅ Season settings
export const setSeasonStartDate = (seasonStartDate: string) => {
  return postToAction('setSeasonStartDate', { seasonStartDate });
};

export const bulkUpdateStartRatings = (startRatings: { id: number; startRating: number | '' }[]) => {
  return postToAction('bulkUpdateStartRatings', { startRatings });
};

// --- Trophy management ---
export const addTrophy = (trophy: Omit<Trophy, 'id'>) => {
  return postToAction('addTrophy', trophy);
};

export const deleteTrophy = (id: string) => {
  return postToAction('deleteTrophy', { id });
};
