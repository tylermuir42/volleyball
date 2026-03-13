import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  TournamentRealtimeEvent,
  useTournamentUpdates,
} from "../lib/useTournamentUpdates";
import { Duty, EnrichedPool, Match, Team, Tournament } from "../types/api";

export default function PublicTournamentPage() {
  const { id } = useParams();
  const tournamentId = Number(id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<EnrichedPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [highlightedMatchIds, setHighlightedMatchIds] = useState<number[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [duties, setDuties] = useState<Duty[]>([]);
  const [dutiesLoading, setDutiesLoading] = useState(false);
  const [dutiesError, setDutiesError] = useState<string | null>(null);
  const [dutiesEndpointUnavailable, setDutiesEndpointUnavailable] =
    useState(false);

  const loadData = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const [tournamentData, teamsData, poolsData] = await Promise.all([
          api.getTournament(tournamentId),
          api.getTeams(tournamentId),
          api.getPools(tournamentId).catch(() => [] as EnrichedPool[]),
        ]);

        setTournament(tournamentData);
        setTeams(teamsData);
        setPools(poolsData);
        setLastUpdatedAt(new Date());

        if (teamsData.length > 0) {
          setSelectedTeamId((prev) => prev || String(teamsData[0].id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data.");
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

    void loadData(true);
  }, [loadData, tournamentId]);

  const handleRealtimeEvent = useCallback((event: TournamentRealtimeEvent) => {
    if (event.type !== "MatchCompleted") {
      return;
    }

    const rawMatchId =
      (event.detail?.matchId as number | string | undefined) ??
      ((event.raw as { matchId?: number | string }).matchId || undefined);

    const matchId = Number(rawMatchId);
    if (!Number.isFinite(matchId)) {
      return;
    }

    setHighlightedMatchIds((prev) =>
      prev.includes(matchId) ? prev : [...prev, matchId],
    );

    window.setTimeout(() => {
      setHighlightedMatchIds((prev) => prev.filter((id) => id !== matchId));
    }, 7000);
  }, []);

  const realtime = useTournamentUpdates({
    tournamentId,
    refresh: () => loadData(false),
    onEvent: handleRealtimeEvent,
  });

  const teamNameById = teams.reduce<Record<number, string>>((acc, team) => {
    acc[team.id] = team.name;
    return acc;
  }, {});

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id) === selectedTeamId) || null,
    [selectedTeamId, teams],
  );

  const matchesForSelectedTeam = useMemo(() => {
    if (!selectedTeam) {
      return [] as Array<Match & { poolName?: string }>;
    }

    const selectedId = selectedTeam.id;
    const result: Array<Match & { poolName?: string }> = [];

    pools.forEach((pool) => {
      pool.matches.forEach((match) => {
        if (match.team1_id === selectedId || match.team2_id === selectedId) {
          result.push({ ...match, poolName: pool.name });
        }
      });
    });

    return result.sort((a, b) => {
      if (a.start_time && b.start_time) {
        return (
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
      }
      if (a.start_time && !b.start_time) {
        return -1;
      }
      if (!a.start_time && b.start_time) {
        return 1;
      }
      return a.id - b.id;
    });
  }, [pools, selectedTeam]);

  const nextMatch = useMemo(() => {
    return (
      matchesForSelectedTeam.find((match) => match.status !== "COMPLETE") ||
      null
    );
  }, [matchesForSelectedTeam]);

  const loadDuties = useCallback(
    async (teamId: number) => {
      setDutiesLoading(true);
      setDutiesError(null);

      try {
        const dutyItems = await api.getTeamDuties(tournamentId, teamId);
        setDuties(dutyItems);
        setDutiesEndpointUnavailable(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message.toLowerCase() : "unknown error";
        if (message.includes("404") || message.includes("not found")) {
          setDuties([]);
          setDutiesEndpointUnavailable(true);
          setDutiesError(null);
        } else {
          setDutiesError(
            err instanceof Error ? err.message : "Failed to load duties.",
          );
        }
      } finally {
        setDutiesLoading(false);
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    const parsedTeamId = Number(selectedTeamId);
    if (!Number.isFinite(parsedTeamId) || parsedTeamId <= 0) {
      setDuties([]);
      return;
    }

    void loadDuties(parsedTeamId);
  }, [loadDuties, selectedTeamId]);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Public View</p>
          <h1>{tournament?.name || "Tournament"}</h1>
          {tournament && (
            <p>
              Status: <strong>{tournament.status}</strong>
            </p>
          )}
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
        <Link
          to={`/tournaments/${tournamentId}`}
          className="button button-secondary"
        >
          Admin View
        </Link>
        <Link
          to={`/tournaments/${tournamentId}/brackets`}
          className="button button-secondary"
        >
          Brackets
        </Link>
      </header>

      {loading && <p>Loading public tournament view…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && pools.length === 0 && (
        <section className="panel-card">
          <p>No pool data available yet. Check back after pool setup begins.</p>
        </section>
      )}

      <section className="stack-lg">
        <article className="panel-card">
          <h2>Coach View</h2>
          <div className="form-grid">
            <label htmlFor="team-select">Select team</label>
            <select
              id="team-select"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
            >
              {teams.length === 0 && (
                <option value="">No teams available</option>
              )}
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </article>

        <article className="panel-card">
          <h3>Team&apos;s Next Match</h3>
          {!selectedTeam && (
            <p className="muted">Select a team to view next match.</p>
          )}
          {selectedTeam && !nextMatch && (
            <p className="muted">No upcoming match found for this team.</p>
          )}
          {selectedTeam && nextMatch && (
            <div className="match-card">
              <p>
                <strong>
                  {teamNameById[nextMatch.team1_id] ||
                    `Team ${nextMatch.team1_id}`}
                </strong>{" "}
                vs{" "}
                <strong>
                  {teamNameById[nextMatch.team2_id] ||
                    `Team ${nextMatch.team2_id}`}
                </strong>
              </p>
              <p className="muted">Status: {nextMatch.status}</p>
              {nextMatch.poolName && (
                <p className="muted">Pool: {nextMatch.poolName}</p>
              )}
              {nextMatch.start_time && (
                <p className="muted">
                  Start: {new Date(nextMatch.start_time).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </article>

        <article className="panel-card">
          <h3>My Duties</h3>
          {dutiesLoading && <p>Loading duties…</p>}
          {dutiesError && <p className="error-text">{dutiesError}</p>}
          {dutiesEndpointUnavailable && (
            <p className="muted">
              Duties endpoint is not available yet. This section will populate
              when `/tournaments/:id/teams/:teamId/duties` is implemented.
            </p>
          )}
          {!dutiesLoading &&
            !dutiesError &&
            !dutiesEndpointUnavailable &&
            duties.length === 0 && (
              <p className="muted">No duties assigned for this team.</p>
            )}
          {!dutiesLoading && duties.length > 0 && (
            <ul className="clean-list">
              {duties.map((duty) => (
                <li key={duty.id} className="match-row">
                  <span>
                    {duty.role} • Match {duty.match_id}
                    {duty.location_name && ` • ${duty.location_name}`}
                    {duty.court_label && ` • ${duty.court_label}`}
                  </span>
                  <strong>{duty.status}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="stack-lg">
        {pools.map((pool) => (
          <article key={pool.id} className="panel-card">
            <h2>{pool.name}</h2>

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

            <h3>Match Schedule</h3>
            <ul className="clean-list">
              {pool.matches.map((match) => (
                <li
                  key={match.id}
                  className={`match-row ${
                    highlightedMatchIds.includes(match.id)
                      ? "match-row-highlight"
                      : ""
                  }`}
                >
                  <span>
                    {teamNameById[match.team1_id] || `Team ${match.team1_id}`}{" "}
                    vs{" "}
                    {teamNameById[match.team2_id] || `Team ${match.team2_id}`}
                  </span>
                  <strong>{match.status}</strong>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
