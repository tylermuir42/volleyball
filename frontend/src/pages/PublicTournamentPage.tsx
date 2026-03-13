import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useTournamentUpdates } from "../lib/useTournamentUpdates";
import { EnrichedPool, Team, Tournament } from "../types/api";

export default function PublicTournamentPage() {
  const { id } = useParams();
  const tournamentId = Number(id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<EnrichedPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

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

  const realtime = useTournamentUpdates({
    tournamentId,
    refresh: () => loadData(false),
  });

  const teamNameById = teams.reduce<Record<number, string>>((acc, team) => {
    acc[team.id] = team.name;
    return acc;
  }, {});

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
                <li key={match.id} className="match-row">
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
