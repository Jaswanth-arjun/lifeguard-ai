import { getCategoryMeta } from "../utils/recommendationEngine.js";
import { useState } from "react";

export default function RecommendationPopup({ recommendation, onDismiss, onSnooze }) {
  const [startX, setStartX] = useState(null);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!recommendation) return null;

  const meta = getCategoryMeta(recommendation.category);

  const handlePointerDown = (e) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    // only allow swiping right (diff > 0) or left (diff < 0)
    setCurrentX(diff);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (Math.abs(currentX) > 100) {
      onDismiss();
    }
    setCurrentX(0);
  };

  const style = {
    "--rec-popup-accent": meta.color,
    transform: `translateX(${currentX}px)`,
    transition: isDragging ? "none" : "transform 0.3s ease",
    opacity: isDragging ? 1 - Math.abs(currentX) / 200 : 1,
  };

  return (
    <div
      className="rec-notification"
      style={style}
      role="alertdialog"
      aria-modal="false"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="rec-notification__close" onClick={onDismiss}>×</div>
      <div className="rec-notification__header">
        <div className="rec-notification__icon-ring" style={{ borderColor: meta.color, backgroundColor: `rgba(${meta.color}, 0.1)` }}>
          <span className="rec-notification__icon">{meta.icon}</span>
        </div>
        <div>
          <div className="rec-notification__label" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <h3 className="rec-notification__title">{recommendation.title}</h3>
        </div>
      </div>

      <p className="rec-notification__message">{recommendation.message}</p>

      {recommendation.actions?.length > 0 && (
        <div className="rec-notification__actions">
          {recommendation.actions.map((action, i) => (
            <div key={i} className="rec-notification__action-row">
              <span className="rec-notification__action-num" style={{ borderColor: meta.color, color: meta.color }}>
                {i + 1}
              </span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rec-notification__buttons">
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
  );
}
