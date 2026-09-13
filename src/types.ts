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

  /**
   * Alleen tijdens een NK/Introductietoernooi.
   * Deze speler telt officieel mee in het schema,
   * maar wordt fysiek vervangen door een speler met exact dezelfde rating.
   */
  isTournamentReserve?: boolean;
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

// Nieuwe types voor de NK Module
export interface NKMatch {
  id: string;
  hallName: string;
  team1: Player[];
  team2: Player[];
  team1Score: number;
  team2Score: number;
  referee: Player;
  subHigh: Player; // Rating >= 5
  subLow: Player;  // Rating < 5
  isPlayed: boolean;
}

export interface NKRound {
  roundNumber: number;
  matches: NKMatch[];
  restingPlayers: Player[]; // De rest die geen specifieke rol heeft die ronde
}

/**
 * Een fysieke invaller voor een officiële reserve-deelnemer.
 *
 * De reserve-deelnemer blijft de officiële speler van de wedstrijd
 * en krijgt dus ook de wedstrijd, punten en statistieken.
 *
 * De substitutePlayer speelt fysiek in zijn/haar plaats, maar krijgt
 * zelf geen officiële wedstrijd, punten of wedstrijdtelling.
 */
export interface NKInfillAssignment {
  /** Ronde waarin de invalbeurt plaatsvindt */
  roundNumber: number;

  /** ID van de wedstrijd */
  matchId: string;

  /** De officiële reserve-deelnemer */
  reservePlayerId: number;

  /** De echte speler die fysiek invalt */
  substitutePlayerId: number;

  /** Zaal van de wedstrijd */
  hallName: string;

  /** Team waarvoor de invaller speelt */
  team: 'BLAUW' | 'GEEL';
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
  competitionName: string;
  totalRounds: number;
  hallNames: string[];
  playersPerTeam: number;
  rounds: NKRound[];
  standings: NKStandingsEntry[];

  /** Fysieke invallers voor officiële reserve-deelnemers */
  infillAssignments?: NKInfillAssignment[];

  isCompleted: boolean;
}
