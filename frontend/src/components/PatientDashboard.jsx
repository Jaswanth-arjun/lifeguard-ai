import { useHealth } from "../context/HealthContext.jsx";
import PatientMap from "./PatientMap.jsx";
import VitalsChart from "./VitalsChart.jsx";
import {
  buildFamilyEmergencyMessage,
  digitsOnlyPhone,
  getFamilyTrackerUrl,
  getSmsUri,
} from "../utils/familyNotify.js";

function riskColor(category) {
  if (category === "High Risk") return "var(--danger)";
  if (category === "Warning") return "var(--warn)";
  return "var(--success)";
}

export default function PatientDashboard() {
  const {
    vitals,
    prediction,
    location,
    hospital,
    routeCoords,
    patientModalOpen,
    setPatientModalOpen,
    hrHistory,
    riskHistory,
    lastError,
    familyPhone,
    setFamilyPhone,
    simulateEmergency,
    resumeSimulation,
  } = useHealth();

  const lat = location.latitude;
  const lng = location.longitude;
  const trackerUrl = getFamilyTrackerUrl();
  const phoneDigits = digitsOnlyPhone(familyPhone);
  const familyMsgForModal =
    prediction && lat != null && lng != null
      ? buildFamilyEmergencyMessage({
          vitals,
          pred: prediction,
          lat,
          lng,
          trackerUrl,
        })
      : null;
  const smsUri =
    phoneDigits.length >= 10 && familyMsgForModal
      ? getSmsUri(phoneDigits, familyMsgForModal)
      : null;

  return (
    <div>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem" }}>
          Patient monitoring
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
          Simulated wearable vitals update every few seconds. ML risk runs on the Flask backend
          (scikit-learn).
        </p>
      </header>

      {lastError && (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: "1rem" }}>
          <strong>API error:</strong> {lastError}. Is the backend running on port 5000?
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div className="card">
          <div className="stat-label">Heart rate</div>
          <div className="stat-value">{vitals.heart_rate} <small>bpm</small></div>
        </div>
        <div className="card">
          <div className="stat-label">SpO₂</div>
          <div className="stat-value">{vitals.spo2} <small>%</small></div>
        </div>
        <div className="card">
          <div className="stat-label">Body temperature</div>
          <div className="stat-value">{vitals.temperature_c} <small>°C</small></div>
        </div>
        <div className="card" style={{ borderColor: prediction ? riskColor(prediction.category) : undefined }}>
          <div className="stat-label">AI risk score</div>
          <div className="stat-value" style={{ color: prediction ? riskColor(prediction.category) : undefined }}>
            {prediction ? prediction.risk_score : "—"}
            <small> / 100</small>
          </div>
          <div style={{ marginTop: "0.35rem", fontWeight: 600, color: "var(--muted)" }}>
            {prediction?.category ?? "Waiting for prediction…"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Family emergency contact</h2>
        <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Enter the family WhatsApp number in <strong>international format</strong> (with country code). On{" "}
          <strong>Simulate emergency</strong>, the <strong>server sends WhatsApp automatically</strong> (Twilio or
          Meta Cloud API — no opening WhatsApp on this device). Configure env vars per{" "}
          <code>backend/WHATSAPP_SETUP.txt</code>. Family tracker link in the message:{" "}
          <span style={{ wordBreak: "break-all" }}>{trackerUrl}</span>
        </p>
        <label htmlFor="family-phone" style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)" }}>
          Family phone (WhatsApp / SMS)
        </label>
        <input
          id="family-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="e.g. 919876543210"
          value={familyPhone}
          onChange={(e) => setFamilyPhone(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 320,
            marginTop: "0.35rem",
            padding: "0.55rem 0.75rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface2)",
            color: "var(--text)",
            font: "inherit",
          }}
        />
        {phoneDigits.length > 0 && phoneDigits.length < 10 && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--warn)" }}>
            Add at least 10 digits (include country code) for WhatsApp/SMS.
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <button type="button" className="danger" onClick={simulateEmergency}>
          Simulate emergency
        </button>
        <button type="button" className="secondary" onClick={resumeSimulation}>
          Resume normal simulation
        </button>
      </div>

      {location.error && (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Location: {location.error}</p>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Trends</h2>
        <VitalsChart hrHistory={hrHistory} riskHistory={riskHistory} />
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
          Map & route to hospital
        </h2>
        <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          Blue line: shortest driving route (OSRM public router when available). Hospital is mock
          data relative to your position.
        </p>
        <PatientMap
          className="tall"
          patientLat={lat}
          patientLng={lng}
          hospital={hospital}
          routeCoords={routeCoords}
        />
      </div>

      {patientModalOpen && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal">
            <h2>Emergency alert</h2>
            <p style={{ margin: "0 0 1rem" }}>
              High risk detected. Call emergency services if symptoms are severe. Follow the
              highlighted route to <strong>{hospital?.name ?? "the nearest hospital"}</strong>.
            </p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
              Current position: {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "unknown"}
            </p>
            {smsUri && (
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
                Backup only:{" "}
                <a href={smsUri} style={{ color: "var(--accent)" }}>
                  compose SMS
                </a>{" "}
                if cloud WhatsApp is unavailable.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPatientModalOpen(false)}>
                Acknowledge (keep map)
              </button>
              <button type="button" className="secondary" onClick={resumeSimulation}>
                Clear emergency demo
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .stat-label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .stat-value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
        .stat-value small { font-size: 0.95rem; font-weight: 500; opacity: 0.85; }
        .muted-text { color: var(--muted); margin: 0; }
      `}</style>
    </div>
  );
}
