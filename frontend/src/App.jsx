import { useEffect } from "react";
import { useHealth } from "./context/HealthContext.jsx";
import PatientDashboard from "./components/PatientDashboard.jsx";
import FamilyTracker from "./components/FamilyTracker.jsx";
import DoctorConsole from "./components/DoctorConsole.jsx";
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
          <strong>{t.title}</strong>
          <div style={{ marginTop: "0.25rem", fontSize: "0.88rem" }}>{t.body}</div>
        </div>
      ))}
    </div>
  );
}

/** Supports shared links like http://localhost:5173/#family */
function HashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "family") navigate("/family", { replace: true });
    else if (hash === "doctor") navigate("/doctor", { replace: true });
    else if (hash === "patient") navigate("/patient", { replace: true });
  }, [navigate]);
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "family") navigate("/family", { replace: true });
      else if (hash === "doctor") navigate("/doctor", { replace: true });
      else if (hash === "patient") navigate("/patient", { replace: true });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [navigate]);
  return null;
}

function Nav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="tabs" aria-label="Views">
      <Link to="/patient" style={{textDecoration:'none'}}>
        <button type="button" className={path === "/patient" || path === "/" ? "active" : ""}>
          Patient dashboard
        </button>
      </Link>
      <Link to="/family" style={{textDecoration:'none'}}>
        <button type="button" className={path === "/family" ? "active" : ""}>
          Family tracker
        </button>
      </Link>
      <Link to="/doctor" style={{textDecoration:'none'}}>
        <button type="button" className={path === "/doctor" ? "active" : ""}>
          Doctor / hospital
        </button>
      </Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <HashRedirect />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.25rem 1rem 2.5rem" }}>
        <ToastStack />
        <div style={{ marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--muted)" }}>
          AI Health Risk Prediction & Emergency Response — prototype
        </div>
        <Nav />
        <Routes>
          <Route path="/" element={<PatientDashboard />} />
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/family" element={<FamilyTracker />} />
          <Route path="/doctor" element={<DoctorConsole />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
