export interface Player {
  id: number;
  name: string;

  /** Huidige rating (actueel in app) */
  rating: number;

  /** Start rating bij begin seizoen (handmatig instelbaar) */
  startRating?: number;

  /** Of deze speler keeper is */
  isKeeper: boolean;

  /** Vast lid van de vereniging */
  isFixedMember: boolean;

  /** Optionele profielfoto */
  photoBase64?: string;

  /** Alleen voor CSV-export (NOOIT als bron gebruiken) */
  excelId?: string;
}

export type NewPlayer = Omit<Player, 'id'>;


// ============================================================================
// WEDSTRIJDEN / GAME SESSION
// ============================================================================

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


// ============================================================================
// CONSTRAINTS
// ============================================================================

export type ConstraintType =
  | 'together'
  | 'apart'
  | 'versus'
  | 'must_be_5';

export interface Constraint {
  type: ConstraintType;
  playerIds: number[];
}


// ============================================================================
// RATING LOG
// ============================================================================

export interface RatingLogEntry {
  date: string;
  playerId: number;
  rating: number;
}


// ============================================================================
// TROPHY ROOM
// ============================================================================

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
  playerId: number;
  type: TrophyType;
  year: string;
}


// ============================================================================
// SEIZOEN
// ============================================================================

export interface SeasonSettings {
  /** Seizoen startdatum in formaat YYYY-MM-DD */
  seasonStartDate: string;
}


// ============================================================================
// NK / INTRODUCTIETOERNOOI
// ============================================================================

export interface NKMatch {
  /** Unieke ID van de wedstrijd */
  id: string;

  /** Zaal waarin de wedstrijd gespeeld wordt */
  hallName: string;

  /** Team 1 */
  team1: Player[];

  /** Team 2 */
  team2: Player[];

  /** Uitslag */
  team1Score: number;
  team2Score: number;

  /**
   * Scheidsrechter.
   *
   * Tijdens het genereren kan deze nog null zijn.
   */
  referee: Player | null;

  /**
   * Hoge reserve.
   *
   * Tijdens het genereren kan deze nog null zijn.
   */
  subHigh: Player | null;

  /**
   * Lage reserve.
   *
   * Tijdens het genereren kan deze nog null zijn.
   */
  subLow: Player | null;

  /** Of de wedstrijd al gespeeld is */
  isPlayed: boolean;
}

export interface NKRound {
  /** Rondenummer, beginnend bij 1 */
  roundNumber: number;

  /** Wedstrijden in deze ronde */
  matches: NKMatch[];

  /**
   * Spelers die deze ronde helemaal geen specifieke rol hebben.
   *
   * Dit staat los van subHigh, subLow en referee.
   */
  restingPlayers: Player[];

  /** Optionele tijden van de ronde */
  startTime?: string;
  endTime?: string;
}

export interface NKStandingsEntry {
  playerId: number;
  playerName: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  matchesPlayed: number;
}

export interface NKSession {
  /** Naam van het toernooi */
  competitionName: string;

  /** Totaal aantal rondes */
  totalRounds: number;

  /** Beschikbare zalen */
  hallNames: string[];

  /** Aantal spelers per team */
  playersPerTeam: number;

  /** Alle rondes */
  rounds: NKRound[];

  /** Stand */
  standings: NKStandingsEntry[];

  /** Of het toernooi is afgerond */
  isCompleted: boolean;
}
