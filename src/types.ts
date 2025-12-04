export interface Player {
  id: number;
  name: string;
  rating: number;
  isKeeper: boolean;
  isFixedMember: boolean;
  photoBase64?: string;
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
  teams: Player[][];
  round1Results: MatchResult[];
  round2Results: MatchResult[];
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
// NIEUWE TYPES VOOR DE PRIJZENKAST (TROPHY ROOM)
// ============================================================================

// De specifieke opties die je wilde voor de prijzen
export type TrophyType = 
  | 'Clubkampioen' | '2de' | '3de' 
  | 'Topscoorder' | 'Verdediger' | 'Speler van het jaar'
  | '1ste NK' | '2de NK' | '3de NK'
  | '1ste Introductietoernooi' | '2de Introductietoernooi' | '3de Introductietoernooi'
  | '1ste Wintertoernooi' | '2de Wintertoernooi' | '3de Wintertoernooi';

// Het object hoe we een prijs opslaan in de database
export interface Trophy {
  id: string;        // Unieke ID (nodig om hem later te kunnen verwijderen)
  playerId: number;  // Koppeling aan de speler (via zijn ID)
  type: TrophyType;  // Het soort prijs (uit het lijstje hierboven)
  year: string;      // Het jaartal
}
