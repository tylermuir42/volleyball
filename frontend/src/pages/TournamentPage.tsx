import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useTournamentUpdates } from "../lib/useTournamentUpdates";
import {
  Court,
  EnrichedPool,
  Location,
  ScoreInput,
  Team,
  TournamentOverview,
} from "../types/api";

type TabKey = "overview" | "setup" | "pool-play" | "standings" | "brackets";

const tabOrder: TabKey[] = [
  "overview",
  "setup",
  "pool-play",
  "standings",
  "brackets",
];

type MatchScoreDraft = {
  set1_team1: string;
  set1_team2: string;
  set2_team1: string;
  set2_team2: string;
  set3_team1: string;
  set3_team2: string;
};

function emptyScoreDraft(): MatchScoreDraft {
  return {
    set1_team1: "",
    set1_team2: "",
    set2_team1: "",
    set2_team2: "",
    set3_team1: "",
    set3_team2: "",
  };
}

export default function TournamentPage() {
  const { id } = useParams();
  const tournamentId = Number(id);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [overview, setOverview] = useState<TournamentOverview | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [courtsByLocation, setCourtsByLocation] = useState<
    Record<number, Court[]>
  >({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<EnrichedPool[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [locationForm, setLocationForm] = useState({
    name: "",
    max_courts: "4",
  });
  const [courtForm, setCourtForm] = useState({ location_id: "", label: "" });
  const [teamForm, setTeamForm] = useState({
    name: "",
    coach_name: "",
    coach_email: "",
  });
  const [bulkTeamsText, setBulkTeamsText] = useState(
    '[{"name":"Team A"},{"name":"Team B"}]',
  );

  const [poolAssignForm, setPoolAssignForm] = useState({
    num_pools: "2",
    teams_per_pool: "3",
    location_id: "",
    court_id: "",
  });

  const [matchScoreDrafts, setMatchScoreDrafts] = useState<
    Record<number, MatchScoreDraft>
  >({});

  const teamNameById = useMemo(() => {
    return teams.reduce<Record<number, string>>((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
  }, [teams]);

  const refreshAll = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const [overviewData, locationsData, teamsData, poolsData] =
          await Promise.all([
            api.getTournamentOverview(tournamentId),
            api.getLocations(tournamentId),
            api.getTeams(tournamentId),
            api.getPools(tournamentId).catch(() => [] as EnrichedPool[]),
          ]);

        setOverview(overviewData);
        setLocations(locationsData);
        setTeams(teamsData);
        setPools(poolsData);
        setLastUpdatedAt(new Date());

        if (locationsData.length > 0) {
          const courtEntries = await Promise.all(
            locationsData.map(async (location) => {
              const courts = await fetchCourts(location.id);
              return [location.id, courts] as const;
            }),
          );

          setCourtsByLocation(Object.fromEntries(courtEntries));
        } else {
          setCourtsByLocation({});
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load page.";
        setError(message);
      } finally {
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) {
      setError("Invalid tournament id.");
      return;
    }

    void refreshAll(true);
  }, [refreshAll, tournamentId]);

  const realtime = useTournamentUpdates({
    tournamentId,
    refresh: () => refreshAll(false),
  });

  async function fetchCourts(locationId: number): Promise<Court[]> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/locations/${locationId}/courts`,
      );
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as Court[];
      return data;
    } catch {
      return [];
    }
  }

  async function handleCreateLocation(event: FormEvent) {
    event.preventDefault();
    setBusyAction("create-location");
    setStatusMessage(null);
    try {
      await api.createLocation(tournamentId, {
        name: locationForm.name,
        max_courts: Number(locationForm.max_courts),
      });
      setLocationForm({ name: "", max_courts: "4" });
      await refreshAll();
      setStatusMessage("Location created.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create location.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateCourt(event: FormEvent) {
    event.preventDefault();
    setBusyAction("create-court");
    setStatusMessage(null);
    try {
      await api.createCourt(Number(courtForm.location_id), {
        label: courtForm.label,
      });
      setCourtForm({ location_id: "", label: "" });
      await refreshAll();
      setStatusMessage("Court created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create court.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateTeam(event: FormEvent) {
    event.preventDefault();
    setBusyAction("create-team");
    setStatusMessage(null);
    try {
      await api.createTeam(tournamentId, teamForm);
      setTeamForm({ name: "", coach_name: "", coach_email: "" });
      await refreshAll();
      setStatusMessage("Team created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBulkCreateTeams(event: FormEvent) {
    event.preventDefault();
    setBusyAction("bulk-teams");
    setStatusMessage(null);

    try {
      const parsed = JSON.parse(bulkTeamsText) as Array<{
        name: string;
        coach_name?: string;
        coach_email?: string;
      }>;

      await api.bulkCreateTeams(tournamentId, { teams: parsed });
      await refreshAll();
      setStatusMessage("Bulk team import complete.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to bulk import teams. Validate JSON format.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAutoAssignPools(event: FormEvent) {
    event.preventDefault();
    setBusyAction("auto-assign");
    setStatusMessage(null);

    try {
      await api.autoAssignPools(tournamentId, {
        num_pools: Number(poolAssignForm.num_pools),
        teams_per_pool: Number(poolAssignForm.teams_per_pool),
        location_id: poolAssignForm.location_id
          ? Number(poolAssignForm.location_id)
          : undefined,
        court_id: poolAssignForm.court_id
          ? Number(poolAssignForm.court_id)
          : undefined,
      });
      await refreshAll();
      setStatusMessage("Pools and round-robin matches generated.");
      setActiveTab("pool-play");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Pool auto-assignment failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function updateMatchScoreDraft(
    matchId: number,
    field: keyof MatchScoreDraft,
    value: string,
  ) {
    setMatchScoreDrafts((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || emptyScoreDraft()),
        [field]: value,
      },
    }));
  }

  async function handleSubmitScore(matchId: number) {
    setBusyAction(`submit-score-${matchId}`);
    setStatusMessage(null);

    try {
      const draft = matchScoreDrafts[matchId] || emptyScoreDraft();
      const payload: ScoreInput = {
        set1_team1: Number(draft.set1_team1),
        set1_team2: Number(draft.set1_team2),
        set2_team1: Number(draft.set2_team1),
        set2_team2: Number(draft.set2_team2),
      };

      if (draft.set3_team1.trim() !== "" || draft.set3_team2.trim() !== "") {
        payload.set3_team1 = Number(draft.set3_team1);
        payload.set3_team2 = Number(draft.set3_team2);
      }

      await api.submitScore(matchId, payload);
      await refreshAll();
      setStatusMessage(`Score saved for match ${matchId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit score.");
    } finally {
      setBusyAction(null);
    }
  }

  const allCourts = useMemo(() => {
    return Object.entries(courtsByLocation).flatMap(([locationId, courts]) =>
      courts.map((court) => ({ ...court, locationId: Number(locationId) })),
    );
  }, [courtsByLocation]);

  if (loading && !overview) {
    return <main className="page">Loading tournament details…</main>;
  }

  if (error && !overview) {
    return (
      <main className="page">
        <p className="error-text">{error}</p>
        <Link to="/" className="text-link">
          Back to tournaments
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tournament Admin</p>
          <h1>{overview?.tournament.name || `Tournament ${tournamentId}`}</h1>
          <p>
            Status: <strong>{overview?.tournament.status || "UNKNOWN"}</strong>
          </p>
          <div className="status-row">
            <span
              className={`status-badge ${
                realtime.mode === "websocket"
                  ? realtime.socketConnected
                    ? "status-badge-online"
                    : "status-badge-connecting"
                  : "status-badge-polling"
              }`}
            >
              {realtime.mode === "websocket"
                ? realtime.socketConnected
                  ? "WebSocket connected"
                  : "WebSocket connecting"
                : "Polling mode"}
            </span>
            <span className="muted">
              Last updated:{" "}
              {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "--"}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <Link to="/" className="button button-secondary">
            All Tournaments
          </Link>
          <Link
            to={`/public/tournaments/${tournamentId}`}
            className="button button-secondary"
          >
            Public View
          </Link>
        </div>
      </header>

      <nav className="tab-row" aria-label="Tournament sections">
        {tabOrder.map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? "tab-button-active" : ""}`}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </nav>

      {error && <p className="error-text">{error}</p>}
      {statusMessage && <p className="success-text">{statusMessage}</p>}

      {activeTab === "overview" && overview && (
        <section className="panel-grid">
          <article className="metric-card">
            <p>Teams</p>
            <h2>{overview.num_teams}</h2>
          </article>
          <article className="metric-card">
            <p>Pools</p>
            <h2>{overview.num_pools}</h2>
          </article>
          <article className="metric-card">
            <p>Matches</p>
            <h2>{overview.num_matches}</h2>
          </article>
          <article className="metric-card">
            <p>Brackets</p>
            <h2>{overview.num_brackets}</h2>
          </article>
        </section>
      )}

      {activeTab === "setup" && (
        <section className="stack-lg">
          <article className="panel-card">
            <h2>Add Location</h2>
            <form className="form-grid" onSubmit={handleCreateLocation}>
              <input
                required
                placeholder="Gym Name"
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
              <input
                required
                type="number"
                min={1}
                placeholder="Max Courts"
                value={locationForm.max_courts}
                onChange={(event) =>
                  setLocationForm((prev) => ({
                    ...prev,
                    max_courts: event.target.value,
                  }))
                }
              />
              <button
                className="button"
                type="submit"
                disabled={busyAction === "create-location"}
              >
                {busyAction === "create-location"
                  ? "Saving..."
                  : "Create Location"}
              </button>
            </form>
          </article>

          <article className="panel-card">
            <h2>Add Court</h2>
            <form className="form-grid" onSubmit={handleCreateCourt}>
              <select
                required
                value={courtForm.location_id}
                onChange={(event) =>
                  setCourtForm((prev) => ({
                    ...prev,
                    location_id: event.target.value,
                  }))
                }
              >
                <option value="">Choose location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Court label (Court A)"
                value={courtForm.label}
                onChange={(event) =>
                  setCourtForm((prev) => ({
                    ...prev,
                    label: event.target.value,
                  }))
                }
              />
              <button
                className="button"
                type="submit"
                disabled={busyAction === "create-court"}
              >
                {busyAction === "create-court" ? "Saving..." : "Create Court"}
              </button>
            </form>
          </article>

          <article className="panel-card">
            <h2>Create Team</h2>
            <form className="form-grid" onSubmit={handleCreateTeam}>
              <input
                required
                placeholder="Team name"
                value={teamForm.name}
                onChange={(event) =>
                  setTeamForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <input
                placeholder="Coach name"
                value={teamForm.coach_name}
                onChange={(event) =>
                  setTeamForm((prev) => ({
                    ...prev,
                    coach_name: event.target.value,
                  }))
                }
              />
              <input
                type="email"
                placeholder="Coach email"
                value={teamForm.coach_email}
                onChange={(event) =>
                  setTeamForm((prev) => ({
                    ...prev,
                    coach_email: event.target.value,
                  }))
                }
              />
              <button
                className="button"
                type="submit"
                disabled={busyAction === "create-team"}
              >
                {busyAction === "create-team" ? "Saving..." : "Create Team"}
              </button>
            </form>
          </article>

          <article className="panel-card">
            <h2>Bulk Team Import (JSON)</h2>
            <form className="form-grid" onSubmit={handleBulkCreateTeams}>
              <textarea
                rows={6}
                value={bulkTeamsText}
                onChange={(event) => setBulkTeamsText(event.target.value)}
              />
              <button
                className="button"
                type="submit"
                disabled={busyAction === "bulk-teams"}
              >
                {busyAction === "bulk-teams" ? "Importing..." : "Import Teams"}
              </button>
            </form>
          </article>

          <article className="panel-card">
            <h2>Current Setup</h2>
            <p>
              {locations.length} locations • {teams.length} teams
            </p>
          </article>
        </section>
      )}

      {activeTab === "pool-play" && (
        <section className="stack-lg">
          <article className="panel-card">
            <h2>Auto-Assign Teams to Pools</h2>
            <form className="form-grid" onSubmit={handleAutoAssignPools}>
              <input
                type="number"
                min={1}
                required
                placeholder="Number of pools"
                value={poolAssignForm.num_pools}
                onChange={(event) =>
                  setPoolAssignForm((prev) => ({
                    ...prev,
                    num_pools: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                min={2}
                required
                placeholder="Teams per pool"
                value={poolAssignForm.teams_per_pool}
                onChange={(event) =>
                  setPoolAssignForm((prev) => ({
                    ...prev,
                    teams_per_pool: event.target.value,
                  }))
                }
              />
              <select
                value={poolAssignForm.location_id}
                onChange={(event) =>
                  setPoolAssignForm((prev) => ({
                    ...prev,
                    location_id: event.target.value,
                    court_id: "",
                  }))
                }
              >
                <option value="">No fixed location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <select
                value={poolAssignForm.court_id}
                onChange={(event) =>
                  setPoolAssignForm((prev) => ({
                    ...prev,
                    court_id: event.target.value,
                  }))
                }
              >
                <option value="">No fixed court</option>
                {allCourts
                  .filter(
                    (court) =>
                      !poolAssignForm.location_id ||
                      String(court.locationId) === poolAssignForm.location_id,
                  )
                  .map((court) => (
                    <option key={court.id} value={court.id}>
                      Court {court.label}
                    </option>
                  ))}
              </select>
              <button
                className="button"
                type="submit"
                disabled={busyAction === "auto-assign"}
              >
                {busyAction === "auto-assign"
                  ? "Generating..."
                  : "Generate Pools"}
              </button>
            </form>
          </article>

          {pools.length === 0 ? (
            <article className="panel-card">
              <p>No pools created yet. Generate pools to start score entry.</p>
            </article>
          ) : (
            pools.map((pool) => (
              <article className="panel-card" key={pool.id}>
                <h2>
                  {pool.name} <span className="muted">({pool.status})</span>
                </h2>

                <h3>Standings</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>W-L</th>
                        <th>PF</th>
                        <th>PA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.standings?.map((standing) => (
                        <tr key={`${pool.id}-${standing.team_id}`}>
                          <td>{standing.rank}</td>
                          <td>{standing.team_name}</td>
                          <td>
                            {standing.wins}-{standing.losses}
                          </td>
                          <td>{standing.points_for}</td>
                          <td>{standing.points_against}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3>Matches</h3>
                <div className="stack-md">
                  {pool.matches.map((match) => {
                    const draft =
                      matchScoreDrafts[match.id] || emptyScoreDraft();
                    return (
                      <div className="match-card" key={match.id}>
                        <p>
                          <strong>
                            {teamNameById[match.team1_id] ||
                              `Team ${match.team1_id}`}
                          </strong>{" "}
                          vs{" "}
                          <strong>
                            {teamNameById[match.team2_id] ||
                              `Team ${match.team2_id}`}
                          </strong>
                        </p>
                        <p className="muted">Status: {match.status}</p>

                        <div className="score-grid">
                          <input
                            placeholder="S1 T1"
                            type="number"
                            min={0}
                            value={draft.set1_team1}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set1_team1",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="S1 T2"
                            type="number"
                            min={0}
                            value={draft.set1_team2}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set1_team2",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="S2 T1"
                            type="number"
                            min={0}
                            value={draft.set2_team1}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set2_team1",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="S2 T2"
                            type="number"
                            min={0}
                            value={draft.set2_team2}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set2_team2",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="S3 T1 (opt)"
                            type="number"
                            min={0}
                            value={draft.set3_team1}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set3_team1",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            placeholder="S3 T2 (opt)"
                            type="number"
                            min={0}
                            value={draft.set3_team2}
                            onChange={(event) =>
                              updateMatchScoreDraft(
                                match.id,
                                "set3_team2",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <button
                          className="button"
                          type="button"
                          disabled={busyAction === `submit-score-${match.id}`}
                          onClick={() => {
                            void handleSubmitScore(match.id);
                          }}
                        >
                          {busyAction === `submit-score-${match.id}`
                            ? "Saving..."
                            : "Save Score"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {activeTab === "standings" && (
        <section className="stack-lg">
          {pools.length === 0 ? (
            <article className="panel-card">
              <p>No standings available yet. Generate pools first.</p>
            </article>
          ) : (
            pools.map((pool) => (
              <article key={`standings-${pool.id}`} className="panel-card">
                <h2>{pool.name}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>Points For</th>
                        <th>Points Against</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.standings?.map((standing) => (
                        <tr key={`${pool.id}-public-${standing.team_id}`}>
                          <td>{standing.rank}</td>
                          <td>{standing.team_name}</td>
                          <td>{standing.wins}</td>
                          <td>{standing.losses}</td>
                          <td>{standing.points_for}</td>
                          <td>{standing.points_against}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {activeTab === "brackets" && (
        <section className="panel-card">
          <h2>Brackets</h2>
          <p>
            Bracket UI is staged here for Phase 4. Once backend bracket
            endpoints are exposed, this tab will render generated brackets and
            match trees.
          </p>
          <p>Current bracket count: {overview?.num_brackets ?? 0}</p>
          <Link
            className="button button-secondary"
            to={`/tournaments/${tournamentId}/brackets`}
          >
            Open Bracket Page
          </Link>
        </section>
      )}
    </main>
  );
}
