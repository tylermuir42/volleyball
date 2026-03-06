/**
 * Domain Model Types
 * TypeScript interfaces for all entities
 */

// Tournament
export interface Tournament {
  id: number;
  name: string;
  date: string; // ISO date
  status: TournamentStatus;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export type TournamentStatus =
  | "CREATED"
  | "POOL_PLAY_ACTIVE"
  | "POOL_PLAY_COMPLETE"
  | "BRACKETS_GENERATED"
  | "BRACKET_PLAY_ACTIVE"
  | "COMPLETE";

export interface CreateTournamentInput {
  name: string;
  date: string; // YYYY-MM-DD
}

// Location & Court
export interface Location {
  id: number;
  tournament_id: number;
  name: string;
  max_courts: number;
  created_at: string;
  updated_at: string;
}

export interface Court {
  id: number;
  location_id: number;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCourtInput {
  label: string;
}

// Team
export interface Team {
  id: number;
  tournament_id: number;
  name: string;
  coach_name: string | null;
  coach_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTeamInput {
  name: string;
  coach_name?: string;
  coach_email?: string;
}

// Pool
export interface Pool {
  id: number;
  tournament_id: number;
  location_id: number | null;
  court_id: number | null;
  name: string;
  status: PoolStatus;
  created_at: string;
  updated_at: string;
}

export type PoolStatus = "SCHEDULED" | "ACTIVE" | "COMPLETE";

// PoolTeam
export interface PoolTeam {
  id: number;
  pool_id: number;
  team_id: number;
  seed_in_pool: number;
  created_at: string;
  updated_at: string;
}

// Match
export interface Match {
  id: number;
  tournament_id: number;
  pool_id: number | null;
  bracket_id: number | null;
  team1_id: number;
  team2_id: number;
  set1_team1: number | null;
  set1_team2: number | null;
  set2_team1: number | null;
  set2_team2: number | null;
  set3_team1: number | null;
  set3_team2: number | null;
  status: MatchStatus;
  winner_team_id: number | null;
  court_id: number | null;
  start_time: string | null; // ISO datetime
  created_at: string;
  updated_at: string;
}

export type MatchStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETE";

export interface SetScore {
  team1: number;
  team2: number;
}

export interface SubmitScoreInput {
  set1_team1: number;
  set1_team2: number;
  set2_team1: number;
  set2_team2: number;
  set3_team1?: number;
  set3_team2?: number;
}

// Bracket
export interface Bracket {
  id: number;
  tournament_id: number;
  name: string; // Gold, Silver, etc.
  size: 4 | 8 | 12;
  location_id: number | null;
  status: BracketStatus;
  created_at: string;
  updated_at: string;
}

export type BracketStatus = "CREATED" | "ACTIVE" | "COMPLETE";

// Bracket Slot
export interface BracketSlot {
  id: number;
  bracket_id: number;
  seed: number;
  team_id: number | null;
  source_pool_id: number | null;
  source_pool_rank: number | null;
  created_at: string;
  updated_at: string;
}

// Duty
export interface Duty {
  id: number;
  match_id: number;
  team_id: number;
  role: DutyRole;
  status: DutyStatus;
  created_at: string;
  updated_at: string;
}

export type DutyRole = "REF" | "LINE_JUDGE";
export type DutyStatus = "SCHEDULED" | "COMPLETED" | "MISSED";

// Standings
export interface Standing {
  pool_id: number;
  team_id: number;
  team_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  rank: number;
}

// Request/Response Wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}
