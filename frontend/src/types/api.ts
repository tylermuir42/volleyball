export type TournamentStatus =
  | "CREATED"
  | "POOL_PLAY_ACTIVE"
  | "POOL_PLAY_COMPLETE"
  | "BRACKETS_GENERATED"
  | "BRACKET_PLAY_ACTIVE"
  | "COMPLETE";

export type MatchStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETE";

export interface Tournament {
  id: number;
  name: string;
  date: string | null;
  status: TournamentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentOverview {
  tournament: Tournament;
  num_teams: number;
  num_pools: number;
  num_matches: number;
  num_brackets: number;
}

export interface Location {
  id: number;
  tournament_id: number;
  name: string;
  max_courts: number;
}

export interface Court {
  id: number;
  location_id: number;
  label: string;
}

export interface Team {
  id: number;
  tournament_id: number;
  name: string;
  coach_name: string | null;
  coach_email: string | null;
}

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
  start_time: string | null;
}

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

export interface Pool {
  id: number;
  tournament_id: number;
  location_id: number | null;
  court_id: number | null;
  name: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETE";
}

export interface EnrichedPool extends Pool {
  standings: Standing[];
  matches: Match[];
}

export interface ScoreInput {
  set1_team1: number;
  set1_team2: number;
  set2_team1: number;
  set2_team2: number;
  set3_team1?: number;
  set3_team2?: number;
}

export interface Bracket {
  id: number;
  tournament_id: number;
  name: string;
  size: number;
  location_id: number | null;
  status?: "CREATED" | "ACTIVE" | "COMPLETE";
}

export interface BracketSlot {
  id: number;
  bracket_id: number;
  seed: number;
  team_id: number | null;
  source_pool_id: number | null;
  source_pool_rank: number | null;
}

export interface BracketDetail {
  bracket: Bracket;
  slots?: BracketSlot[];
  matches?: Match[];
}

export interface Duty {
  id: number;
  match_id: number;
  team_id: number;
  role: "REF" | "LINE_JUDGE";
  status: "SCHEDULED" | "COMPLETED" | "MISSED";
  start_time?: string | null;
  court_label?: string;
  location_name?: string;
  opponent_team_name?: string;
}
