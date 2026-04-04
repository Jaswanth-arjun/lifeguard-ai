import { useState } from "react";
import { getCategoryMeta, PRIORITY } from "../utils/recommendationEngine.js";

function priorityLabel(p) {
  if (p === PRIORITY.CRITICAL) return "Critical";
  if (p === PRIORITY.HIGH) return "High";
  if (p === PRIORITY.MEDIUM) return "Medium";
  return "Low";
}

function priorityBadgeClass(p) {
  if (p === PRIORITY.CRITICAL) return "badge danger";
  if (p === PRIORITY.HIGH) return "badge warning";
  if (p === PRIORITY.MEDIUM) return "badge info";
  return "badge success";
}

function RecCard({ rec, expanded, onToggle }) {
  const meta = getCategoryMeta(rec.category);
  const isCritical = rec.priority >= PRIORITY.HIGH;

  return (
    <div
      className={`rec-card ${isCritical ? "rec-card--urgent" : ""}`}
      style={{ "--rec-accent": meta.color }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
    >
      <div className="rec-card__header">
        <div className="rec-card__icon" style={{ background: `${meta.color}15`, color: meta.color }}>
          {meta.icon}
        </div>
        <div className="rec-card__info">
          <div className="rec-card__title">{rec.title}</div>
          <div className="rec-card__category">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span className={priorityBadgeClass(rec.priority)}>
              {priorityLabel(rec.priority)}
            </span>
          </div>
        </div>
        <div className="rec-card__chevron" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
          ▾
        </div>
      </div>

      {expanded && (
        <div className="rec-card__body">
          <p className="rec-card__message">{rec.message}</p>
          {rec.actions?.length > 0 && (
            <div className="rec-card__actions">
              <div className="rec-card__actions-label">Suggested Actions:</div>
              {rec.actions.map((action, i) => (
                <div key={i} className="rec-card__action-item">
                  <span className="rec-card__action-dot" style={{ background: meta.color }} />
                  {action}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HealthRecommendations({ recommendations = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!recommendations.length) return null;

  const urgent = recommendations.filter((r) => r.priority >= PRIORITY.HIGH);
  const general = recommendations.filter((r) => r.priority < PRIORITY.HIGH);

  return (
    <div className="card rec-panel" style={{ marginBottom: "1rem" }}>
      <div className="section-header">
        <span className="icon">🩺</span>
        AI Health Recommendations
        <span className="badge success" style={{ marginLeft: "auto", fontSize: "0.68rem" }}>
          {recommendations.length} active
        </span>
      </div>

      {urgent.length > 0 && (
        <div className="rec-group">
          <div className="rec-group__label" style={{ color: "var(--danger)" }}>
            ⚡ Priority Alerts
          </div>
          {urgent.map((rec) => (
            <RecCard
              key={rec.id}
              rec={rec}
              expanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            />
          ))}
        </div>
      )}

      {general.length > 0 && (
        <div className="rec-group">
          {urgent.length > 0 && (
            <div className="rec-group__label" style={{ color: "var(--muted)" }}>
              📋 General Recommendations
            </div>
          )}
          {general.map((rec) => (
            <RecCard
              key={rec.id}
              rec={rec}
              expanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
