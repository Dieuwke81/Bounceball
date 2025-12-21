
export interface Player {
  id: number;
  name: string;

  /** Huidige rating (actueel in app) */
  rating: number;

  /** Start rating bij begin seizoen (handmatig instelbaar) */
  startRating?: number;

  isKeeper: boolean;
  isFixedMember: boolean;
  photoBase64?: string;

  /** Alleen voor CSV export (NOOIT als bron) */
  excelId?: string;
}

export type NewPlayer = Omit<Player, 'id'>;

export interface Goal {
  playerId: number;
  count: number;
}

export interface Match {
  team1Index: number;
  team2Index: number;
}

export interface MatchResult extends Match {
  team1Goals: Goal[];
  team2Goals: Goal[];
}

export interface GameSession {
  date: string;

  /** Teams zoals gespeeld in ronde 1 */
  teams: Player[][];

  round1Results: MatchResult[];
  round2Results: MatchResult[];

  /** Teams zoals gebruikt in ronde 2 (optioneel, bij manual new teams) */
  round2Teams?: Player[][];
}

export type ConstraintType = 'together' | 'apart' | 'versus' | 'must_be_5';

export interface Constraint {
  type: ConstraintType;
  playerIds: number[];
}

export interface RatingLogEntry {
  date: string;
  playerId: number;
  rating: number;
}

// ============================================================================
// TROPHY ROOM
// ============================================================================
export type TrophyType =
  | 'Clubkampioen' | '2de' | '3de'
  | 'Topscoorder' | 'Verdediger' | 'Speler van het jaar'
  | '1ste NK' | '2de NK' | '3de NK'
  | '1ste Introductietoernooi' | '2de Introductietoernooi' | '3de Introductietoernooi'
  | '1ste Wintertoernooi' | '2de Wintertoernooi' | '3de Wintertoernooi';

export interface Trophy {
  id: string;
  playerId: number;
  type: TrophyType;
  year: string;
}

/** NIEUW: seizoen startdatum (Instellingen) */
export interface SeasonSettings {
  seasonStartDate: string; // "YYYY-MM-DD"
}
