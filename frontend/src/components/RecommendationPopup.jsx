import { getCategoryMeta } from "../utils/recommendationEngine.js";

export default function RecommendationPopup({ recommendation, onDismiss, onSnooze }) {
  if (!recommendation) return null;

  const meta = getCategoryMeta(recommendation.category);

  return (
    <div className="rec-popup-backdrop" onClick={onDismiss}>
      <div
        className="rec-popup"
        style={{ "--rec-popup-accent": meta.color }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="rec-popup__icon-ring">
          <span className="rec-popup__icon">{meta.icon}</span>
        </div>

        <div className="rec-popup__label" style={{ color: meta.color }}>
          {meta.label}
        </div>

        <h3 className="rec-popup__title">{recommendation.title}</h3>

        <p className="rec-popup__message">{recommendation.message}</p>

        {recommendation.actions?.length > 0 && (
          <div className="rec-popup__actions">
            {recommendation.actions.map((action, i) => (
              <div key={i} className="rec-popup__action-row">
                <span className="rec-popup__action-num" style={{ borderColor: meta.color, color: meta.color }}>
                  {i + 1}
                </span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        )}

        <div className="rec-popup__buttons">
          <button type="button" onClick={onDismiss} style={{ borderColor: meta.color, color: meta.color }}>
            ✓ Got It
          </button>
          {onSnooze && (
            <button type="button" className="secondary" onClick={onSnooze}>
              Snooze 5 min
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
