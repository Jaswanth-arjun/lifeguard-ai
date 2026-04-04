/**
 * Animated ECG / heartbeat waveform drawn with SVG.
 * The wave repeats 4× across a 200%-wide SVG that scrolls left infinitely.
 * Color adapts to the patient's current risk category.
 */
export default function HeartbeatLine({ riskCategory = "Normal" }) {
  const color =
    riskCategory === "High Risk"
      ? "var(--danger)"
      : riskCategory === "Warning"
      ? "var(--warn)"
      : "var(--success)";

  // Single heartbeat "QRS" pattern  (viewBox 0..200)
  const beat =
    "M0,24 L18,24 L22,20 L26,24 L34,24 L38,28 L42,8 L46,38 L50,24 L60,24 L66,22 L70,24 L80,24";
  // 4 repetitions offset by 80 to fill 200% width
  const d = [0, 80, 160, 240, 320, 400, 480, 560]
    .map((off) =>
      beat.replace(/(\d+),/g, (_, n) => `${Number(n) + off},`)
        .replace(/M\d+/, `M${off}`)
        .replace(/L(\d+)/g, (_, n) => `L${Number(n) + off}`)
    )
    .join(" ");

  // Actually let's build a simpler proper d string:
  const buildPath = () => {
    const points = [
      [0, 24], [18, 24], [22, 20], [26, 24], [34, 24],
      [38, 28], [42, 8], [46, 38], [50, 24], [60, 24],
      [66, 22], [70, 24], [80, 24],
    ];
    const segWidth = 80;
    const repeats = 8;
    let path = "";
    for (let r = 0; r < repeats; r++) {
      const ox = r * segWidth;
      points.forEach((p, i) => {
        const cmd = r === 0 && i === 0 ? "M" : "L";
        path += `${cmd}${p[0] + ox},${p[1]} `;
      });
    }
    return path.trim();
  };

  return (
    <div className="heartbeat-container">
      <svg
        className="heartbeat-svg"
        viewBox="0 0 640 48"
        preserveAspectRatio="none"
      >
        <path
          className="heartbeat-path"
          d={buildPath()}
          stroke={color}
          style={{ transition: "stroke 0.5s ease" }}
        />
      </svg>
    </div>
  );
}
