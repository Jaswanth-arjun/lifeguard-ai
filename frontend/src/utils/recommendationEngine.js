/**
 * AI Personal Doctor — Real-time Health Recommendation Engine
 *
 * Analyzes vitals, risk score, medical history, and lifestyle to generate
 * prioritized, actionable health recommendations. Runs client-side for
 * instant feedback on every vitals tick.
 */

// ── Recommendation categories ──────────────────────────────────────
export const CATEGORIES = {
  HYDRATION: "hydration",
  REST: "rest",
  ACTIVITY: "activity",
  BREATHING: "breathing",
  NUTRITION: "nutrition",
  DOCTOR: "doctor",
  EMERGENCY: "emergency",
  PREVENTIVE: "preventive",
  SLEEP: "sleep",
  MEDICATION: "medication",
};

// ── Priority levels ────────────────────────────────────────────────
export const PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// ── Category metadata ──────────────────────────────────────────────
const CATEGORY_META = {
  [CATEGORIES.HYDRATION]: { icon: "💧", color: "#00c8ff", label: "Hydration" },
  [CATEGORIES.REST]: { icon: "🛌", color: "#b14cfa", label: "Rest & Recovery" },
  [CATEGORIES.ACTIVITY]: { icon: "🚶", color: "#39ff14", label: "Activity" },
  [CATEGORIES.BREATHING]: { icon: "🧘", color: "#a78bfa", label: "Stress Relief" },
  [CATEGORIES.NUTRITION]: { icon: "🍎", color: "#ff9f43", label: "Nutrition" },
  [CATEGORIES.DOCTOR]: { icon: "👨‍⚕️", color: "#ffea00", label: "Doctor Consult" },
  [CATEGORIES.EMERGENCY]: { icon: "🚨", color: "#ff003c", label: "Emergency" },
  [CATEGORIES.PREVENTIVE]: { icon: "🛡️", color: "#00f0ff", label: "Preventive" },
  [CATEGORIES.SLEEP]: { icon: "😴", color: "#7c6ef0", label: "Sleep" },
  [CATEGORIES.MEDICATION]: { icon: "💊", color: "#f97316", label: "Medication" },
};

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || { icon: "ℹ️", color: "#94a3b8", label: "Info" };
}

// ── Default thresholds (user-customizable) ─────────────────────────
const DEFAULT_THRESHOLDS = {
  heart_rate_high: 110,
  heart_rate_very_high: 130,
  heart_rate_low: 55,
  spo2_low: 94,
  spo2_very_low: 90,
  temp_high: 37.8,
  temp_very_high: 38.5,
  temp_low: 35.5,
  risk_mild: 25,
  risk_moderate: 50,
  risk_high: 75,
};

/**
 * Generate health recommendations based on current vitals and risk.
 *
 * @param {object} vitals         - { heart_rate, spo2, temperature_c, medical_history, lifestyle_score }
 * @param {object|null} prediction - { risk_score, category }
 * @param {object} thresholds     - user-customizable thresholds (merged with defaults)
 * @returns {Array<object>}       - sorted list of recommendations (highest priority first)
 */
export function generateRecommendations(vitals, prediction, thresholds = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const recs = [];
  const hr = vitals.heart_rate;
  const spo2 = vitals.spo2;
  const temp = vitals.temperature_c;
  const medHist = vitals.medical_history ?? 0;
  const lifestyle = vitals.lifestyle_score ?? 5;
  const riskScore = prediction?.risk_score ?? 0;
  const riskCat = prediction?.category ?? "Normal";

  // ── EMERGENCY: Multiple critically abnormal vitals ────────────
  const critCount = [
    hr > t.heart_rate_very_high,
    spo2 < t.spo2_very_low,
    temp > t.temp_very_high,
  ].filter(Boolean).length;

  if (critCount >= 2 || riskCat === "High Risk") {
    recs.push({
      id: "emergency-multi",
      category: CATEGORIES.EMERGENCY,
      priority: PRIORITY.CRITICAL,
      title: "Seek Immediate Medical Attention",
      message: "Multiple vital signs are critically abnormal. Contact your doctor or call emergency services immediately.",
      actions: ["Call emergency services", "Take prescribed emergency meds", "Move to a safe resting position"],
      popup: true,
    });
  }

  // ── DOCTOR CONSULT: Moderate risk or chronic conditions ───────
  if (riskScore >= t.risk_moderate && riskCat !== "High Risk") {
    recs.push({
      id: "doctor-moderate-risk",
      category: CATEGORIES.DOCTOR,
      priority: PRIORITY.HIGH,
      title: "Schedule a Doctor Consultation",
      message: `Your AI risk score is ${riskScore}/100 — elevated beyond normal range. A professional review is recommended.`,
      actions: ["Book an appointment today", "Share your vitals summary with your doctor"],
      popup: true,
    });
  }

  if (medHist >= 7 && riskScore >= t.risk_mild) {
    recs.push({
      id: "doctor-chronic",
      category: CATEGORIES.MEDICATION,
      priority: PRIORITY.HIGH,
      title: "Medication & Chronic Care Check",
      message: "Your medical history severity is high and vitals are showing stress. Ensure you're taking prescribed medications on time.",
      actions: ["Take your prescribed medication", "Log symptoms for your next visit"],
      popup: false,
    });
  }

  // ── HYDRATION: High temp or elevated HR ───────────────────────
  if (temp > t.temp_high) {
    recs.push({
      id: "hydration-temp",
      category: CATEGORIES.HYDRATION,
      priority: temp > t.temp_very_high ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Stay Hydrated — Temperature Elevated",
      message: `Your body temperature is ${temp}°C. Drink water and move to a cool environment to help regulate.`,
      actions: ["Drink a glass of water now", "Move to a cool, shaded area", "Apply a cool compress"],
      popup: temp > t.temp_very_high,
    });
  }

  if (hr > t.heart_rate_high && temp <= t.temp_high) {
    recs.push({
      id: "hydration-hr",
      category: CATEGORIES.HYDRATION,
      priority: PRIORITY.MEDIUM,
      title: "Hydrate — Heart Rate Elevated",
      message: `Heart rate at ${hr} bpm may indicate mild dehydration. Drink fluids to help normalize.`,
      actions: ["Drink water or electrolyte drink", "Avoid caffeine temporarily"],
      popup: false,
    });
  }

  // ── REST: High heart rate ─────────────────────────────────────
  if (hr > t.heart_rate_high) {
    recs.push({
      id: "rest-hr-high",
      category: CATEGORIES.REST,
      priority: hr > t.heart_rate_very_high ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Take a Rest — Heart Rate High",
      message: `Your heart rate is ${hr} bpm. Stop strenuous activity and rest for at least 10 minutes.`,
      actions: ["Sit or lie down comfortably", "Practice slow, deep breathing", "Avoid physical exertion"],
      popup: hr > t.heart_rate_very_high,
    });
  }

  // ── BREATHING / STRESS ────────────────────────────────────────
  if (hr > t.heart_rate_high && lifestyle < 5) {
    recs.push({
      id: "stress-breathing",
      category: CATEGORIES.BREATHING,
      priority: PRIORITY.MEDIUM,
      title: "Try a Breathing Exercise",
      message: "Elevated heart rate combined with a lower lifestyle score suggests stress. A short breathing exercise can help.",
      actions: ["Inhale 4s → Hold 4s → Exhale 6s", "Repeat for 5 minutes", "Find a quiet, comfortable space"],
      popup: false,
    });
  }

  // ── NUTRITION: Low SpO₂ ───────────────────────────────────────
  if (spo2 < t.spo2_low) {
    recs.push({
      id: "nutrition-spo2",
      category: CATEGORIES.NUTRITION,
      priority: spo2 < t.spo2_very_low ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Blood Oxygen Low — Nourish & Rest",
      message: `SpO₂ at ${spo2}% is below optimal. Eat iron-rich foods and ensure fresh air circulation.`,
      actions: ["Eat a nutritious meal or snack", "Move to a well-ventilated area", "Practice deep breathing exercises"],
      popup: spo2 < t.spo2_very_low,
    });
  }

  // ── ACTIVITY: Low lifestyle + normal vitals ───────────────────
  if (lifestyle <= 3 && hr < 80 && riskScore < t.risk_mild) {
    recs.push({
      id: "activity-sedentary",
      category: CATEGORIES.ACTIVITY,
      priority: PRIORITY.LOW,
      title: "Get Moving — Light Activity Suggested",
      message: "Your lifestyle score is low and vitals are stable. A short walk or stretching can boost your energy and circulation.",
      actions: ["Take a 10-minute walk", "Do light stretching exercises", "Stand and move every hour"],
      popup: false,
    });
  }

  // ── PREVENTIVE: Mild risk but no specific alert ───────────────
  if (riskScore >= t.risk_mild && riskScore < t.risk_moderate && recs.length === 0) {
    recs.push({
      id: "preventive-mild",
      category: CATEGORIES.PREVENTIVE,
      priority: PRIORITY.LOW,
      title: "Mild Risk Detected — Stay Proactive",
      message: `AI risk score is ${riskScore}/100. No immediate concern, but maintaining hydration, rest, and a balanced diet is advisable.`,
      actions: ["Stay hydrated", "Get adequate sleep tonight", "Monitor how you feel over the next hour"],
      popup: false,
    });
  }

  // ── SLEEP: Low lifestyle + high medical history ───────────────
  if (lifestyle <= 4 && medHist >= 5) {
    recs.push({
      id: "sleep-recovery",
      category: CATEGORIES.SLEEP,
      priority: PRIORITY.LOW,
      title: "Prioritize Sleep & Recovery",
      message: "Your medical history and lifestyle indicators suggest your body needs extra recovery time. Aim for 7–9 hours of quality sleep.",
      actions: ["Set a consistent bedtime", "Limit screen time 1 hour before bed", "Keep the room cool and dark"],
      popup: false,
    });
  }

  // ── LOW TEMP: Hypothermia warning ─────────────────────────────
  if (temp < t.temp_low) {
    recs.push({
      id: "temp-low",
      category: CATEGORIES.PREVENTIVE,
      priority: PRIORITY.MEDIUM,
      title: "Low Body Temperature Detected",
      message: `Temperature at ${temp}°C is below normal. Warm up and monitor closely.`,
      actions: ["Wear warm clothing or use a blanket", "Drink a warm beverage", "Move to a warmer environment"],
      popup: true,
    });
  }

  // ── ALL CLEAR: Good vitals ────────────────────────────────────
  if (recs.length === 0 && riskScore < t.risk_mild) {
    recs.push({
      id: "all-clear",
      category: CATEGORIES.PREVENTIVE,
      priority: PRIORITY.LOW,
      title: "All Looking Good! 👍",
      message: "Your vitals are within healthy ranges. Keep up your current routine and stay hydrated.",
      actions: ["Continue normal activities", "Stay hydrated", "Maintain regular exercise"],
      popup: false,
    });
  }

  // Sort by priority (critical first)
  recs.sort((a, b) => b.priority - a.priority);
  return recs;
}

/**
 * Generate a daily summary from vitals history and risk history.
 */
export function generateDailySummary(hrHistory, riskHistory, vitals, prediction) {
  const avgHr = hrHistory.length
    ? Math.round(hrHistory.reduce((s, h) => s + h.hr, 0) / hrHistory.length)
    : vitals.heart_rate;
  const maxHr = hrHistory.length
    ? Math.max(...hrHistory.map((h) => h.hr))
    : vitals.heart_rate;
  const minHr = hrHistory.length
    ? Math.min(...hrHistory.map((h) => h.hr))
    : vitals.heart_rate;
  const avgRisk = riskHistory.length
    ? Math.round(riskHistory.reduce((s, r) => s + r.risk, 0) / riskHistory.length)
    : 0;
  const maxRisk = riskHistory.length
    ? Math.max(...riskHistory.map((r) => r.risk))
    : 0;
  const samples = Math.max(hrHistory.length, riskHistory.length);

  const highRiskCount = riskHistory.filter((r) => r.risk >= 75).length;
  const warningCount = riskHistory.filter((r) => r.risk >= 50 && r.risk < 75).length;

  let overallStatus = "Excellent";
  let statusColor = "#39ff14";
  if (avgRisk >= 60) {
    overallStatus = "Needs Attention";
    statusColor = "#ff003c";
  } else if (avgRisk >= 35) {
    overallStatus = "Fair";
    statusColor = "#ffea00";
  } else if (avgRisk >= 15) {
    overallStatus = "Good";
    statusColor = "#00f0ff";
  }

  return {
    avgHr,
    maxHr,
    minHr,
    avgRisk,
    maxRisk,
    samples,
    highRiskCount,
    warningCount,
    overallStatus,
    statusColor,
    currentVitals: { ...vitals },
    currentPrediction: prediction ? { ...prediction } : null,
    timestamp: new Date().toLocaleString(),
  };
}
