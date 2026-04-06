import { useHealth } from "../context/HealthContext.jsx";

export default function DoctorConsole() {
  const { vitals, prediction, location, emergencyActive } = useHealth();
  const lat = location.latitude;
  const lng = location.longitude;

  return (
    <div className="page-enter">
      <header style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Hospital Operations Center</h1>
          <span className={`status-dot ${emergencyActive ? "danger" : ""}`} />
          <span style={{ fontSize: "0.78rem", color: emergencyActive ? "var(--danger)" : "var(--muted)" }}>
            {emergencyActive ? "EMERGENCY ACTIVE" : "Standby"}
          </span>
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          Simulated triage view — incoming emergency flag, vitals for prep, and patient coordinates.
        </p>
      </header>

      <div className="card">
        <div className="section-header">
          <span className="icon">🚨</span>
          Incoming Patient
        </div>

        {emergencyActive ? (
          <div className="emergency-banner">
            <strong style={{ color: "var(--danger)", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              ⚠ Emergency — Patient Inbound
            </strong>
            <p style={{ margin: "0.6rem 0 0", lineHeight: 1.6 }}>
              Prepare resuscitation bay and oxygen. Model category:{" "}
              <strong style={{ color: "var(--text-bright)" }}>{prediction?.category}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>(score {prediction?.risk_score})</span>
            </p>
          </div>
        ) : (
          <div style={{
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border)",
            marginBottom: "1rem",
            textAlign: "center",
            color: "var(--muted)",
          }}>
            <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.5rem", opacity: 0.5 }}>🛡️</span>
            No active emergency alert — systems nominal. Monitoring active patient vitals.
          </div>
        )}

        <table className="data-table">
          <tbody>
            <tr>
              <td>Heart Rate</td>
              <td style={{ color: vitals.heart_rate > 120 ? "var(--danger)" : "var(--text-bright)" }}>
                {vitals.heart_rate} <span style={{ color: "var(--muted)", fontWeight: 400 }}>bpm</span>
              </td>
            </tr>
            <tr>
              <td>SpO₂</td>
              <td style={{ color: vitals.spo2 < 90 ? "var(--danger)" : "var(--text-bright)" }}>
                {vitals.spo2}<span style={{ color: "var(--muted)", fontWeight: 400 }}>%</span>
              </td>
            </tr>
            <tr>
              <td>Temperature</td>
              <td style={{ color: vitals.temperature_c > 38.5 ? "var(--danger)" : "var(--text-bright)" }}>
                {vitals.temperature_c} <span style={{ color: "var(--muted)", fontWeight: 400 }}>°C</span>
              </td>
            </tr>
            <tr>
              <td>Risk Assessment</td>
              <td>
                {prediction ? (
                  <span className={`badge ${prediction.category === "High Risk" ? "danger" : prediction.category === "Warning" ? "warning" : "success"}`}>
                    {prediction.category} — {prediction.risk_score}
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Awaiting data…</span>
                )}
              </td>
            </tr>
            <tr>
              <td>GPS Coordinates</td>
              <td>
                {lat != null && lng != null
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--muted-dim)" }}>
          Open DevTools → Console to see structured alert payloads logged as{" "}
          <code style={{ color: "var(--neon-cyan)", fontSize: "0.75rem" }}>[EMERGENCY — Doctor/Hospital]</code>.
        </p>
      </div>
    </div>
  );
}
