import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Tournament } from "../types/api";

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newTournament, setNewTournament] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
  });

  async function fetchTournaments() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTournaments();
      setTournaments(data);
    } catch (err) {
      console.error(err);
      setError("Could not load tournaments yet. Backend may not be ready.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTournaments();
  }, []);

  async function handleCreateTournament(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    try {
      await api.createTournament(newTournament);
      setStatusMessage("Tournament created.");
      setNewTournament({
        name: "",
        date: new Date().toISOString().split("T")[0],
      });
      await fetchTournaments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create tournament.",
      );
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>Southern LA Volleyball Tournaments</h1>
        <p>
          Real-time pools, brackets, and locations across Southern California.
        </p>
      </header>

      {loading && <p>Loading tournaments…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {statusMessage && <p className="success-text">{statusMessage}</p>}

      <section className="panel-card">
        <h2>Create Tournament</h2>
        <form className="form-grid" onSubmit={handleCreateTournament}>
          <input
            required
            placeholder="Tournament name"
            value={newTournament.name}
            onChange={(event) =>
              setNewTournament((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />
          <input
            required
            type="date"
            value={newTournament.date}
            onChange={(event) =>
              setNewTournament((prev) => ({
                ...prev,
                date: event.target.value,
              }))
            }
          />
          <button className="button" type="submit">
            Create
          </button>
        </form>
      </section>

      {!loading && !error && tournaments.length === 0 && (
        <p>No tournaments loaded yet. Create one via the backend API.</p>
      )}

      {tournaments.length > 0 && (
        <section>
          <h2>Upcoming Tournaments</h2>
          <ul className="tournament-list">
            {tournaments.map((t) => (
              <li key={t.id} className="tournament-card">
                <h3>{t.name}</h3>
                <p>
                  Status: <strong>{t.status}</strong>
                </p>
                {t.date && <p>Date: {new Date(t.date).toLocaleDateString()}</p>}
                <div className="button-row">
                  <Link
                    to={`/tournaments/${t.id}`}
                    className="button button-secondary"
                  >
                    Admin
                  </Link>
                  <Link
                    to={`/public/tournaments/${t.id}`}
                    className="button button-secondary"
                  >
                    Public
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
