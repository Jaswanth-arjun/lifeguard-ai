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

/**
 * Resolves the user role with multiple fallback layers:
 * 1. profiles table (primary)
 * 2. user_metadata from JWT (fallback)
 * 3. URL hash path (last resort)
 */
async function resolveRole(session) {
  if (!session) return null;

  // Try profiles table first
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!error && profile?.role) {
      console.log("[HealthContext] Role from profiles table:", profile.role);
      return profile.role;
    }
  } catch (e) {
    console.warn("[HealthContext] profiles query failed:", e);
  }

  // Fallback to user_metadata
  const metaRole = session.user?.user_metadata?.role;
  if (metaRole) {
    console.log("[HealthContext] Role from user_metadata:", metaRole);
    return metaRole;
  }

  // Last resort: infer from URL hash
  const hash = window.location.hash || "";
  if (hash.includes("/patient")) return "patient";
  if (hash.includes("/family")) return "family";
  if (hash.includes("/doctor")) return "doctor";

  return "patient"; // absolute default
}

/**
 * Resolves the patient record ID (patients table PK) for a patient user.
 * Falls back gracefully if the table doesn't exist or RLS blocks.
 */
async function resolvePatientRecordId(session, role) {
  if (!session) return null;

  if (role === 'patient') {
    try {
      const { data } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', session.user.id)
        .single();
      if (data?.id) return data.id;
    } catch (e) {
      console.warn("[HealthContext] patients query failed:", e);
    }
    return null;
  }

  if (role === 'family') {
    try {
      const { data: links } = await supabase
        .from('family_patient_links')
        .select('patient_id')
        .eq('family_profile_id', session.user.id)
        .limit(1);
      if (links && links.length > 0) return links[0].patient_id;
    } catch (e) {
      console.warn("[HealthContext] family_patient_links query failed:", e);
    }
    return null;
  }

  if (role === 'doctor') {
    try {
      const { data: links } = await supabase
        .from('doctor_patient_links')
        .select('patient_id')
        .eq('doctor_profile_id', session.user.id)
        .limit(1);
      if (links && links.length > 0) return links[0].patient_id;
    } catch (e) {
      console.warn("[HealthContext] doctor_patient_links query failed:", e);
    }
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

  // ── Auth Init: resolve role + patientRecordId ──
  useEffect(() => {
    let isMounted = true;

    const initAuth = async (session) => {
      if (!isMounted) return;

      if (!session) {
        console.log("[HealthContext] No session found");
        setRole(null);
        setPatientRecordId(null);
        setUserId(null);
        setAuthReady(true);
        return;
      }

      setUserId(session.user.id);
      console.log("[HealthContext] Session user:", session.user.id);

      const resolvedRole = await resolveRole(session);
      if (!isMounted) return;
      console.log("[HealthContext] Resolved role:", resolvedRole);
      setRole(resolvedRole);

      const pid = await resolvePatientRecordId(session, resolvedRole);
      if (!isMounted) return;
      console.log("[HealthContext] Resolved patientRecordId:", pid);
      setPatientRecordId(pid);

      setAuthReady(true);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      initAuth(session);
    });

    // Listen for auth changes (like after logging in from Auth.jsx)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      initAuth(session);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
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

      // Trigger Twilio/WhatsApp cloud API alert
      if (familyPhoneRef.current) {
        try {
          const msg = buildFamilyEmergencyMessage(vit, loc, h, pred);
          sendFamilyAlertCloud({
            toPhone: familyPhoneRef.current,
            message: msg || `🚨 URGENT EMERGENCY: High Risk Detected! HR: ${vit.heart_rate} BPM, SpO2: ${vit.spo2}%. Please track live location immediately.`,
            latitude: lat,
            longitude: lng
          }).catch(err => console.error("[HealthContext] Async WhatsApp Delivery Error:", err));
        } catch (e) {
          console.error("[HealthContext] Failed to format or send WhatsApp alert:", e);
        }
      }

      // Insert into Supabase Alerts Table so family/doctors receive the push naturally
      if (role === 'patient' && patientRecordId) {
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
        console.error("[HealthContext] predictAndReact error:", e);
        return null;
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

  // Keep refs to avoid continuous re-triggers of the intervals
  const locationRef = useRef(location);
  const predictAndReactRef = useRef(predictAndReact);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    predictAndReactRef.current = predictAndReact;
  }, [predictAndReact]);

  // ── PATIENT SENDER: simulate vitals + push to Supabase ──
  // Runs as soon as role resolves to 'patient' — does NOT wait for patientRecordId
  useEffect(() => {
    if (!authReady || role !== 'patient') {
      console.log("[HealthContext] Patient simulation NOT starting. authReady:", authReady, "role:", role);
      return;
    }

    console.log("[HealthContext] ✅ Starting patient vitals simulation. patientRecordId:", patientRecordId);

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
        
        const loc = { 
          latitude: locationRef.current.latitude, 
          longitude: locationRef.current.longitude 
        };
        
        // Predict locally for UI
        predictAndReactRef.current(next, loc).then((pred) => {
           // Upload to Supabase only if we have a patientRecordId
           if (patientRecordId) {
             supabase.from('vitals').insert([{
                patient_id: patientRecordId,
                heart_rate: next.heart_rate,
                spo2: next.spo2,
                temperature: next.temperature_c,
                risk_score: pred?.risk_score || 0
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
  }, [authReady, role, patientRecordId]); // REMOVED predictAndReact and location.latitude/longitude

  // ── FAMILY/DOCTOR RECEIVER: listen to linked patient's Supabase Realtime ──
  useEffect(() => {
    if (!authReady) return;
    if (role !== 'family' && role !== 'doctor') return;
    if (!patientRecordId) {
      console.log("[HealthContext] Family/Doctor: no patientRecordId, not subscribing to realtime");
      return;
    }
    
    console.log("[HealthContext] ✅ Family/Doctor subscribing to realtime for patient:", patientRecordId);
    const filterString = `patient_id=eq.${patientRecordId}`;

    // Also fetch LATEST vitals row first so we don't show stale defaults
    supabase.from('vitals')
      .select('heart_rate, spo2, temperature, risk_score')
      .eq('patient_id', patientRecordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const latest = data[0];
          const fetchedVitals = {
            heart_rate: latest.heart_rate,
            spo2: latest.spo2,
            temperature_c: latest.temperature,
            medical_history: 0,
            lifestyle_score: 8,
          };
          console.log("[HealthContext] Loaded latest vitals from DB:", fetchedVitals);
          setVitals(fetchedVitals);
          predictAndReact(fetchedVitals, location);
        } else {
          console.log("[HealthContext] No existing vitals found or error:", error?.message);
        }
      });

    // Subscribe to new Vitals in real-time
    const vitalsSub = supabase.channel(`realtime-vitals-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vitals', filter: filterString }, (payload) => {
         console.log("[HealthContext] Realtime vitals received:", payload.new);
         const newVitals = {
            heart_rate: payload.new.heart_rate,
            spo2: payload.new.spo2,
            temperature_c: payload.new.temperature,
            medical_history: 0,
            lifestyle_score: 8
         };
         setVitals(newVitals);
         predictAndReact(newVitals, location); 
      }).subscribe((status) => {
        console.log("[HealthContext] Vitals channel status:", status);
      });

    // Subscribe to Emergency Alerts
    const alertsSub = supabase.channel(`realtime-alerts-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_alerts', filter: filterString }, (payload) => {
         setEmergencyActive(true);
         pushToast(`alert-${Date.now()}`, role, `URGENT ALERT: Patient in Distress!`, `Triggered by: ${payload.new.triggered_by}. Severity: ${payload.new.severity}`);
         NotificationService.schedule(
           "🚨 PATIENT EMERGENCY",
           `A linked patient has triggered a high severity alert!`,
           { type: "remote_emergency" }
         );
      }).subscribe((status) => {
        console.log("[HealthContext] Alerts channel status:", status);
      });

    // Also fetch latest location
    supabase.from('locations')
      .select('lat, lng')
      .eq('patient_id', patientRecordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLocation(prev => ({
            ...prev,
            latitude: data[0].lat,
            longitude: data[0].lng,
          }));
        }
      });

    // Subscribe to location updates
    const locationSub = supabase.channel(`realtime-locations-${patientRecordId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations', filter: filterString }, (payload) => {
         setLocation(prev => ({
           ...prev,
           latitude: payload.new.lat,
           longitude: payload.new.lng,
         }));
      }).subscribe();

    return () => {
      supabase.removeChannel(vitalsSub);
      supabase.removeChannel(alertsSub);
      supabase.removeChannel(locationSub);
    };
  }, [authReady, role, patientRecordId, pushToast, predictAndReact]);

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
