import { useMemo } from "react";

const SIZE = 120;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RadialGauge({
  value,
  min = 0,
  max = 100,
  label = "",
  unit = "",
  color = "var(--neon-cyan)",
  glowColor = "var(--neon-cyan-glow)",
  decimals = 0,
}) {
  const pct = useMemo(() => {
    const clamped = Math.max(min, Math.min(max, value));
    return (clamped - min) / (max - min);
  }, [value, min, max]);

  const offset = CIRCUMFERENCE * (1 - pct);
  const displayVal = typeof value === "number" ? value.toFixed(decimals) : value;

  return (
    <div className="gauge-card">
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg
          className="gauge-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        >
          <circle
            className="gauge-bg"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
          />
          <circle
            className="gauge-fill"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        {/* overlay text — not rotated */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: "1.45rem",
              color: "var(--text-bright)",
              lineHeight: 1,
              textShadow: `0 0 12px ${glowColor}`,
            }}
          >
            {displayVal}
          </span>
          {unit && (
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.65rem",
                color: "var(--muted)",
                marginTop: "2px",
                letterSpacing: "0.04em",
              }}
            >
              {unit}
            </span>
          )}
        </div>
      </div>
      <div
        className="stat-label"
        style={{ marginTop: "0.6rem", fontSize: "0.72rem" }}
      >
        {label}
      </div>
    </div>
  );
}
