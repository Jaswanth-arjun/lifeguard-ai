import { useHealth } from "../context/HealthContext.jsx";
import PatientMap from "./PatientMap.jsx";
import VitalsChart from "./VitalsChart.jsx";
import RadialGauge from "./RadialGauge.jsx";
import HeartbeatLine from "./HeartbeatLine.jsx";
import {
  buildFamilyEmergencyMessage,
  digitsOnlyPhone,
  getFamilyTrackerUrl,
  getSmsUri,
} from "../utils/familyNotify.js";
import HealthRecommendations from "./HealthRecommendations.jsx";
import RecommendationPopup from "./RecommendationPopup.jsx";
import DailySummary from "./DailySummary.jsx";

function riskColor(category) {
  if (category === "High Risk") return "var(--danger)";
  if (category === "Warning") return "var(--warn)";
  return "var(--success)";
}

function riskGlow(category) {
  if (category === "High Risk") return "var(--danger-glow)";
  if (category === "Warning") return "var(--warn-glow)";
  return "var(--success-glow)";
}

function riskBadgeClass(category) {
  if (category === "High Risk") return "badge danger";
  if (category === "Warning") return "badge warning";
  return "badge success";
}

export default function PatientDashboard() {
  const {
    vitals,
    setVitals,
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
    recommendations,
    activePopup,
    dismissPopup,
    snoozePopup,
    dailySummary,
    refreshDailySummary,
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

  const cat = prediction?.category ?? "Normal";

  return (
    <div className="page-enter">
      {/* ── Header ── */}
      <header style={{ marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Patient Monitoring</h1>
          {prediction && (
            <span className={riskBadgeClass(cat)}>{cat}</span>
          )}
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          Simulated wearable vitals update every 2.5s · ML risk runs on Flask backend (scikit-learn)
        </p>
      </header>

      {/* ── Heartbeat Line ── */}
      <HeartbeatLine riskCategory={cat} />

      {/* ── API Error ── */}
      {lastError && (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: "1rem" }}>
          <strong style={{ color: "var(--warn)" }}>⚠ API Error:</strong>{" "}
          <span style={{ color: "var(--muted)" }}>{lastError}. Is the backend running on port 5000?</span>
        </div>
      )}

      {/* ── Vitals Gauges ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div className="card">
          <RadialGauge
            value={vitals.heart_rate}
            min={40}
            max={180}
            label="Heart Rate"
            unit="BPM"
            color={vitals.heart_rate > 120 ? "var(--danger)" : vitals.heart_rate > 100 ? "var(--warn)" : "var(--success)"}
            glowColor={vitals.heart_rate > 120 ? "var(--danger-glow)" : vitals.heart_rate > 100 ? "var(--warn-glow)" : "var(--success-glow)"}
          />
        </div>
        <div className="card">
          <RadialGauge
            value={vitals.spo2}
            min={80}
            max={100}
            label="SpO₂"
            unit="%"
            color={vitals.spo2 < 90 ? "var(--danger)" : vitals.spo2 < 95 ? "var(--warn)" : "#00c8ff"}
            glowColor="rgba(0, 200, 255, 0.25)"
            decimals={1}
          />
        </div>
        <div className="card">
          <RadialGauge
            value={vitals.temperature_c}
            min={35}
            max={41}
            label="Body Temp"
            unit="°C"
            color={vitals.temperature_c > 38.5 ? "var(--danger)" : vitals.temperature_c > 37.5 ? "var(--warn)" : "#4dc9f6"}
            glowColor="rgba(77, 201, 246, 0.25)"
            decimals={1}
          />
        </div>
        <div className="card" style={{ borderColor: prediction ? riskColor(cat) : undefined }}>
          <RadialGauge
            value={prediction ? prediction.risk_score : 0}
            min={0}
            max={100}
            label="AI Risk Score"
            unit="/ 100"
            color={prediction ? riskColor(cat) : "var(--muted)"}
            glowColor={prediction ? riskGlow(cat) : "transparent"}
          />
        </div>
      </div>

      {/* ── Health Recommendations ── */}
      <HealthRecommendations recommendations={recommendations} />

      {/* ── Medical History & Lifestyle Sliders ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div className="card">
          <div className="section-header">
            <span className="icon">📋</span>
            Medical History Severity
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <input
              type="range" min="0" max="10" step="1"
              value={vitals.medical_history ?? 0}
              onChange={(e) => setVitals(v => ({ ...v, medical_history: Number(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: "1.4rem",
              color: "var(--text-bright)",
              minWidth: "3.5rem",
              textAlign: "right",
            }}>
              {vitals.medical_history ?? 0} <small style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>/ 10</small>
            </span>
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--muted-dim)" }}>
            0 = No history · 10 = Severe chronic conditions
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <span className="icon">🏃</span>
            Lifestyle Score
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <input
              type="range" min="0" max="10" step="1"
              value={vitals.lifestyle_score ?? 8}
              onChange={(e) => setVitals(v => ({ ...v, lifestyle_score: Number(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: "1.4rem",
              color: "var(--text-bright)",
              minWidth: "3.5rem",
              textAlign: "right",
            }}>
              {vitals.lifestyle_score ?? 8} <small style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>/ 10</small>
            </span>
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--muted-dim)" }}>
            0 = Sedentary · 10 = Athletic lifestyle
          </div>
        </div>
      </div>

      {/* ── Family Emergency Contact ── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-header">
          <span className="icon">📱</span>
          Family Emergency Contact
        </div>
        <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.6 }}>
          Enter the family WhatsApp number in <strong style={{ color: "var(--text)" }}>international format</strong> (with country code).
          On <strong style={{ color: "var(--text)" }}>Simulate Emergency</strong>, the server sends WhatsApp automatically.
          Configure env vars per <code style={{ color: "var(--neon-cyan)", fontSize: "0.82rem" }}>backend/WHATSAPP_SETUP.txt</code>.
        </p>
        <label htmlFor="family-phone" style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
          Family Phone (WhatsApp / SMS)
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
            maxWidth: 340,
            padding: "0.6rem 0.85rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "rgba(0, 0, 0, 0.3)",
            color: "var(--text)",
            font: "inherit",
            fontSize: "0.92rem",
          }}
        />
        {phoneDigits.length > 0 && phoneDigits.length < 10 && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "var(--warn)" }}>
            ⚠ Add at least 10 digits (include country code) for WhatsApp/SMS.
          </p>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <button type="button" className="danger" onClick={simulateEmergency}>
          ⚡ Simulate Emergency
        </button>
        <button type="button" className="secondary" onClick={resumeSimulation}>
          ↻ Resume Normal
        </button>
        <DailySummary summary={dailySummary} onOpen={refreshDailySummary} />
      </div>

      {/* ── Location Note ── */}
      {location.error && (
        <p style={{ color: "var(--muted-dim)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          📍 {location.error}
        </p>
      )}

      {/* ── Trends Chart ── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-header">
          <span className="icon">📈</span>
          Live Trends
        </div>
        <VitalsChart hrHistory={hrHistory} riskHistory={riskHistory} />
      </div>

      {/* ── Map ── */}
      <div className="card">
        <div className="section-header">
          <span className="icon">🗺️</span>
          Map &amp; Route to Hospital
        </div>
        <p style={{ margin: "0 0 0.75rem", color: "var(--muted-dim)", fontSize: "0.85rem" }}>
          Blue line: shortest driving route (OSRM). Hospital is mock data relative to your position.
        </p>
        <PatientMap
          className="tall"
          patientLat={lat}
          patientLng={lng}
          hospital={hospital}
          routeCoords={routeCoords}
        />
      </div>

      {/* ── Emergency Modal ── */}
      {patientModalOpen && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal">
            <h2>Emergency Alert</h2>
            <p style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
              High risk detected. Call emergency services if symptoms are severe. Follow the
              highlighted route to <strong style={{ color: "var(--text-bright)" }}>{hospital?.name ?? "the nearest hospital"}</strong>.
            </p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--muted)" }}>
              📍 Current position: {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "unknown"}
            </p>
            {smsUri && (
              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--muted)" }}>
                Backup:{" "}
                <a href={smsUri} style={{ color: "var(--neon-cyan)", textDecoration: "underline" }}>
                  compose SMS
                </a>{" "}
                if cloud WhatsApp is unavailable.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPatientModalOpen(false)}>
                Acknowledge
              </button>
              <button type="button" className="secondary" onClick={resumeSimulation}>
                Clear Emergency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendation Popup ── */}
      <RecommendationPopup
        recommendation={activePopup}
        onDismiss={dismissPopup}
        onSnooze={snoozePopup}
      />
    </div>
  );
}
