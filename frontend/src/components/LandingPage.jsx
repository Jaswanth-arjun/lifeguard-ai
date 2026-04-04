import { Link } from "react-router-dom";

const roles = [
  {
    to: "/patient",
    icon: "🫀",
    title: "Patient Device",
    desc: "Real-time vitals simulator with ML-driven risk prediction and emergency response.",
    accent: "var(--neon-cyan)",
  },
  {
    to: "/family",
    icon: "👨‍👩‍👧‍👦",
    title: "Family Tracker",
    desc: "Live GPS location, condition updates, and instant emergency notifications.",
    accent: "var(--neon-purple)",
  },
  {
    to: "/doctor",
    icon: "🏥",
    title: "Hospital Portal",
    desc: "Emergency bay preparation, incoming patient vitals, and triage command center.",
    accent: "var(--success)",
  },
];

export default function LandingPage() {
  return (
    <div className="hero-section">
      <div style={{ animation: "fadeInUp 0.6s ease both" }}>
        <h1 className="hub-title">LIFEGUARD AI</h1>
      </div>

      <p className="hub-subtitle">
        Advanced Real-Time Health Monitoring &amp; AI-Powered Risk Intelligence
      </p>

      <div className="role-grid">
        {roles.map((r, i) => (
          <Link
            key={r.to}
            to={r.to}
            className="card role-card"
            style={{ animationDelay: `${0.4 + i * 0.15}s`, animation: `fadeInUp 0.6s ease ${0.4 + i * 0.15}s both` }}
          >
            <div className="role-icon">{r.icon}</div>
            <h2>{r.title}</h2>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0 0", fontSize: "0.9rem", lineHeight: 1.55 }}>
              {r.desc}
            </p>
            <span
              style={{
                marginTop: "1.25rem",
                fontSize: "0.75rem",
                color: r.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "gap 0.3s ease",
              }}
            >
              Enter Dashboard →
            </span>
          </Link>
        ))}
      </div>

      <div className="powered-badge">
        <span style={{ fontSize: "0.9rem" }}>🧠</span>
        Powered by Scikit-Learn RandomForestClassifier
      </div>
    </div>
  );
}
