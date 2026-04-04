import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
    return <p className="muted-text">Collecting samples…</p>;
  }

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
          <XAxis dataKey="index" stroke="#8b9cb3" fontSize={12} />
          <YAxis yAxisId="left" stroke="#3dd68c" fontSize={12} domain={["auto", "auto"]} />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#3d9cf5"
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ background: "#1a2332", border: "1px solid #2d3a4f" }}
            labelStyle={{ color: "#e8eef5" }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="heart_rate"
            name="Heart rate (bpm)"
            stroke="#3dd68c"
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="risk"
            name="Risk score"
            stroke="#3d9cf5"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
