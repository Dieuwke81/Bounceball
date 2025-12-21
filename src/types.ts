
// =====================================================================================
// CORE TYPES
// =====================================================================================

export interface Player {
  /** Unieke ID in de app (SOURCE OF TRUTH) */
  id: number;

  name: string;
  rating: number;

  isKeeper: boolean;
  isFixedMember: boolean;

  /** Optioneel: base64 afbeelding (kan leeg zijn) */
  photoBase64?: string;

  /**
   * Optioneel: Excel/extern ID.
   * ⚠️ Wordt NIET gebruikt als bron voor logica, alleen voor export/administratie.
   */
  excelId?: string;
}

export type NewPlayer = Omit<Player, 'id'>;

// =====================================================================================
// MATCH / GOALS / SESSIONS
// =====================================================================================

export interface Goal {
  /** Player.id (SOURCE OF TRUTH) */
  playerId: number;
  count: number;
}

export interface Match {
  /** Index in de teams-array */
  team1Index: number;
  /** Index in de teams-array */
  team2Index: number;
}

export interface MatchResult extends Match {
  /** Goals gescoord door spelers van team1 */
  team1Goals: Goal[];
  /** Goals gescoord door spelers van team2 */
  team2Goals: Goal[];
}

export interface GameSession {
  /** ISO string (bijv. 2025-01-01T00:00:00.000Z) */
  date: string;

  /**
   * Teams zoals gespeeld in ronde 1.
   * In de UI gebruiken we Player[][], maar de bron blijft Player.id.
   */
  teams: Player[][];

  round1Results: MatchResult[];
  round2Results: MatchResult[];

  /**
   * Optioneel: teams zoals gebruikt in ronde 2 (manual "nieuwe teams").
   * Als dit ontbreekt, moet de app terugvallen op `teams`.
   */
  round2Teams?: Player[][];
}

// =====================================================================================
// CONSTRAINTS (TEAM GENERATION)
// =====================================================================================

export type ConstraintType = 'together' | 'apart' | 'versus' | 'must_be_5';

export interface Constraint {
  type: ConstraintType;
  /** Player.id’s */
  playerIds: number[];
}

// =====================================================================================
// RATING LOG
// =====================================================================================

export interface RatingLogEntry {
  /** datum string zoals opgeslagen in sheet */
  date: string;
  /** Player.id */
  playerId: number;
  rating: number;
}

// =====================================================================================
// TROPHY ROOM
// =====================================================================================

export type TrophyType =
  | 'Clubkampioen'
  | '2de'
  | '3de'
  | 'Topscoorder'
  | 'Verdediger'
  | 'Speler van het jaar'
  | '1ste NK'
  | '2de NK'
  | '3de NK'
  | '1ste Introductietoernooi'
  | '2de Introductietoernooi'
  | '3de Introductietoernooi'
  | '1ste Wintertoernooi'
  | '2de Wintertoernooi'
  | '3de Wintertoernooi';

export interface Trophy {
  id: string;
  /** Player.id */
  playerId: number;
  type: TrophyType;
  year: string;
}
