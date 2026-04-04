import { useState } from "react";

export default function DailySummary({ summary, onOpen, onClose }) {
  const [open, setOpen] = useState(false);

  if (!summary) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        className="secondary"
        onClick={() => {
          if (onOpen) onOpen();
          setOpen(true);
        }}
        style={{ marginBottom: "1rem", fontSize: "0.8rem" }}
      >
        📊 View Session Summary
      </button>

      {/* Modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="daily-summary-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="daily-summary__header">
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                📊 Session Health Summary
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {summary.timestamp}
              </span>
            </div>

            {/* Overall Status */}
            <div className="daily-summary__status" style={{ "--status-color": summary.statusColor }}>
              <div className="daily-summary__status-label">Overall Status</div>
              <div className="daily-summary__status-value" style={{ color: summary.statusColor }}>
                {summary.overallStatus}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="daily-summary__grid">
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">Avg Heart Rate</div>
                <div className="daily-summary__stat-value">{summary.avgHr} <small>bpm</small></div>
              </div>
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">HR Range</div>
                <div className="daily-summary__stat-value">{summary.minHr}–{summary.maxHr} <small>bpm</small></div>
              </div>
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">Avg Risk Score</div>
                <div className="daily-summary__stat-value">{summary.avgRisk} <small>/100</small></div>
              </div>
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">Peak Risk</div>
                <div className="daily-summary__stat-value">{summary.maxRisk} <small>/100</small></div>
              </div>
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">Data Points</div>
                <div className="daily-summary__stat-value">{summary.samples}</div>
              </div>
              <div className="daily-summary__stat">
                <div className="daily-summary__stat-label">High Risk Events</div>
                <div className="daily-summary__stat-value" style={{ color: summary.highRiskCount > 0 ? "var(--danger)" : "var(--success)" }}>
                  {summary.highRiskCount}
                </div>
              </div>
            </div>

            {/* Current Vitals */}
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Current Vitals Snapshot
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem" }}>
                <span>HR: <strong>{summary.currentVitals.heart_rate}</strong> bpm</span>
                <span>SpO₂: <strong>{summary.currentVitals.spo2}</strong>%</span>
                <span>Temp: <strong>{summary.currentVitals.temperature_c}</strong>°C</span>
              </div>
            </div>

            {/* Recommendations */}
            <div style={{ marginTop: "1.25rem", padding: "1rem", borderRadius: "var(--radius-sm)", background: "rgba(0, 240, 255, 0.04)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--neon-cyan)", marginBottom: "0.5rem" }}>
                💡 Recommendations for Tomorrow
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.8 }}>
                {summary.avgRisk >= 30 && <li>Schedule a check-up with your healthcare provider</li>}
                {summary.avgHr > 90 && <li>Incorporate more rest periods and reduce caffeine intake</li>}
                {summary.maxRisk >= 50 && <li>Review your medication schedule with your doctor</li>}
                <li>Maintain hydration — aim for 8 glasses of water</li>
                <li>Get 7–9 hours of quality sleep</li>
                {summary.currentVitals.lifestyle_score < 5 && <li>Try 30 minutes of moderate exercise</li>}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ marginTop: "1.25rem", width: "100%" }}
            >
              Close Summary
            </button>
          </div>
        </div>
      )}
    </>
  );
}
