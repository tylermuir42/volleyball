import {
  Bracket,
  BracketDetail,
  Court,
  EnrichedPool,
  Location,
  ScoreInput,
  Standing,
  Team,
  Tournament,
  TournamentOverview,
} from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    status?: number;
  };
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as ApiErrorResponse;
      if (payload.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // ignore json parse errors and keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getTournaments: () => request<Tournament[]>("/tournaments"),
  getTournament: (id: number) => request<Tournament>(`/tournaments/${id}`),
  getTournamentOverview: (id: number) =>
    request<TournamentOverview>(`/tournaments/${id}/overview`),
  createTournament: (payload: { name: string; date: string }) =>
    request<Tournament>("/tournaments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getLocations: (tournamentId: number) =>
    request<Location[]>(`/tournaments/${tournamentId}/locations`),
  createLocation: (
    tournamentId: number,
    payload: { name: string; max_courts?: number },
  ) =>
    request<Location>(`/tournaments/${tournamentId}/locations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createCourt: (locationId: number, payload: { label: string }) =>
    request<Court>(`/locations/${locationId}/courts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getTeams: (tournamentId: number) =>
    request<Team[]>(`/tournaments/${tournamentId}/teams`),
  createTeam: (
    tournamentId: number,
    payload: { name: string; coach_name?: string; coach_email?: string },
  ) =>
    request<Team>(`/tournaments/${tournamentId}/teams`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  bulkCreateTeams: (
    tournamentId: number,
    payload: {
      teams: Array<{ name: string; coach_name?: string; coach_email?: string }>;
    },
  ) =>
    request<Team[]>(`/tournaments/${tournamentId}/teams/bulk`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  autoAssignPools: (
    tournamentId: number,
    payload: {
      num_pools: number;
      teams_per_pool: number;
      location_id?: number;
      court_id?: number;
    },
  ) =>
    request<{ pools: unknown[]; matches: unknown[] }>(
      `/tournaments/${tournamentId}/pools/auto-assign`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  getPools: (tournamentId: number) =>
    request<EnrichedPool[]>(`/tournaments/${tournamentId}/pools`),
  getTournamentStandings: (tournamentId: number) =>
    request<Standing[]>(`/tournaments/${tournamentId}/standings`),

  submitScore: (matchId: number, payload: ScoreInput) =>
    request(`/matches/${matchId}/score`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBrackets: (tournamentId: number) =>
    request<Bracket[]>(`/tournaments/${tournamentId}/brackets`),
  getBracketById: (tournamentId: number, bracketId: number) =>
    request<BracketDetail>(
      `/tournaments/${tournamentId}/brackets/${bracketId}`,
    ),

  isEndpointAvailable: async (path: string): Promise<boolean> => {
    try {
      await request(path);
      return true;
    } catch (err) {
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes("404") || message.includes("not found")) {
          return false;
        }
      }
      throw err;
    }
  },
};
