import { useHealth } from "../context/HealthContext.jsx";

export default function DoctorConsole() {
  const { vitals, prediction, location, emergencyActive } = useHealth();
  const lat = location.latitude;
  const lng = location.longitude;

  return (
    <div>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem" }}>Hospital / doctor console</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
          Simulated triage view: incoming emergency flag, vitals for prep, and patient coordinates.
          Alerts are duplicated in toasts and console logs.
        </p>
      </header>

      <div className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Incoming patient</h2>
        {emergencyActive ? (
          <div
            style={{
              padding: "1rem",
              borderRadius: "12px",
              background: "rgba(245, 93, 93, 0.12)",
              border: "1px solid var(--danger)",
              marginBottom: "1rem",
            }}
          >
            <strong style={{ color: "var(--danger)" }}>EMERGENCY — PATIENT INBOUND</strong>
            <p style={{ margin: "0.5rem 0 0" }}>
              Prepare resuscitation bay and oxygen. Model category:{" "}
              <strong>{prediction?.category}</strong> (score {prediction?.risk_score}).
            </p>
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>No active emergency alert.</p>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0", color: "var(--muted)" }}>Heart rate</td>
              <td style={{ padding: "0.5rem 0", fontWeight: 600 }}>{vitals.heart_rate} bpm</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0", color: "var(--muted)" }}>SpO₂</td>
              <td style={{ padding: "0.5rem 0", fontWeight: 600 }}>{vitals.spo2}%</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0", color: "var(--muted)" }}>Temperature</td>
              <td style={{ padding: "0.5rem 0", fontWeight: 600 }}>{vitals.temperature_c} °C</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0", color: "var(--muted)" }}>ETA reference</td>
              <td style={{ padding: "0.5rem 0", fontWeight: 600 }}>
                Live GPS: {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
          Open DevTools → Console to see structured alert payloads logged as{" "}
          <code>[EMERGENCY — Doctor/Hospital]</code>.
        </p>
      </div>
    </div>
  );
}
