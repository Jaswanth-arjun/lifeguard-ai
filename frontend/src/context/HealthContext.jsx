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
const API_BASE_KEY = "lifeguard_api_base";
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

/** OSRM public demo — free, no key. Falls back to straight line if blocked. */
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

export function HealthProvider({ children }) {
  const [role, setRole] = useState(null);
  const [patientRecordId, setPatientRecordId] = useState(null);
  const [userId, setUserId] = useState(null);

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
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [dailySummary, setDailySummary] = useState(null);
  const forceAbnormal = useRef(false);
  const tick = useRef(0);
  const wasHighRisk = useRef(false);
  const familyPhoneRef = useRef(familyPhone);
  familyPhoneRef.current = familyPhone;
  const popupQueue = useRef([]);

  // Fetch Supabase Session and Role
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile) setRole(profile.role);

      // If patient, fetch their specific patients table ID (the primary key 'id')
      if (profile?.role === 'patient') {
        const { data: patientRecord } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', session.user.id)
          .single();
        if (patientRecord) setPatientRecordId(patientRecord.id);
      }
    };
    initAuth();
  }, []);

  const setFamilyPhone = useCallback((value) => {
    setFamilyPhoneState(value);
    try {
      localStorage.setItem(FAMILY_PHONE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const pushToast = useCallback((id, msgRole, title, body) => {
    setToasts((t) => [...t, { id, role: msgRole, title, body }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 12000);
  }, []);

  const runEmergencySideEffects = useCallback(
    async (pred, vit, loc) => {
      const lat = loc.latitude ?? 40.7128;
      const lng = loc.longitude ?? -74.006;
      
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

      // Trigger Native Notification
      const hospitalName = h?.name || "the nearest hospital";
      NotificationService.schedule(
        "🚨 Emergency Alert",
        `High risk detected! HR: ${vit.heart_rate} BPM. Seek immediate care at ${hospitalName}.`,
        { type: "emergency", vitals: vit, pred }
      );

      // Insert into Supabase Alerts Table so family/doctors receive the push naturally
      if (role === 'patient' && patientRecordId) {
        await supabase.from('emergency_alerts').insert([{
           patient_id: patientRecordId,
           triggered_by: "high_risk_prediction",
           severity: "critical",
           status: "open"
        }]);
      }

      setPatientModalOpen(true);
      setEmergencyActive(true);
    },
    [pushToast, role, patientRecordId]
  );

  const processRecommendations = useCallback((vit, pred) => {
    const recs = generateRecommendations(vit, pred);
    setRecommendations(recs);

    // Queue popup for the highest-priority recommendation that wants one
    const popupRec = recs.find(
      (r) => r.popup && r.priority >= PRIORITY.HIGH && !snoozedIds[r.id] && !dismissedIds.has(r.id)
    );
    if (popupRec && (!activePopup || activePopup.id !== popupRec.id)) {
      setActivePopup(popupRec);
      NotificationService.schedule(
        `Health Suggestion: ${popupRec.title}`,
        popupRec.message,
        { type: "suggestion", recId: popupRec.id }
      );
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
        
        return pred;
      } catch (e) {
        setLastError(String(e.message || e));
        console.error(e);
        return null;
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

  // SENDER LOGIC: Patient creates simulation data and pushes to Supabase
  useEffect(() => {
    if (role !== 'patient' || !patientRecordId) return;

    const interval = setInterval(async () => {
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
        const loc = { latitude: location.latitude, longitude: location.longitude };
        
        // Let React state update locally immediately
        predictAndReact(next, loc).then((pred) => {
           // Now push to Supabase Vitals Table
           if (patientRecordId) {
             supabase.from('vitals').insert([{
                patient_id: patientRecordId,
                heart_rate: next.heart_rate,
                spo2: next.spo2,
                temperature: next.temperature_c,
                risk_score: pred?.risk_score || 0
             }]).catch(err => console.error("Supabase vitals upload error:", err));
             
             if (loc.latitude) {
               supabase.from('locations').insert([{
                  patient_id: patientRecordId,
                  lat: loc.latitude,
                  lng: loc.longitude,
                  accuracy: 10
               }]).catch(err => console.error("Supabase locations upload error:", err));
             }
           }
        });
        
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [role, patientRecordId, predictAndReact, location.latitude, location.longitude]);

  // RECEIVER LOGIC: Family and Doctor listen to Supabase Realtime changes
  useEffect(() => {
    if (role !== 'family' && role !== 'doctor') return;
    
    // Subscribe to new Vitals
    const vitalsSub = supabase.channel('realtime-vitals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vitals' }, (payload) => {
         const newVitals = {
            heart_rate: payload.new.heart_rate,
            spo2: payload.new.spo2,
            temperature_c: payload.new.temperature,
            medical_history: 0,
            lifestyle_score: 8
         };
         setVitals(newVitals);
         predictAndReact(newVitals, location); 
      }).subscribe();

    // Subscribe to Emergency Alerts
    const alertsSub = supabase.channel('realtime-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_alerts' }, (payload) => {
         setEmergencyActive(true);
         pushToast(`alert-${Date.now()}`, role, `URGENT ALERT: Patient in Distress!`, `Triggered by: ${payload.new.triggered_by}. Severity: ${payload.new.severity}`);
         // Sound Native Notification
         NotificationService.schedule(
           "🚨 PATIENT EMERGENCY",
           `A linked patient has triggered a high severity alert!`,
           { type: "remote_emergency" }
         );
      }).subscribe();

    return () => {
      supabase.removeChannel(vitalsSub);
      supabase.removeChannel(alertsSub);
    };
  }, [role, location, pushToast, predictAndReact]);

  const simulateEmergency = useCallback(() => {
    wasHighRisk.current = false;
    forceAbnormal.current = true;
  }, []);

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
