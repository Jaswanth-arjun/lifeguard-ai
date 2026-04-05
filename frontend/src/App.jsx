import { useEffect, useState } from "react";
import { useHealth } from "./context/HealthContext.jsx";
import Auth from "./components/Auth.jsx";
import PatientDashboard from "./components/PatientDashboard.jsx";
import FamilyTracker from "./components/FamilyTracker.jsx";
import DoctorConsole from "./components/DoctorConsole.jsx";
import ParticleBackground from "./components/ParticleBackground.jsx";
import { NotificationService } from "./utils/notificationService.js";
import { supabase } from "./supabaseClient.js";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate
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

const PAGE_NAMES = {
  "/patient": "Patient Device",
  "/family": "Family Tracker",
  "/doctor": "Hospital Portal",
};

function GlobalHeader({ session }) {
  const location = useLocation();
  const { emergencyActive } = useHealth();
  const navigate = useNavigate();

  if (location.pathname === "/") return null;

  const pageName = PAGE_NAMES[location.pathname] || "Dashboard";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

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
        {session && (
          <button type="button" onClick={handleLogout} className="secondary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.75rem" }}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ session, allowedRole, children }) {
  const [profileRole, setProfileRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    
    // Fetch user role
    const getRole = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
        
      if (!error && data) {
        setProfileRole(data.role);
      }
      setLoading(false);
    };
    
    getRole();
  }, [session]);

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "4rem" }}>Verifying access...</div>;
  }

  if (allowedRole && profileRole !== allowedRole) {
    // Redirect them to their actual dashboard if they try to access another
    return <Navigate to={`/${profileRole}`} replace />;
  }

  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    NotificationService.requestPermissions();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return null; // or a tiny spinner
  }

  return (
    <HashRouter>
      <ParticleBackground />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.25rem 1rem 2.5rem", position: "relative", zIndex: 1 }}>
        <ToastStack />
        <GlobalHeader session={session} />
        <Routes>
          <Route path="/" element={session ? <Navigate to="/patient" /> : <Auth />} />
          
          <Route path="/patient" element={
            <ProtectedRoute session={session} allowedRole="patient">
              <PatientDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/family" element={
            <ProtectedRoute session={session} allowedRole="family">
              <FamilyTracker />
            </ProtectedRoute>
          } />

          <Route path="/doctor" element={
            <ProtectedRoute session={session} allowedRole="doctor">
              <DoctorConsole />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </HashRouter>
  );
}
