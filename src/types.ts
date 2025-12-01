export interface Player {
  id: number;
  name: string;
  rating: number;
  isKeeper: boolean;
  isFixedMember: boolean;
  photoBase64?: string;
  awards?: string; // <--- NIEUW: Dit is de ruwe tekst uit Excel (bv "Kampioen 2023")
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
