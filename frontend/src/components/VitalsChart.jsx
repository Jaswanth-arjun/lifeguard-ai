import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(8, 14, 30, 0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "12px",
        padding: "0.75rem 1rem",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        fontSize: "0.82rem",
      }}
    >
      <div style={{ color: "#94a3b8", marginBottom: "0.35rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Sample #{label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ color: "#e2e8f0" }}>{p.name}:</span>
          <span style={{ color: "#fff", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", marginTop: "0.5rem" }}>
      {payload?.map((entry) => (
        <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#94a3b8" }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function VitalsChart({ hrHistory, riskHistory }) {
  const merged = [];
  const maxLen = Math.max(hrHistory.length, riskHistory.length);
  for (let i = 0; i < maxLen; i++) {
    merged.push({
      index: i + 1,
      heart_rate: hrHistory[i]?.hr,
      risk: riskHistory[i]?.risk,
    });
  }

  if (!merged.length) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", padding: "1rem 0" }}>
        ⏳ Collecting samples…
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#39ff14" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#39ff14" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00c8ff" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#00c8ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="index"
            stroke="#4a5568"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          />
          <YAxis
            yAxisId="left"
            stroke="#39ff14"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#00c8ff"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="heart_rate"
            name="Heart Rate (bpm)"
            stroke="#39ff14"
            fill="url(#hrGrad)"
            dot={false}
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 4px rgba(57, 255, 20, 0.4))" }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="risk"
            name="Risk Score"
            stroke="#00c8ff"
            fill="url(#riskGrad)"
            dot={false}
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 4px rgba(0, 200, 255, 0.4))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
