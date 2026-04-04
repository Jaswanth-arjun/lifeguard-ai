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
  STRESS: "stress",
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
  [CATEGORIES.STRESS]: { icon: "🧠", color: "#f472b6", label: "Mental Health" },
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

  // 1. EMERGENCY EARLY WARNINGS: Multiple parameters indicate serious risk
  const critCount = [
    hr > t.heart_rate_very_high || hr < t.heart_rate_low,
    spo2 < t.spo2_very_low,
    temp > t.temp_very_high || temp < t.temp_low,
  ].filter(Boolean).length;

  if (critCount >= 2 || riskCat === "High Risk") {
    recs.push({
      id: "emergency-multi",
      category: CATEGORIES.EMERGENCY,
      priority: PRIORITY.CRITICAL,
      title: "Multiple Abnormal Vitals — Emergency Warning",
      message: "Multiple vitals are abnormal—contact your doctor immediately. This alert is triggered by synchronized critical parameters.",
      actions: ["Contact your doctor immediately", "Alert family or near ones", "Avoid any physical movement"],
      popup: true,
    });
  }

  // 2. HYDRATION MANAGEMENT: Dehydration detection
  if (temp > t.temp_high || (hr > t.heart_rate_high && spo2 < 96)) {
    recs.push({
      id: "hydration-alert",
      category: CATEGORIES.HYDRATION,
      priority: temp > t.temp_very_high ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Dehydration Risk Detected",
      message: "You seem a bit dehydrated—drink a glass of water now. High body temperature and elevated heart rate are primary indicators.",
      actions: ["Drink a glass of water now", "Move to a cool environment", "Avoid electrolytes/caffeine"],
      popup: temp > t.temp_very_high,
    });
  }

  // 3. REST & ACTIVITY GUIDANCE: High heart rate or stress
  if (hr > t.heart_rate_high) {
    recs.push({
      id: "rest-guidance",
      category: CATEGORIES.REST,
      priority: hr > t.heart_rate_very_high ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Elevated Heart Rate — Rest Mandatory",
      message: "Your heart rate is elevated—take a 10-minute rest. Continuous high HR can lead to strain and fatigue.",
      actions: ["Sit or lie down for 10 minutes", "Practice deep breathing", "Stop current activity immediately"],
      popup: hr > t.heart_rate_very_high,
    });
  }

  // 4. LOW ACTIVITY: Suggest stretching
  if (lifestyle <= 3 && hr < 85 && riskScore < t.risk_mild) {
    recs.push({
      id: "activity-low",
      category: CATEGORIES.ACTIVITY,
      priority: PRIORITY.LOW,
      title: "Inactivity Detected — Stretch or Walk",
      message: "You have been inactive for a while. A short walk or some light stretching will improve your circulation.",
      actions: ["Take a 5-minute walk", "Perform light neck and arm stretches", "Stand up and move"],
      popup: false,
    });
  }

  // 5. MEDICATION REMINDERS: Based on medical history and condition
  if (medHist >= 5 && (riskScore >= t.risk_mild || hr > t.heart_rate_high)) {
    recs.push({
      id: "medication-reminder",
      category: CATEGORIES.MEDICATION,
      priority: PRIORITY.HIGH,
      title: "Routine Medication Due?",
      message: "Time to take your blood pressure or routine medicine. Your current vitals are slightly high or showing stress.",
      actions: ["Verify medication schedule", "Take prescribed dose", "Ensure you have enough water"],
      popup: true,
    });
  }

  // 6. SLEEP RECOMMENDATIONS: Insufficient sleep indicators
  if (lifestyle < 4 && medHist > 3 && riskScore > 15) {
    recs.push({
      id: "sleep-recommendation",
      category: CATEGORIES.SLEEP,
      priority: PRIORITY.MEDIUM,
      title: "Insufficient Recovery Detected",
      message: "You had markers of fatigue—consider a short nap or earlier bedtime tonight to allow your body to recover.",
      actions: ["Plan for early bedtime", "Take a 20-minute power nap", "Limit screen use 1hr before bed"],
      popup: false,
    });
  }

  // 7. DIET & NUTRITION ALERTS: Low SpO2 or energy
  if (spo2 < 95) {
    recs.push({
      id: "nutrition-diet",
      category: CATEGORIES.NUTRITION,
      priority: spo2 < t.spo2_low ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: "Blood Oxygen Sub-optimal — Consider Nutrition",
      message: "Your blood oxygen is slightly low—consider a nutritious snack, light meal, or moving to a better-ventilated area.",
      actions: ["Eat a healthy, iron-rich snack", "Move to an open space with fresh air", "Take deep, controlled breaths"],
      popup: spo2 < t.spo2_very_low,
    });
  }

  // 8. STRESS & MENTAL HEALTH CHECK: Stress indicators
  if (hr > 100 && lifestyle < 6) {
    recs.push({
      id: "stress-mental-health",
      category: CATEGORIES.STRESS,
      priority: PRIORITY.MEDIUM,
      title: "Stress Indicators Detected",
      message: "Stress indicators detected—try a 5-minute breathing exercise to help lower your heart rate and center yourself.",
      actions: ["Try 4-7-8 breathing technique", "Listen to calming music", "Close your eyes for 2 minutes"],
      popup: false,
    });
  }

  // 9. PREVENTIVE HEALTH ALERTS: AI Score indicates mild risk
  if (riskScore >= t.risk_mild && riskScore < t.risk_moderate && recs.length === 0) {
    recs.push({
      id: "preventive-alert",
      category: CATEGORIES.PREVENTIVE,
      priority: PRIORITY.MEDIUM,
      title: "Mild Risk — Be Proactive",
      message: "Your AI score shows mild dehydration and fatigue—hydrate and take rest before symptoms appear.",
      actions: ["Increase water intake", "Avoid physical strain", "Monitor vitals for next 30 mins"],
      popup: false,
    });
  }

  // 10. ALL CLEAR: Normal stats
  if (recs.length === 0 && riskScore < 15) {
    recs.push({
      id: "status-excellent",
      category: CATEGORIES.PREVENTIVE,
      priority: PRIORITY.LOW,
      title: "Health Status: Excellent 👍",
      message: "All vitals are within optimal ranges. Maintain your current routine and stay hydrated.",
      actions: ["Stay consistent with your routine", "Keep hydrating"],
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
  const warningCount = riskHistory.filter((r) => r.risk >= 40 && r.risk < 75).length;

  let overallStatus = "Excellent";
  let statusColor = "#39ff14";
  if (avgRisk >= 65) {
    overallStatus = "Critical Attention Required";
    statusColor = "#ff003c";
  } else if (avgRisk >= 40) {
    overallStatus = "Needs Monitoring";
    statusColor = "#ffea00";
  } else if (avgRisk >= 15) {
    overallStatus = "Good / Stable";
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
