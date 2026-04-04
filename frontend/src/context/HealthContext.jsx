import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  buildFamilyEmergencyMessage,
  digitsOnlyPhone,
  getFamilyTrackerUrl,
} from "../utils/familyNotify.js";

import {
  generateRecommendations,
  generateDailySummary,
  PRIORITY,
} from "../utils/recommendationEngine.js";
import { NotificationService } from "../utils/notificationService.js";

const HealthContext = createContext(null);

const FAMILY_PHONE_KEY = "lifeguard_family_phone";

const API = "/api";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function randomWalk(prev, delta, lo, hi) {
  return clamp(prev + (Math.random() * 2 - 1) * delta, lo, hi);
}

async function fetchPredict(vitals) {
  const res = await fetch(`${API}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      heart_rate: vitals.heart_rate,
      spo2: vitals.spo2,
      temperature_c: vitals.temperature_c,
      medical_history: vitals.medical_history,
      lifestyle_score: vitals.lifestyle_score,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchNearestHospital(lat, lng) {
  const res = await fetch(`${API}/nearest-hospital`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** OSRM public demo — free, no key. Falls back to straight line if blocked. */
async function sendFamilyAlertCloud({ toPhone, message, latitude, longitude }) {
  const res = await fetch(`${API}/send-family-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_phone: toPhone,
      message,
      latitude,
      longitude,
    }),
  });
  return res.json();
}

async function fetchRoute(lat1, lng1, lat2, lng2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
}

export function HealthProvider({ children }) {
  const [vitals, setVitals] = useState({
    heart_rate: 74,
    spo2: 98,
    temperature_c: 36.7,
    medical_history: 0,
    lifestyle_score: 8,
  });
  const [prediction, setPrediction] = useState(null);
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    error: null,
  });
  const [hospital, setHospital] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [hrHistory, setHrHistory] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [familyPhone, setFamilyPhoneState] = useState(() => {
    try {
      return localStorage.getItem(FAMILY_PHONE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [recommendations, setRecommendations] = useState([]);
  const [activePopup, setActivePopup] = useState(null);
  const [snoozedIds, setSnoozedIds] = useState({});
  const [dailySummary, setDailySummary] = useState(null);
  const forceAbnormal = useRef(false);
  const tick = useRef(0);
  const wasHighRisk = useRef(false);
  const familyPhoneRef = useRef(familyPhone);
  familyPhoneRef.current = familyPhone;
  const popupQueue = useRef([]);

  const setFamilyPhone = useCallback((value) => {
    setFamilyPhoneState(value);
    try {
      localStorage.setItem(FAMILY_PHONE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const pushToast = useCallback((id, role, title, body) => {
    setToasts((t) => [...t, { id, role, title, body }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 12000);
  }, []);

  const runEmergencySideEffects = useCallback(
    async (pred, vit, loc) => {
      const lat = loc.latitude ?? 40.7128;
      const lng = loc.longitude ?? -74.006;
      console.log("[EMERGENCY — Patient] High risk detected. Seek immediate care.", {
        vitals: vit,
        risk: pred,
        location: { lat, lng },
      });
      console.log("[EMERGENCY — Family] Patient condition critical. Live location:", lat, lng, pred?.category);
      console.log("[EMERGENCY — Doctor/Hospital] Incoming emergency patient.", {
        vitals: vit,
        risk_score: pred?.risk_score,
        category: pred?.category,
        location: { lat, lng },
      });

      const hid = `patient-${Date.now()}`;
      pushToast(hid, "patient", "Patient alert", "Check on-screen emergency instructions.");

      let h = null;
      try {
        const { hospital: nearest } = await fetchNearestHospital(lat, lng);
        h = nearest;
        setHospital(h);
        let route = null;
        if (h) {
          route = await fetchRoute(lat, lng, h.latitude, h.longitude);
        }
        if (!route) {
          route = [
            [lat, lng],
            [h?.latitude ?? lat + 0.02, h?.longitude ?? lng + 0.02],
          ];
        }
        setRouteCoords(route);
      } catch (e) {
        console.warn("Hospital/route fetch failed", e);
        h = {
          name: "Nearest Hospital (offline mock)",
          latitude: lat + 0.02,
          longitude: lng + 0.02,
          approx_distance_km: 2.5,
        };
        setHospital(h);
        setRouteCoords([
          [lat, lng],
          [lat + 0.02, lng + 0.02],
        ]);
      }

      // Trigger Native Notification för Patient
      const hospitalName = h?.name || "the nearest hospital";
      NotificationService.schedule(
        "🚨 Emergency Alert",
        `High risk detected! HR: ${vit.heart_rate} BPM. Seek immediate care at ${hospitalName}.`,
        { type: "emergency", vitals: vit, pred }
      );

      const ts = Date.now();
      const phoneRaw = familyPhoneRef.current?.trim() ?? "";
      const phoneDigits = digitsOnlyPhone(phoneRaw);
      const trackerUrl = getFamilyTrackerUrl();
      const familyMsg = buildFamilyEmergencyMessage({
        vitals: vit,
        pred,
        lat,
        lng,
        trackerUrl,
      });

      if (phoneDigits.length >= 10) {
        const toPhone = phoneRaw.startsWith("+")
          ? phoneRaw.replace(/\s/g, "")
          : `+${phoneDigits}`;
        let cloud = { ok: false, error: "unknown" };
        try {
          cloud = await sendFamilyAlertCloud({
            toPhone,
            message: familyMsg,
            latitude: lat,
            longitude: lng,
          });
        } catch (e) {
          cloud = { ok: false, error: "browser_network", detail: String(e?.message || e) };
        }
        console.log("[Family — cloud WhatsApp]", cloud);

        if (cloud.ok) {
          const ref = cloud.message_sid || cloud.message_id || "";
          pushToast(
            `family-wa-${ts}`,
            "family",
            "Family notified (WhatsApp — cloud)",
            `Message sent automatically via ${cloud.provider || "cloud"}. ${ref ? `Ref: ${ref}. ` : ""}Tracker: ${trackerUrl}`
          );
        } else if (cloud.error === "not_configured") {
          pushToast(
            `family-wa-${ts}`,
            "family",
            "Cloud WhatsApp not configured",
            `Server must set TWILIO_* or WHATSAPP_CLOUD_* env vars. See backend/WHATSAPP_SETUP.txt. Tracker link: ${trackerUrl}`
          );
        } else {
          pushToast(
            `family-wa-${ts}`,
            "family",
            "WhatsApp cloud send failed",
            `${cloud.detail || cloud.error || "Error"}. Check server logs and Twilio/Meta console. Tracker: ${trackerUrl}`
          );
        }
      } else {
        pushToast(
          `family-${ts}`,
          "family",
          "Family phone missing",
          `Add family number (country code, 10+ digits) to send WhatsApp from cloud. Status: ${pred?.category} (${pred?.risk_score}). GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Link: ${trackerUrl}`
        );
      }
      pushToast(
        `doctor-${ts}`,
        "doctor",
        "Hospital / doctor alert (simulated)",
        `Incoming emergency — HR ${vit.heart_rate}, SpO₂ ${vit.spo2}%, Temp ${vit.temperature_c}°C. Prepare bay.`
      );

      setPatientModalOpen(true);
      setEmergencyActive(true);
    },
    [pushToast]
  );

  const processRecommendations = useCallback((vit, pred) => {
    const recs = generateRecommendations(vit, pred);
    setRecommendations(recs);

    // Queue popup for the highest-priority recommendation that wants one
    const now = Date.now();
    const popupRec = recs.find(
      (r) => r.popup && r.priority >= PRIORITY.HIGH && !snoozedIds[r.id]
    );
    if (popupRec && (!activePopup || activePopup.id !== popupRec.id)) {
      setActivePopup(popupRec);
      
      // Trigger Native Notification for Suggestion
      NotificationService.schedule(
        `Health Suggestion: ${popupRec.title}`,
        popupRec.message,
        { type: "suggestion", recId: popupRec.id }
      );
    } else if (!popupRec) {
      setActivePopup(null);
    }
  }, [snoozedIds, activePopup]);

  const dismissPopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  const snoozePopup = useCallback(() => {
    if (activePopup) {
      const id = activePopup.id;
      setSnoozedIds((prev) => ({ ...prev, [id]: Date.now() + 5 * 60 * 1000 }));
      setActivePopup(null);
    }
  }, [activePopup]);

  // Clean expired snoozes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSnoozedIds((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id] <= now) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshDailySummary = useCallback(() => {
    const s = generateDailySummary(hrHistory, riskHistory, vitals, prediction);
    setDailySummary(s);
  }, [hrHistory, riskHistory, vitals, prediction]);

  const predictAndReact = useCallback(
    async (vit, locSnapshot) => {
      try {
        setLastError(null);
        const pred = await fetchPredict(vit);
        setPrediction(pred);
        const t = tick.current++;
        setHrHistory((h) => [...h.slice(-59), { t, hr: vit.heart_rate }]);
        setRiskHistory((h) => [...h.slice(-59), { t, risk: pred.risk_score }]);

        // Process AI recommendations
        processRecommendations(vit, pred);

        if (pred.category === "High Risk") {
          if (!wasHighRisk.current) {
            wasHighRisk.current = true;
            await runEmergencySideEffects(pred, vit, locSnapshot);
          }
        } else {
          wasHighRisk.current = false;
          setEmergencyActive(false);
          setPatientModalOpen(false);
          setHospital(null);
          setRouteCoords(null);
        }
      } catch (e) {
        setLastError(String(e.message || e));
        console.error(e);
      }
    },
    [runEmergencySideEffects, processRecommendations]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((l) => ({ ...l, error: "Geolocation not supported" }));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          error: null,
        });
      },
      (err) => {
        setLocation({
          latitude: 40.7128,
          longitude: -74.006,
          error: `Using demo NYC coords (${err.message})`,
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVitals((v) => {
        let next = { ...v };
        if (forceAbnormal.current) {
          next = {
            ...next,
            heart_rate: 130,
            spo2: 85,
            temperature_c: 38.9,
          };
        } else {
          next = {
            ...next,
            heart_rate: Math.round(randomWalk(v.heart_rate, 4, 58, 105)),
            spo2: Math.round(randomWalk(v.spo2, 0.8, 94, 100) * 10) / 10,
            temperature_c:
              Math.round(randomWalk(v.temperature_c, 0.12, 36.2, 37.8) * 10) / 10,
          };
        }
        const loc = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        predictAndReact(next, loc);
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [predictAndReact, location.latitude, location.longitude]);

  const simulateEmergency = useCallback(() => {
    wasHighRisk.current = false;
    forceAbnormal.current = true;
    setVitals((v) => {
      const vit = {
        ...v,
        heart_rate: 130,
        spo2: 85,
        temperature_c: 39.1,
      };
      predictAndReact(vit, {
        latitude: location.latitude ?? 40.7128,
        longitude: location.longitude ?? -74.006,
      });
      return vit;
    });
  }, [predictAndReact, location.latitude, location.longitude]);

  const resumeSimulation = useCallback(() => {
    forceAbnormal.current = false;
    wasHighRisk.current = false;
    setPatientModalOpen(false);
    setEmergencyActive(false);
    setHospital(null);
    setRouteCoords(null);
  }, []);

  const value = {
    vitals,
    prediction,
    location,
    hospital,
    routeCoords,
    emergencyActive,
    patientModalOpen,
    setPatientModalOpen,
    toasts,
    hrHistory,
    riskHistory,
    lastError,
    familyPhone,
    setFamilyPhone,
    simulateEmergency,
    resumeSimulation,
    setVitals,
    // AI Recommendations
    recommendations,
    activePopup,
    dismissPopup,
    snoozePopup,
    dailySummary,
    refreshDailySummary,
  };

  return (
    <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth outside HealthProvider");
  return ctx;
}
