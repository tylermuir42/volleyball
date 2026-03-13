import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useTournamentUpdates } from "../lib/useTournamentUpdates";
import { BracketDetail, Match, Team, Tournament } from "../types/api";

type BracketRound = {
  name: string;
  matches: Array<{
    id: string;
    team1Id?: number;
    team2Id?: number;
    winnerId?: number;
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETE";
  }>;
};

function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const msg = err.message.toLowerCase();
  return msg.includes("404") || msg.includes("not found");
}

function mapMatches(matches: Match[]): BracketRound["matches"] {
  return matches.map((match) => ({
    id: `M${match.id}`,
    team1Id: match.team1_id,
    team2Id: match.team2_id,
    winnerId: match.winner_team_id || undefined,
    status: match.status,
  }));
}

function buildLiveRounds(detail: BracketDetail): BracketRound[] {
  const matches = [...(detail.matches || [])].sort((a, b) => a.id - b.id);

  if (matches.length === 0) {
    return [
      {
        name: "Matches",
        matches: [{ id: "TBD", status: "SCHEDULED" }],
      },
    ];
  }

  if (matches.length === 7) {
    return [
      {
        name: "Quarterfinals",
        matches: mapMatches(matches.slice(0, 4)),
      },
      {
        name: "Semifinals",
        matches: mapMatches(matches.slice(4, 6)),
      },
      {
        name: "Final",
        matches: mapMatches(matches.slice(6)),
      },
    ];
  }

  if (matches.length === 3) {
    return [
      {
        name: "Semifinals",
        matches: mapMatches(matches.slice(0, 2)),
      },
      {
        name: "Final",
        matches: mapMatches(matches.slice(2)),
      },
    ];
  }

  if (matches.length === 1) {
    return [
      {
        name: "Final",
        matches: mapMatches(matches),
      },
    ];
  }

  return [
    {
      name: "Bracket Matches",
      matches: mapMatches(matches),
    },
  ];
}

function buildPlaceholderRounds(teamIds: number[]): BracketRound[] {
  const [a, b, c, d, e, f, g, h] = teamIds;

  return [
    {
      name: "Quarterfinals",
      matches: [
        { id: "QF1", team1Id: a, team2Id: h, status: "SCHEDULED" },
        { id: "QF2", team1Id: d, team2Id: e, status: "SCHEDULED" },
        { id: "QF3", team1Id: b, team2Id: g, status: "SCHEDULED" },
        { id: "QF4", team1Id: c, team2Id: f, status: "SCHEDULED" },
      ],
    },
    {
      name: "Semifinals",
      matches: [
        { id: "SF1", status: "SCHEDULED" },
        { id: "SF2", status: "SCHEDULED" },
      ],
    },
    {
      name: "Final",
      matches: [{ id: "F1", status: "SCHEDULED" }],
    },
  ];
}

export default function BracketsPage() {
  const { id } = useParams();
  const tournamentId = Number(id);
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [liveBrackets, setLiveBrackets] = useState<BracketDetail[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [bracketEndpointStatus, setBracketEndpointStatus] = useState<
    "checking" | "available" | "missing" | "error"
  >("checking");

  const loadData = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const [tournamentData, teamsData] = await Promise.all([
          api.getTournament(tournamentId),
          api.getTeams(tournamentId),
        ]);

        setTournament(tournamentData);
        setTeams(teamsData);

        if (teamsData.length > 0) {
          setSelectedTeamId((prev) => prev || String(teamsData[0].id));
        }

        try {
          setBracketEndpointStatus("checking");
          const bracketSummaries = await api.getBrackets(tournamentId);
          if (bracketSummaries.length > 0) {
            const details = await Promise.all(
              bracketSummaries.map((bracket) =>
                api.getBracketById(tournamentId, bracket.id).catch(() => ({
                  bracket,
                  slots: [],
                  matches: [],
                })),
              ),
            );
            setLiveBrackets(details);
            setDataSource("live");
            setBracketEndpointStatus("available");
          } else {
            setLiveBrackets([]);
            setDataSource("fallback");
            setBracketEndpointStatus("available");
          }
        } catch (bracketErr) {
          if (isNotFoundError(bracketErr)) {
            setLiveBrackets([]);
            setDataSource("fallback");
            setBracketEndpointStatus("missing");
          } else {
            setLiveBrackets([]);
            setDataSource("fallback");
            setBracketEndpointStatus("error");
          }
        }

        setLastUpdatedAt(new Date());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load bracket data.",
        );
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

  const teamNameById = useMemo(() => {
    return teams.reduce<Record<number, string>>((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
  }, [teams]);

  const seededTeamIds = useMemo(
    () => teams.slice(0, 8).map((team) => team.id),
    [teams],
  );

  const fallbackRounds = useMemo(
    () => buildPlaceholderRounds(seededTeamIds),
    [seededTeamIds],
  );

  const liveBracketCards = useMemo(() => {
    return liveBrackets.map((detail) => ({
      key: String(detail.bracket.id),
      title: detail.bracket.name,
      rounds: buildLiveRounds(detail),
    }));
  }, [liveBrackets]);

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id) === selectedTeamId) || null,
    [selectedTeamId, teams],
  );

  const renderBracketTree = (
    rounds: BracketRound[],
    keyPrefix: string,
  ): JSX.Element => {
    return (
      <div className="bracket-tree">
        {rounds.map((round) => (
          <div
            className="bracket-round-column"
            key={`${keyPrefix}-${round.name}`}
          >
            <p className="bracket-round-title">{round.name}</p>
            <div className="stack-md">
              {round.matches.map((match) => (
                <div
                  className={`bracket-match-card ${
                    selectedTeam &&
                    (match.team1Id === selectedTeam.id ||
                      match.team2Id === selectedTeam.id)
                      ? "bracket-match-card-selected"
                      : ""
                  }`}
                  key={`${keyPrefix}-${match.id}`}
                >
                  <p className="muted">{match.id}</p>
                  <p
                    className={`bracket-team-row ${
                      match.winnerId && match.team1Id === match.winnerId
                        ? "bracket-team-winner"
                        : match.winnerId && match.team1Id
                          ? "bracket-team-loser"
                          : ""
                    }`}
                  >
                    {match.team1Id ? teamNameById[match.team1Id] : "TBD"}
                  </p>
                  <p
                    className={`bracket-team-row ${
                      match.winnerId && match.team2Id === match.winnerId
                        ? "bracket-team-winner"
                        : match.winnerId && match.team2Id
                          ? "bracket-team-loser"
                          : ""
                    }`}
                  >
                    {match.team2Id ? teamNameById[match.team2Id] : "TBD"}
                  </p>
                  <p className="muted">Status: {match.status}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Bracket View</p>
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

        <div className="header-actions">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="button button-secondary"
          >
            Admin View
          </Link>
          <Link
            to={`/public/tournaments/${tournamentId}`}
            className="button button-secondary"
          >
            Public View
          </Link>
        </div>
      </header>

      {loading && <p>Loading brackets…</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="panel-card">
        <h2>Bracket Readiness</h2>
        {dataSource === "live" ? (
          <>
            <p>Live bracket endpoints detected and connected.</p>
            <p className="muted">
              Rendering backend bracket data with realtime refresh enabled.
            </p>
          </>
        ) : (
          <>
            <p>
              Using fallback scaffolded bracket (8-team seed preview) until
              backend bracket endpoints are available.
            </p>
            <p className="muted">
              The page auto-switches to live mode as soon as the endpoints are
              exposed.
            </p>
          </>
        )}
      </section>

      <section className="panel-card">
        <h2>Endpoint Diagnostics</h2>
        <ul className="clean-list">
          <li className="match-row">
            <span>API Base URL</span>
            <strong className="diagnostic-value">{apiBaseUrl}</strong>
          </li>
          <li className="match-row">
            <span>WebSocket URL</span>
            <strong className="diagnostic-value">
              {wsUrl || "Not configured"}
            </strong>
          </li>
          <li className="match-row">
            <span>Bracket Endpoints</span>
            <strong>
              {bracketEndpointStatus === "checking" && "Checking..."}
              {bracketEndpointStatus === "available" && "Available"}
              {bracketEndpointStatus === "missing" && "Missing (404)"}
              {bracketEndpointStatus === "error" && "Error"}
            </strong>
          </li>
        </ul>
      </section>

      <section className="panel-card">
        <h2>Team Path Highlight</h2>
        <div className="form-grid">
          <label htmlFor="bracket-team-select">Select team</label>
          <select
            id="bracket-team-select"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            {teams.length === 0 && <option value="">No teams available</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <p className="muted">
            {selectedTeam
              ? `Highlighting path for ${selectedTeam.name}`
              : "Select a team to highlight its bracket path."}
          </p>
          <div className="bracket-legend">
            <span className="bracket-legend-item">
              <span className="bracket-legend-swatch bracket-legend-swatch-selected" />
              Selected team path
            </span>
            <span className="bracket-legend-item">
              <span className="bracket-legend-swatch bracket-legend-swatch-winner" />
              Match winner
            </span>
            <span className="bracket-legend-item">
              <span className="bracket-legend-swatch bracket-legend-swatch-default" />
              Other teams
            </span>
          </div>
        </div>
      </section>

      {teams.length < 4 ? (
        <section className="panel-card">
          <p>Add at least 4 teams to preview the bracket scaffold.</p>
        </section>
      ) : (
        <section className="bracket-grid">
          {dataSource === "live"
            ? liveBracketCards.map((card) => (
                <article className="panel-card" key={card.key}>
                  <h3>{card.title}</h3>
                  {renderBracketTree(card.rounds, card.key)}
                </article>
              ))
            : [
                <article className="panel-card" key="fallback-bracket-preview">
                  <h3>Bracket Preview</h3>
                  {renderBracketTree(fallbackRounds, "fallback")}
                </article>,
              ]}
        </section>
      )}
    </main>
  );
}
