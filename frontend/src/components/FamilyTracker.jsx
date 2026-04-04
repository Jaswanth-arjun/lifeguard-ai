import { useHealth } from "../context/HealthContext.jsx";
import PatientMap from "./PatientMap.jsx";

export default function FamilyTracker() {
  const { vitals, prediction, location, hospital, routeCoords, emergencyActive } = useHealth();
  const lat = location.latitude;
  const lng = location.longitude;

  return (
    <div>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem" }}>Family tracker</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
          Simulated caregiver view: live location, last vitals, and route when an emergency is active.
          Notifications also appear as toasts and in the browser console.
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Patient status</h2>
        <p style={{ margin: 0, fontSize: "0.95rem" }}>
          <strong>Vitals:</strong> HR {vitals.heart_rate} bpm · SpO₂ {vitals.spo2}% ·{" "}
          {vitals.temperature_c}°C
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.95rem" }}>
          <strong>Risk:</strong>{" "}
          {prediction
            ? `${prediction.category} (score ${prediction.risk_score})`
            : "—"}
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.95rem" }}>
          <strong>Live location:</strong>{" "}
          {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Waiting for GPS…"}
        </p>
        {emergencyActive && (
          <p style={{ margin: "0.75rem 0 0", color: "var(--danger)", fontWeight: 600 }}>
            Emergency active — monitor map below.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Live map</h2>
        <PatientMap
          className="tall"
          patientLat={lat}
          patientLng={lng}
          hospital={hospital}
          routeCoords={routeCoords}
        />
      </div>
    </div>
  );
}
