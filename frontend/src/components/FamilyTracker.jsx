import { useHealth } from "../context/HealthContext.jsx";
import PatientMap from "./PatientMap.jsx";

export default function FamilyTracker() {
  const { vitals, prediction, location, hospital, routeCoords, emergencyActive, patientRecordId, authReady } = useHealth();
  const lat = location.latitude;
  const lng = location.longitude;

  const cat = prediction?.category;

  if (!authReady) {
    return (
      <div className="page-enter" style={{ textAlign: "center", marginTop: "4rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
        <p style={{ color: "var(--muted)" }}>Loading your dashboard...</p>
      </div>
    );
  }

  if (!patientRecordId) {
    return (
      <div className="page-enter">
        <header style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Family Tracker</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
            Live caregiver view
          </p>
        </header>

        <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>🔗</span>
          <h2 style={{ margin: "0 0 0.5rem" }}>No Patient Linked</h2>
          <p style={{ color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            You have not been linked to a patient yet.<br />
            The patient must go to their dashboard and authorize your account
            under <strong style={{ color: "var(--neon-cyan)" }}>"Manage Permissions"</strong> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <header style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Family Tracker</h1>
          <span className={`status-dot ${emergencyActive ? "danger" : ""}`} />
          <span style={{ fontSize: "0.78rem", color: emergencyActive ? "var(--danger)" : "var(--success)" }}>
            {emergencyActive ? "EMERGENCY" : "Connected · Live"}
          </span>
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          Live caregiver view — patient location, last vitals, and hospital route during emergencies.
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-header">
          <span className="icon">💓</span>
          Patient Status
        </div>

        {emergencyActive && (
          <div className="emergency-banner" style={{ marginBottom: "1rem" }}>
            <strong style={{ color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              ⚠ Emergency Active
            </strong>
            <span style={{ color: "var(--muted)", fontSize: "0.88rem", marginLeft: "0.5rem" }}>
              — Monitor live map below for real-time tracking
            </span>
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginTop: "0.5rem",
        }}>
          {/* Vitals */}
          <div style={{
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
              Vitals (Live)
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.88rem", lineHeight: 1.8 }}>
              <div>
                <span style={{ color: "var(--muted)" }}>HR </span>
                <span style={{ color: vitals.heart_rate > 120 ? "var(--danger)" : "var(--text-bright)", fontWeight: 600 }}>{vitals.heart_rate}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}> bpm</span>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>SpO₂ </span>
                <span style={{ color: vitals.spo2 < 90 ? "var(--danger)" : "var(--text-bright)", fontWeight: 600 }}>{vitals.spo2}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>%</span>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Temp </span>
                <span style={{ color: vitals.temperature_c > 38.5 ? "var(--danger)" : "var(--text-bright)", fontWeight: 600 }}>{vitals.temperature_c}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>°C</span>
              </div>
            </div>
          </div>

          {/* Risk */}
          <div style={{
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
              Risk Assessment
            </div>
            {prediction ? (
              <div>
                <span className={`badge ${cat === "High Risk" ? "danger" : cat === "Warning" ? "warning" : "success"}`} style={{ fontSize: "0.8rem" }}>
                  {cat}
                </span>
                <div style={{ marginTop: "0.5rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.88rem" }}>
                  <span style={{ color: "var(--muted)" }}>Score </span>
                  <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{prediction.risk_score}</span>
                  <span style={{ color: "var(--muted)" }}> / 100</span>
                </div>
              </div>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>Awaiting live data…</span>
            )}
          </div>

          {/* Location */}
          <div style={{
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
              Live Location
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", color: "var(--text-bright)" }}>
              {emergencyActive ? (
                lat != null && lng != null ? (
                  <>
                    <div>{lat.toFixed(5)},</div>
                    <div>{lng.toFixed(5)}</div>
                  </>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Waiting for GPS…</span>
                )
              ) : (
                <span style={{ color: "var(--muted)" }}>Hidden (Privacy Mode)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {emergencyActive ? (
        <div className="card">
          <div className="section-header">
            <span className="icon">🗺️</span>
            Emergency Route
          </div>
          <PatientMap
            className="tall"
            patientLat={lat}
            patientLng={lng}
            hospital={hospital}
            routeCoords={routeCoords}
          />
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
          <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem", opacity: 0.5 }}>🛡️</span>
          Location sharing is disabled for privacy until an emergency alert is triggered.
        </div>
      )}
    </div>
  );
}
