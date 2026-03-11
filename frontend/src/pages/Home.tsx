import { useEffect, useState } from "react";

type Tournament = {
  id: number;
  name: string;
  date: string | null;
  status: string;
};

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTournaments() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          import.meta.env.VITE_API_BASE_URL + "/tournaments",
        );
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        setTournaments(data);
      } catch (err) {
        console.error(err);
        setError("Could not load tournaments yet. Backend may not be ready.");
      } finally {
        setLoading(false);
      }
    }

    if (import.meta.env.VITE_API_BASE_URL) {
      fetchTournaments();
    }
  }, []);

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
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
