import { useEffect } from "react";
import { useHealth } from "./context/HealthContext.jsx";
import LandingPage from "./components/LandingPage.jsx";
import PatientDashboard from "./components/PatientDashboard.jsx";
import FamilyTracker from "./components/FamilyTracker.jsx";
import DoctorConsole from "./components/DoctorConsole.jsx";
import ParticleBackground from "./components/ParticleBackground.jsx";
import { NotificationService } from "./utils/notificationService.js";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

function ToastStack() {
  const { toasts } = useHealth();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.role === "patient" ? "" : t.role}`}>
          <strong style={{ color: t.role === "doctor" ? "var(--warn)" : "var(--neon-cyan)", fontSize: "0.82rem" }}>
            {t.title}
          </strong>
          <div style={{ marginTop: "0.3rem", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {t.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function HashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "family") navigate("/family", { replace: true });
    else if (hash === "doctor") navigate("/doctor", { replace: true });
    else if (hash === "patient") navigate("/patient", { replace: true });
  }, [navigate]);
  return null;
}

const PAGE_NAMES = {
  "/patient": "Patient Device",
  "/family": "Family Tracker",
  "/doctor": "Hospital Portal",
};

function GlobalHeader() {
  const location = useLocation();
  const { emergencyActive } = useHealth();
  if (location.pathname === "/") return null;

  const pageName = PAGE_NAMES[location.pathname] || "Dashboard";

  return (
    <div className="glass-nav">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className="nav-brand">Lifeguard AI</span>
        <span style={{ color: "var(--muted-dim)", fontSize: "0.75rem" }}>›</span>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 500 }}>{pageName}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div className="nav-status">
          <span className={`status-dot ${emergencyActive ? "danger" : ""}`} />
          <span>{emergencyActive ? "EMERGENCY" : "Active Session"}</span>
        </div>
        <Link to="/" style={{ textDecoration: "none" }}>
          <button type="button" className="secondary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.75rem" }}>
            ← Hub
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Request notification permissions on mount
    NotificationService.requestPermissions();
  }, []);

  return (
    <BrowserRouter>
      <HashRedirect />
      <ParticleBackground />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.25rem 1rem 2.5rem", position: "relative", zIndex: 1 }}>
        <ToastStack />
        <GlobalHeader />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/family" element={<FamilyTracker />} />
          <Route path="/doctor" element={<DoctorConsole />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
