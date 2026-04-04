/**
 * Builds the Family Tracker URL for the current deployment.
 * Flask static demo: http://host/demo/#family  ·  React (Vite): http://host/family
 */
export function getFamilyTrackerUrl() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  if (pathname.includes("/demo")) {
    const base = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return `${origin}${base}#family`;
  }
  return `${origin}/family`;
}

export function digitsOnlyPhone(input) {
  return String(input || "").replace(/\D/g, "");
}

export function buildFamilyEmergencyMessage({ vitals, pred, lat, lng, trackerUrl }) {
  const la = typeof lat === "number" ? lat.toFixed(5) : lat;
  const ln = typeof lng === "number" ? lng.toFixed(5) : lng;
  return [
    "EMERGENCY — Patient health alert (AI monitoring)",
    `Status: ${pred?.category ?? "High Risk"} (risk score ${pred?.risk_score ?? "—"})`,
    `Vitals: HR ${vitals?.heart_rate} bpm, SpO₂ ${vitals?.spo2}%, Temp ${vitals?.temperature_c}°C`,
    `Last known GPS: ${la}, ${ln}`,
    `Open Family Tracker (live map): ${trackerUrl}`,
  ].join("\n");
}

/** WhatsApp Web / app — free, no API key. User taps Send. */
export function openWhatsAppWithMessage(digits, message) {
  const d = digitsOnlyPhone(digits);
  if (d.length < 10) return false;
  const url = `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/** Opens default SMS app with pre-filled body (works on many phones). */
export function getSmsUri(digits, message) {
  const d = digitsOnlyPhone(digits);
  if (d.length < 10) return null;
  return `sms:+${d}?body=${encodeURIComponent(message)}`;
}
