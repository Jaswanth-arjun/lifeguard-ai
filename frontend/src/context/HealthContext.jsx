import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabaseClient.js";
import {
  buildFamilyEmergencyMessage,
  digitsOnlyPhone,
  getFamilyTrackerUrl,
  openWhatsAppWithMessage,
} from "../utils/familyNotify.js";

import {
  generateRecommendations,
  generateDailySummary,
  PRIORITY,
} from "../utils/recommendationEngine.js";
import { NotificationService } from "../utils/notificationService.js";

const HealthContext = createContext(null);

const FAMILY_PHONE_KEY = "lifeguard_family_phone";
const API = "https://lifeguard-ai-arpd.onrender.com/api";

function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  return fetch(`${API}${path}`, { ...options, headers });
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function randomWalk(prev, delta, lo, hi) {
  return clamp(prev + (Math.random() * 2 - 1) * delta, lo, hi);
}

async function fetchPredict(vitals) {
  const res = await apiFetch(`/predict`, {
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
  const res = await apiFetch(`/nearest-hospital`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sendFamilyAlertCloud({ toPhone, message, latitude, longitude }) {
  const res = await apiFetch(`/send-family-alert`, {
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

async function resolveRole(session) {
  if (!session) return null;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (!error && profile?.role) return profile.role;
  } catch (e) {
    console.warn("[HealthContext] profiles query failed:", e);
  }
  const metaRole = session.user?.user_metadata?.role;
  if (metaRole) return metaRole;
  const hash = window.location.hash || "";
  if (hash.includes("/patient")) return "patient";
  if (hash.includes("/family")) return "family";
  if (hash.includes("/doctor")) return "doctor";
  return "patient";
}

async function resolvePatientRecordId(session, role) {
  if (!session) return null;
  if (role === 'patient') {
    try {
      const { data } = await supabase.from('patients').select('id').eq('profile_id', session.user.id).single();
      if (data?.id) return data.id;
    } catch (e) { console.warn("[HealthContext] patients query failed:", e); }
    return null;
  }
  if (role === 'family') {
    try {
      const { data: links } = await supabase.from('family_patient_links').select('patient_id').eq('family_profile_id', session.user.id).limit(1);
      if (links && links.length > 0) return links[0].patient_id;
    } catch (e) { console.warn("[HealthContext] family_patient_links query failed:", e); }
    return null;
  }
  if (role === 'doctor') {
    try {
      const { data: links } = await supabase.from('doctor_patient_links').select('patient_id').eq('doctor_profile_id', session.user.id).limit(1);
      if (links && links.length > 0) return links[0].patient_id;
    } catch (e) { console.warn("[HealthContext] doctor_patient_links query failed:", e); }
    return null;
  }
  return null;
}

export function HealthProvider({ children }) {
  const [role, setRole] = useState(null);
  const [patientRecordId, setPatientRecordId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [vitals, setVitals] = useState({
    heart_rate: 74,
    spo2: 98,
    temperature_c: 36.7,
    medical_history: 0,
    lifestyle_score: 8,
  });
  const [prediction, setPrediction] = useState(null);
  const [location, setLocation] = useState({ latitude: null, longitude: null, error: null });
  const [hospital, setHospital] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [hrHistory, setHrHistory] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [familyPhone, setFamilyPhoneState] = useState(() => {
    try { return localStorage.getItem(FAMILY_PHONE_KEY) ?? ""; } catch { return ""; }
  });
  const [recommendations, setRecommendations] = useState([]);
  const [activePopup, setActivePopup] = useState(null);
  const [snoozedIds, setSnoozedIds] = useState({});
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [dailySummary, setDailySummary] = useState(null);

  // ── Critical refs ──
  const forceAbnormal = useRef(false);
  const tick = useRef(0);
  const wasHighRisk = useRef(false);
  const familyPhoneRef = useRef(familyPhone);
  familyPhoneRef.current = familyPhone;

  // FIX 1: Prevent overlapping API calls — if a predict is in-flight, skip the next tick
  const predictInFlight = useRef(false);

  // FIX 2: Track whether we already sent notifications for THIS emergency session
  const emergencyNotified = useRef(false);

  // FIX 3: Throttle recommendation notifications — max once per 60 seconds
  const lastRecNotificationTime = useRef(0);

  // ── Auth Init ──
  useEffect(() => {
    let isMounted = true;
    const initAuth = async (session) => {
      if (!isMounted) return;
      if (!session) {
        setRole(null); setPatientRecordId(null); setUserId(null); setAuthReady(true);
        return;
      }
      setUserId(session.user.id);
      const resolvedRole = await resolveRole(session);
      if (!isMounted) return;
      setRole(resolvedRole);
      const pid = await resolvePatientRecordId(session, resolvedRole);
      if (!isMounted) return;
      setPatientRecordId(pid);
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({ data: { session } }) => initAuth(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => initAuth(session));
    return () => { isMounted = false; subscription?.unsubscribe(); };
  }, []);

  const setFamilyPhone = useCallback((value) => {
    setFamilyPhoneState(value);
    try { localStorage.setItem(FAMILY_PHONE_KEY, value); } catch { /* ignore */ }
  }, []);

  const pushToast = useCallback((id, msgRole, title, body) => {
    setToasts((t) => [...t, { id, role: msgRole, title, body }]);
    setTimeout(() => { setToasts((t) => t.filter((x) => x.id !== id)); }, 12000);
  }, []);

  // ── Emergency side effects (runs ONCE per emergency) ──
  const runEmergencySideEffects = useCallback(
    async (pred, vit, loc) => {
      // Capture concrete values immediately to prevent any stale/undefined issues
      const hr = vit?.heart_rate ?? 130;
      const sp = vit?.spo2 ?? 85;
      const tc = vit?.temperature_c ?? 38.9;
      const riskScore = pred?.risk_score ?? 0;
      const riskCat = pred?.category ?? "High Risk";
      const lat = loc?.latitude ?? 40.7128;
      const lng = loc?.longitude ?? -74.006;
      const trackerUrl = getFamilyTrackerUrl();

      console.log("[Emergency] Vitals snapshot:", { hr, sp, tc, riskScore, riskCat, lat, lng });

      pushToast(`patient-${Date.now()}`, "patient", "Patient alert", "Check on-screen emergency instructions.");

      let h = null;
      try {
        const { hospital: nearest } = await fetchNearestHospital(lat, lng);
        h = nearest;
        setHospital(h);
        let route = await fetchRoute(lat, lng, h.latitude, h.longitude);
        if (!route) {
          route = [[lat, lng], [h?.latitude ?? lat + 0.02, h?.longitude ?? lng + 0.02]];
        }
        setRouteCoords(route);
      } catch (e) {
        h = { name: "Nearest Hospital (offline mock)", latitude: lat + 0.02, longitude: lng + 0.02, approx_distance_km: 2.5 };
        setHospital(h);
        setRouteCoords([[lat, lng], [lat + 0.02, lng + 0.02]]);
      }

      // Native notification — fires ONE time only
      if (!emergencyNotified.current) {
        emergencyNotified.current = true;
        const hospitalName = h?.name || "the nearest hospital";
        NotificationService.schedule(
          "🚨 Emergency Alert",
          `High risk detected! HR: ${hr} BPM. Seek immediate care at ${hospitalName}.`,
          { type: "emergency" }
        );
      }

      // WhatsApp — ONLY if patient explicitly clicked Simulate Emergency
      if (familyPhoneRef.current && role === 'patient' && forceAbnormal.current) {
        // Build message with concrete captured values — no references to objects that could be stale
        const latStr = typeof lat === "number" ? lat.toFixed(5) : String(lat);
        const lngStr = typeof lng === "number" ? lng.toFixed(5) : String(lng);
        const whatsappMsg = [
          "🚨 EMERGENCY — Patient health alert (AI monitoring)",
          `Status: ${riskCat} (risk score ${riskScore})`,
          `Vitals: HR ${hr} bpm, SpO₂ ${sp}%, Temp ${tc}°C`,
          `Last known GPS: ${latStr}, ${lngStr}`,
          `Open Family Tracker (live map): ${trackerUrl}`,
        ].join("\n");

        console.log("[Emergency] WhatsApp message:", whatsappMsg);

        sendFamilyAlertCloud({
          toPhone: familyPhoneRef.current,
          message: whatsappMsg,
          latitude: lat,
          longitude: lng
        }).catch(err => console.error("[HealthContext] WhatsApp Error:", err));
      }

      // Supabase alert — ONLY if patient explicitly clicked Simulate Emergency
      if (role === 'patient' && patientRecordId && forceAbnormal.current) {
        supabase.from('emergency_alerts').insert([{
          patient_id: patientRecordId,
          triggered_by: "high_risk_prediction",
          severity: "critical",
          status: "open"
        }]).then(({ error }) => {
          if (error) console.warn("[HealthContext] Emergency alert insert error:", error);
        });
      }

      setPatientModalOpen(true);
      setEmergencyActive(true);
    },
    [pushToast, role, patientRecordId]
  );

  // ── Recommendation processing (with throttled notifications) ──
  const processRecommendations = useCallback((vit, pred) => {
    // FIX: Skip recommendation popups entirely during active emergency
    if (forceAbnormal.current) return;

    const recs = generateRecommendations(vit, pred);
    setRecommendations(recs);

    const popupRec = recs.find(
      (r) => r.popup && r.priority >= PRIORITY.HIGH && !snoozedIds[r.id] && !dismissedIds.has(r.id)
    );

    if (popupRec && (!activePopup || activePopup.id !== popupRec.id)) {
      setActivePopup(popupRec);
      // FIX 3: Only fire native notification at most once per 60 seconds
      const now = Date.now();
      if (now - lastRecNotificationTime.current > 60000) {
        lastRecNotificationTime.current = now;
        NotificationService.schedule(
          `Health Suggestion: ${popupRec.title}`,
          popupRec.message,
          { type: "suggestion", recId: popupRec.id }
        );
      }
    } else if (!popupRec) {
      setActivePopup(null);
    }
  }, [snoozedIds, dismissedIds, activePopup]);

  const dismissPopup = useCallback(() => {
    if (activePopup) {
      setDismissedIds((prev) => new Set(prev).add(activePopup.id));
      setActivePopup(null);
    }
  }, [activePopup]);

  const snoozePopup = useCallback(() => {
    if (activePopup) {
      const id = activePopup.id;
      setSnoozedIds((prev) => ({ ...prev, [id]: Date.now() + 5 * 60 * 1000 }));
      setActivePopup(null);
    }
  }, [activePopup]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSnoozedIds((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id] <= now) { delete next[id]; changed = true; }
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

  // ── Core predict & react ──
  const predictAndReact = useCallback(
    async (vit, locSnapshot) => {
      // FIX 1: If a prediction is already in-flight, skip this tick entirely
      if (predictInFlight.current) return null;
      predictInFlight.current = true;

      try {
        setLastError(null);
        const pred = await fetchPredict(vit);
        setPrediction(pred);
        const t = tick.current++;
        setHrHistory((h) => [...h.slice(-59), { t, hr: vit.heart_rate }]);
        setRiskHistory((h) => [...h.slice(-59), { t, risk: pred.risk_score }]);

        processRecommendations(vit, pred);

        if (pred.category === "High Risk") {
          if (!wasHighRisk.current) {
            wasHighRisk.current = true;
            await runEmergencySideEffects(pred, vit, locSnapshot);
          }
          // FIX 2: Do NOT touch emergencyActive here — it stays true until manual clear
        } else {
          // FIX 2: Only clear emergency state if forceAbnormal is OFF
          // If forceAbnormal is on, keep emergency active (the API might briefly return non-high-risk
          // due to network jitter — we don't want flickering)
          if (!forceAbnormal.current) {
            wasHighRisk.current = false;
            // Don't reset emergency state here — only resumeSimulation clears it
          }
        }

        return pred;
      } catch (e) {
        setLastError(String(e.message || e));
        console.error("[HealthContext] predictAndReact error:", e);
        return null;
      } finally {
        // FIX 1: Always release the lock
        predictInFlight.current = false;
      }
    },
    [runEmergencySideEffects, processRecommendations]
  );

  // ── Geolocation ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((l) => ({ ...l, error: "Geolocation not supported" }));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, error: null });
      },
      (err) => {
        setLocation({ latitude: 40.7128, longitude: -74.006, error: `Using demo NYC coords (${err.message})` });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Keep refs fresh
  const locationRef = useRef(location);
  const predictAndReactRef = useRef(predictAndReact);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { predictAndReactRef.current = predictAndReact; }, [predictAndReact]);

  // ── PATIENT-ONLY SIMULATOR: simulate vitals, predict, upload to Supabase ──
  useEffect(() => {
    if (!authReady || role !== 'patient') {
      console.log("[HealthContext] Simulation skipped (role:", role, ")");
      return;
    }

    console.log("[HealthContext] ✅ Starting PATIENT vitals simulation.");

    const interval = setInterval(() => {
      setVitals((v) => {
        let next = { ...v };
        if (forceAbnormal.current) {
          next = { ...next, heart_rate: 130, spo2: 85, temperature_c: 38.9 };
        } else {
          next = {
            ...next,
            heart_rate: Math.round(randomWalk(v.heart_rate, 4, 58, 105)),
            spo2: Math.round(randomWalk(v.spo2, 0.8, 94, 100) * 10) / 10,
            temperature_c: Math.round(randomWalk(v.temperature_c, 0.12, 36.2, 37.8) * 10) / 10,
          };
        }

        const loc = { latitude: locationRef.current.latitude, longitude: locationRef.current.longitude };

        predictAndReactRef.current(next, loc).then((pred) => {
          if (patientRecordId && pred) {
            supabase.from('vitals').insert([{
              patient_id: patientRecordId,
              heart_rate: next.heart_rate,
              spo2: next.spo2,
              temperature: next.temperature_c,
              risk_score: pred.risk_score || 0
            }]).then(({ error }) => {
              if (error) console.warn("[HealthContext] Vitals upload error:", error.message);
            });

            if (loc.latitude) {
              supabase.from('locations').insert([{
                patient_id: patientRecordId,
                lat: loc.latitude,
                lng: loc.longitude,
                accuracy: 10
              }]).then(({ error }) => {
                if (error) console.warn("[HealthContext] Location upload error:", error.message);
              });
            }
          }
        });

        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [authReady, role, patientRecordId]);

  // ── FAMILY/DOCTOR RECEIVER ──
  useEffect(() => {
    if (!authReady) return;
    if (role !== 'family' && role !== 'doctor') return;
    if (!patientRecordId) return;

    console.log("[HealthContext] ✅ Family/Doctor subscribing to realtime for patient:", patientRecordId);
    const filterString = `patient_id=eq.${patientRecordId}`;

    // Fetch latest vitals
    supabase.from('vitals')
      .select('heart_rate, spo2, temperature, risk_score')
      .eq('patient_id', patientRecordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const latest = data[0];
          setVitals({
            heart_rate: latest.heart_rate,
            spo2: latest.spo2,
            temperature_c: latest.temperature,
            medical_history: 0,
            lifestyle_score: 8,
          });
        }
      });

    // Subscribe to Vitals — family/doctor get the EXACT same values the patient uploaded
    const vitalsSub = supabase.channel(`realtime-vitals-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vitals', filter: filterString }, (payload) => {
        const newVitals = {
          heart_rate: payload.new.heart_rate,
          spo2: payload.new.spo2,
          temperature_c: payload.new.temperature,
          medical_history: 0,
          lifestyle_score: 8
        };
        setVitals(newVitals);
        // Update prediction + chart history from the exact risk_score the patient computed
        if (payload.new.risk_score != null) {
          const score = payload.new.risk_score;
          const category = score >= 70 ? "High Risk" : score >= 40 ? "Warning" : "Normal";
          setPrediction({ risk_score: score, category });
          const t = tick.current++;
          setHrHistory((h) => [...h.slice(-59), { t, hr: payload.new.heart_rate }]);
          setRiskHistory((h) => [...h.slice(-59), { t, risk: score }]);
        }
      }).subscribe();

    // Subscribe to Emergency Alerts
    const alertsSub = supabase.channel(`realtime-alerts-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_alerts', filter: filterString }, (payload) => {
        setEmergencyActive(true);
        pushToast(`alert-${Date.now()}`, role, `URGENT ALERT: Patient in Distress!`, `Triggered by: ${payload.new.triggered_by}. Severity: ${payload.new.severity}`);
        // Only fire one notification
        NotificationService.schedule(
          "🚨 PATIENT EMERGENCY",
          `A linked patient has triggered a high severity alert!`,
          { type: "remote_emergency" }
        );
      }).subscribe();

    // Fetch latest location
    supabase.from('locations')
      .select('lat, lng')
      .eq('patient_id', patientRecordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLocation(prev => ({ ...prev, latitude: data[0].lat, longitude: data[0].lng }));
        }
      });

    // Subscribe to location updates
    const locationSub = supabase.channel(`realtime-locations-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations', filter: filterString }, (payload) => {
        setLocation(prev => ({ ...prev, latitude: payload.new.lat, longitude: payload.new.lng }));
      }).subscribe();

    return () => {
      supabase.removeChannel(vitalsSub);
      supabase.removeChannel(alertsSub);
      supabase.removeChannel(locationSub);
    };
  }, [authReady, role, patientRecordId, pushToast]);

  // ── Actions ──
  const simulateEmergency = useCallback(() => {
    wasHighRisk.current = false;
    emergencyNotified.current = false; // Reset so ONE notification fires for this new emergency
    forceAbnormal.current = true;
  }, []);

  const resumeSimulation = useCallback(() => {
    forceAbnormal.current = false;
    wasHighRisk.current = false;
    emergencyNotified.current = false;
    predictInFlight.current = false;
    setPatientModalOpen(false);
    setEmergencyActive(false);
    setHospital(null);
    setRouteCoords(null);
  }, []);

  const value = {
    vitals,
    prediction,
    patientRecordId,
    role,
    authReady,
    apiBase: API,
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
