import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TournamentPage from "./pages/TournamentPage";
import PublicTournamentPage from "./pages/PublicTournamentPage";
import BracketsPage from "./pages/BracketsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tournaments/:id" element={<TournamentPage />} />
      <Route
        path="/public/tournaments/:id"
        element={<PublicTournamentPage />}
      />
      <Route path="/tournaments/:id/brackets" element={<BracketsPage />} />
    </Routes>
  );
}
