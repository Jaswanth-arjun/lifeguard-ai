(function () {
  "use strict";

  const API = "/api";
  var FAMILY_PHONE_KEY = "lifeguard_family_phone";
  var lastFamilyEmergencyMessage = "";

  function getFamilyTrackerUrl() {
    var origin = window.location.origin;
    var pathname = window.location.pathname || "/";
    if (pathname.indexOf("/demo") !== -1) {
      var base = pathname.endsWith("/") ? pathname : pathname + "/";
      return origin + base + "#family";
    }
    return origin + "/family";
  }

  function digitsOnlyPhone(input) {
    return String(input || "").replace(/\D/g, "");
  }

  function buildFamilyEmergencyMessage(v, pred, lat, lng, trackerUrl) {
    return [
      "EMERGENCY — Patient health alert (AI monitoring)",
      "Status: " + (pred && pred.category ? pred.category : "High Risk") + " (risk score " + (pred && pred.risk_score != null ? pred.risk_score : "—") + ")",
      "Vitals: HR " + v.heart_rate + " bpm, SpO₂ " + v.spo2 + "%, Temp " + v.temperature_c + "°C",
      "Last known GPS: " + lat.toFixed(5) + ", " + lng.toFixed(5),
      "Open Family Tracker (live map): " + trackerUrl,
    ].join("\n");
  }

  function updateFamilyPhoneUi() {
    var input = document.getElementById("family-phone");
    if (!input) return;
    var d = digitsOnlyPhone(input.value);
    var warn = document.getElementById("family-phone-warn");
    if (warn) warn.style.display = d.length > 0 && d.length < 10 ? "block" : "none";
  }

  function setModalSmsBackup(digits, msg, label) {
    var smsP = document.getElementById("modal-sms");
    if (!smsP) return;
    var sms = "sms:+" + digits + "?body=" + encodeURIComponent(msg);
    smsP.style.display = "block";
    smsP.textContent = (label || "Backup: ") + " ";
    var a = document.createElement("a");
    a.href = sms;
    a.textContent = "compose SMS";
    smsP.appendChild(a);
  }

  async function notifyFamilyOnEmergency(v, pred, lat, lng) {
    var input = document.getElementById("family-phone");
    var raw = (input && input.value) || localStorage.getItem(FAMILY_PHONE_KEY) || "";
    raw = String(raw).trim();
    try {
      localStorage.setItem(FAMILY_PHONE_KEY, raw);
    } catch (e) { }
    if (input) input.value = raw;
    var digits = digitsOnlyPhone(raw);
    var trackerUrl = getFamilyTrackerUrl();
    var msg = buildFamilyEmergencyMessage(v, pred, lat, lng, trackerUrl);
    lastFamilyEmergencyMessage = msg;

    var smsP = document.getElementById("modal-sms");
    if (smsP) {
      smsP.style.display = "none";
      smsP.textContent = "";
    }

    if (digits.length >= 10) {
      var toPhone = raw.indexOf("+") === 0 ? raw.replace(/\s/g, "") : "+" + digits;
      var cloud = { ok: false, error: "unknown" };
      try {
        var res = await fetch(API + "/send-family-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_phone: toPhone,
            message: msg,
            latitude: lat,
            longitude: lng,
          }),
        });
        cloud = await res.json();
      } catch (e) {
        cloud = { ok: false, error: "browser_network", detail: String(e.message || e) };
      }
      console.log("[Family — cloud WhatsApp]", cloud);

      if (cloud.ok) {
        toast(
          "<strong>Family notified (WhatsApp — cloud)</strong><div>Sent automatically via " +
          (cloud.provider || "provider") +
          ". " +
          (cloud.message_sid || cloud.message_id || "") +
          "</div>"
        );
      } else if (cloud.error === "not_configured") {
        toast(
          "<strong>Cloud WhatsApp not configured</strong><div>Set TWILIO_* or WHATSAPP_CLOUD_* on the server. See backend/WHATSAPP_SETUP.txt</div>"
        );
        setModalSmsBackup(digits, msg, "Server not configured — optional backup:");
      } else {
        toast(
          "<strong>WhatsApp cloud send failed</strong><div>" +
          (cloud.detail || cloud.error || "Error") +
          "</div>"
        );
        setModalSmsBackup(digits, msg, "Optional backup:");
      }
    } else {
      toast(
        "<strong>Family phone missing</strong><div>Add 10+ digits with country code for cloud WhatsApp. Tracker: " +
        trackerUrl +
        "</div>"
      );
    }
  }

  let vitals = { heart_rate: 74, spo2: 98, temperature_c: 36.7 };
  let prediction = null;
  let loc = { lat: null, lng: null, err: null };
  let hospital = null;
  let routeLine = null;
  let emergencyActive = false;
  let forceAbnormal = false;
  let wasHighRisk = false;
  let lastCoords = null;
  let map = null;
  let map2 = null;
  let patientMarker = null;
  let hospitalMarker = null;
  let patientMarker2 = null;
  let hospitalMarker2 = null;
  let routeLayer = null;
  let routeLayer2 = null;
  let chart = null;
  const hrSeries = [];
  const riskSeries = [];
  let tick = 0;
  let emergencyTriggerPending = false;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function randomWalk(prev, delta, lo, hi) {
    return clamp(prev + (Math.random() * 2 - 1) * delta, lo, hi);
  }

  async function postPredict(v) {
    const r = await fetch(API + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heart_rate: v.heart_rate,
        spo2: v.spo2,
        temperature_c: v.temperature_c,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function postHospital(lat, lng) {
    const r = await fetch(API + "/nearest-hospital", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function fetchRoute(lat1, lng1, lat2, lng2) {
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      lng1 +
      "," +
      lat1 +
      ";" +
      lng2 +
      "," +
      lat2 +
      "?overview=full&geometries=geojson";
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const c = data?.routes?.[0]?.geometry?.coordinates;
      if (!c?.length) return null;
      return c.map(function (x) {
        return [x[1], x[0]];
      });
    } catch (e) {
      return null;
    }
  }

  function toast(html, cls) {
    const el = document.createElement("div");
    el.className = "toast" + (cls ? " " + cls : "");
    el.innerHTML = html;
    document.getElementById("toasts").appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 12000);
  }

  function categoryClass(cat) {
    if (cat === "High Risk") return "cat-high";
    if (cat === "Warning") return "cat-warn";
    return "cat-normal";
  }

  function updateVitalsUI() {
    document.getElementById("v-hr").innerHTML = vitals.heart_rate + " <small>bpm</small>";
    document.getElementById("v-spo2").innerHTML = vitals.spo2 + " <small>%</small>";
    document.getElementById("v-temp").innerHTML = vitals.temperature_c + " <small>°C</small>";
    var rc = document.getElementById("risk-card");
    if (prediction) {
      document.getElementById("v-risk").innerHTML = prediction.risk_score + " <small>/ 100</small>";
      var cat = document.getElementById("v-cat");
      cat.textContent = prediction.category;
      cat.className = categoryClass(prediction.category);
      rc.style.borderColor =
        prediction.category === "High Risk"
          ? "var(--danger)"
          : prediction.category === "Warning"
            ? "var(--warn)"
            : "var(--border)";
    } else {
      document.getElementById("v-risk").innerHTML = "— <small>/ 100</small>";
      document.getElementById("v-cat").textContent = "";
      rc.style.borderColor = "var(--border)";
    }
  }

  function updateChart() {
    if (!chart) return;
    chart.data.labels = hrSeries.map(function (_, i) {
      return String(i + 1);
    });
    chart.data.datasets[0].data = hrSeries.map(function (x) {
      return x.hr;
    });
    chart.data.datasets[1].data = riskSeries.map(function (x) {
      return x.risk;
    });
    chart.update("none");
  }

  function setRouteOnMap(m, coords, pLat, pLng) {
    if (!m) return;
    if (routeLayer && m && m.hasLayer(routeLayer)) {
      m.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (routeLayer2 && map2 && map2.hasLayer(routeLayer2)) {
      map2.removeLayer(routeLayer2);
      routeLayer2 = null;
    }
    if (coords && coords.length) {
      routeLayer = L.polyline(coords, { color: "#3d9cf5", weight: 5, opacity: 0.85 }).addTo(m);
      if (map2) {
        routeLayer2 = L.polyline(coords, { color: "#3d9cf5", weight: 5, opacity: 0.85 }).addTo(map2);
      }
      try {
        var b = L.latLngBounds(coords);
        m.fitBounds(b, { padding: [36, 36], maxZoom: 14 });
        if (map2) map2.fitBounds(b, { padding: [36, 36], maxZoom: 14 });
      } catch (e) { }
    }
  }

  function updateMarkers() {
    var plat = loc.lat != null ? loc.lat : 40.7128;
    var plng = loc.lng != null ? loc.lng : -74.006;
    if (map && patientMarker) {
      patientMarker.setLatLng([plat, plng]);
    }
    if (map2 && patientMarker2) {
      patientMarker2.setLatLng([plat, plng]);
      var hashRole = window.location.hash.replace("#", "");
      if (hashRole === "family" && !emergencyActive) {
        map2.setView([plat, plng]);
      }
    }
    if (hospital) {
      if (map && hospitalMarker) hospitalMarker.setLatLng([hospital.latitude, hospital.longitude]);
      if (map2 && hospitalMarker2)
        hospitalMarker2.setLatLng([hospital.latitude, hospital.longitude]);
    }
  }

  async function runEmergency(pred, v) {
    var lat = loc.lat != null ? loc.lat : 40.7128;
    var lng = loc.lng != null ? loc.lng : -74.006;
    console.log("[EMERGENCY — Patient]", { vitals: v, risk: pred, location: { lat: lat, lng: lng } });
    console.log("[EMERGENCY — Family]", pred.category, lat, lng);
    console.log("[EMERGENCY — Doctor/Hospital]", v, pred);

    toast("<strong>Patient</strong><div>Check on-screen emergency instructions.</div>");

    try {
      var nh = await postHospital(lat, lng);
      hospital = nh.hospital;
      var coords = null;
      if (hospital) {
        coords = await fetchRoute(lat, lng, hospital.latitude, hospital.longitude);
      }
      if (!coords) {
        coords = [
          [lat, lng],
          [
            hospital ? hospital.latitude : lat + 0.02,
            hospital ? hospital.longitude : lng + 0.02,
          ],
        ];
      }
      if (!hospital) {
        hospital = {
          name: "Mock hospital",
          latitude: lat + 0.02,
          longitude: lng + 0.02,
        };
      }
      if (map && hospitalMarker) {
        hospitalMarker.setLatLng([hospital.latitude, hospital.longitude]);
        hospitalMarker.bindPopup(hospital.name);
        hospitalMarker.addTo(map);
      }
      if (map2 && hospitalMarker2) {
        hospitalMarker2.setLatLng([hospital.latitude, hospital.longitude]);
        hospitalMarker2.bindPopup(hospital.name);
        hospitalMarker2.addTo(map2);
      }
      lastCoords = coords;
      setRouteOnMap(map, coords, lat, lng);

      localStorage.setItem("lifeguardEmergencyTrigger", JSON.stringify({
        v: v, pred: pred, lat: lat, lng: lng, t: Date.now()
      }));
    } catch (e) {
      console.warn(e);
    }

    document.getElementById("modal-text").innerHTML =
      "High risk detected. Route to <strong>" +
      (hospital ? hospital.name : "nearest hospital") +
      "</strong>.<br/><br/>GPS: " +
      lat.toFixed(5) +
      ", " +
      lng.toFixed(5);
    await notifyFamilyOnEmergency(v, pred, lat, lng);
    emergencyTriggerPending = false;
    document.getElementById("modal").classList.add("show");
    emergencyActive = true;
    renderSidePanels();
  }

  async function predictAndReact(v) {
    var err = document.getElementById("api-err");
    try {
      err.style.display = "none";
      prediction = await postPredict(v);
      hrSeries.push({ t: tick, hr: v.heart_rate });
      riskSeries.push({ t: tick, risk: prediction.risk_score });
      if (hrSeries.length > 60) hrSeries.shift();
      if (riskSeries.length > 60) riskSeries.shift();
      tick++;
      updateVitalsUI();
      updateChart();

      if (prediction.category === "High Risk") {
        if (emergencyTriggerPending && !wasHighRisk) {
          wasHighRisk = true;
          emergencyTriggerPending = false;
          await runEmergency(prediction, v);
        }
      } else {
        wasHighRisk = false;
        emergencyTriggerPending = false;
        emergencyActive = false;
        document.getElementById("modal").classList.remove("show");
        hospital = null;
        if (routeLayer && map) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        if (routeLayer2 && map2) {
          map2.removeLayer(routeLayer2);
          routeLayer2 = null;
        }
        if (hospitalMarker && map && map.hasLayer(hospitalMarker)) {
          map.removeLayer(hospitalMarker);
        }
        if (hospitalMarker2 && map2 && map2.hasLayer(hospitalMarker2)) {
          map2.removeLayer(hospitalMarker2);
        }
      }
      renderSidePanels();
      updateMarkers();

      var hashRole = window.location.hash.replace("#", "");
      if (hashRole === "patient" || hashRole === "") {
        localStorage.setItem("lifeguardState", JSON.stringify({
          vitals: vitals,
          prediction: prediction,
          loc: loc,
          hospital: hospital,
          emergencyActive: emergencyActive,
          lastCoords: lastCoords,
          t: Date.now()
        }));
      }
    } catch (e) {
      err.textContent = "API error: " + e.message + " — is Flask running on port 5000?";
      err.style.display = "block";
    }
  }

  function renderSidePanels() {
    var lat = loc.lat != null ? loc.lat : 40.7128;
    var lng = loc.lng != null ? loc.lng : -74.006;
    document.getElementById("family-status").innerHTML =
      "<h2 style='margin:0 0 0.5rem;font-size:1.05rem'>Patient status</h2>" +
      "<p style='margin:0'><strong>Vitals:</strong> HR " +
      vitals.heart_rate +
      " · SpO₂ " +
      vitals.spo2 +
      "% · " +
      vitals.temperature_c +
      "°C</p>" +
      "<p style='margin:0.5rem 0 0'><strong>Risk:</strong> " +
      (prediction ? prediction.category + " (" + prediction.risk_score + ")" : "—") +
      "</p>" +
      "<p style='margin:0.5rem 0 0'><strong>Live location:</strong> " +
      lat.toFixed(5) +
      ", " +
      lng.toFixed(5) +
      "</p>" +
      (emergencyActive
        ? "<p style='margin:0.75rem 0 0;color:var(--danger);font-weight:600'>Emergency active.</p>"
        : "");

    var doc = document.getElementById("doctor-body");
    if (emergencyActive) {
      doc.innerHTML =
        "<div style='padding:1rem;border-radius:12px;background:rgba(245,93,93,0.12);border:1px solid var(--danger);margin-bottom:1rem'><strong style='color:var(--danger)'>EMERGENCY — PATIENT INBOUND</strong><p style='margin:0.5rem 0 0'>Prepare bay. " +
        (prediction ? prediction.category + " (score " + prediction.risk_score + ")" : "") +
        "</p></div>";
    } else {
      doc.innerHTML = "<p style='color:var(--muted)'>No active emergency.</p>";
    }
    doc.innerHTML +=
      "<table class='simple' style='width:100%;border-collapse:collapse'>" +
      "<tr><td>Heart rate</td><td><strong>" +
      vitals.heart_rate +
      " bpm</strong></td></tr>" +
      "<tr><td>SpO₂</td><td><strong>" +
      vitals.spo2 +
      "%</strong></td></tr>" +
      "<tr><td>Temperature</td><td><strong>" +
      vitals.temperature_c +
      " °C</strong></td></tr>" +
      "<tr><td>GPS</td><td><strong>" +
      lat.toFixed(5) +
      ", " +
      lng.toFixed(5) +
      "</strong></td></tr></table>";
  }

  function initMap(el, isSecond) {
    L.Icon.Default.imagePath = "https://unpkg.com/leaflet@1.9.4/dist/images/";
    var plat = loc.lat != null ? loc.lat : 40.7128;
    var plng = loc.lng != null ? loc.lng : -74.006;
    var m = L.map(el).setView([plat, plng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    var pm = L.marker([plat, plng]).addTo(m).bindPopup("Patient");
    var hm = L.marker([plat + 0.02, plng + 0.02]);
    if (isSecond) {
      map2 = m;
      patientMarker2 = pm;
      hospitalMarker2 = hm;
    } else {
      map = m;
      patientMarker = pm;
      hospitalMarker = hm;
    }
  }

  function initChart() {
    var ctx = document.getElementById("chart").getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Heart rate",
            data: [],
            borderColor: "#3dd68c",
            tension: 0.2,
            yAxisID: "y",
          },
          {
            label: "Risk score",
            data: [],
            borderColor: "#3d9cf5",
            tension: 0.2,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { type: "linear", position: "left", grid: { color: "#2d3a4f" } },
          y1: {
            type: "linear",
            position: "right",
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
          },
          x: { grid: { color: "#2d3a4f" } },
        },
        plugins: { legend: { labels: { color: "#e8eef5" } } },
      },
    });
  }

  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      var t = btn.getAttribute("data-tab");
      document.getElementById("panel-patient").classList.toggle("panel-hidden", t !== "patient");
      document.getElementById("panel-family").classList.toggle("panel-hidden", t !== "family");
      document.getElementById("panel-doctor").classList.toggle("panel-hidden", t !== "doctor");
      if (t === "family" && map2) setTimeout(function () { map2.invalidateSize(); }, 200);
      if (t === "patient" && map) setTimeout(function () { map.invalidateSize(); }, 200);
    });
  });

  document.getElementById("btn-sim").addEventListener("click", function () {
    wasHighRisk = false;
    emergencyTriggerPending = true;
    forceAbnormal = true;
    vitals = { heart_rate: 130, spo2: 85, temperature_c: 39.1 };
    predictAndReact(vitals);
  });

  var famInput = document.getElementById("family-phone");
  if (famInput) {
    try {
      famInput.value = localStorage.getItem(FAMILY_PHONE_KEY) || "";
    } catch (e) { }
    famInput.addEventListener("input", function () {
      try {
        localStorage.setItem(FAMILY_PHONE_KEY, famInput.value.trim());
      } catch (e2) { }
      updateFamilyPhoneUi();
    });
  }
  var preview = document.getElementById("family-url-preview");
  if (preview) preview.textContent = getFamilyTrackerUrl();
  updateFamilyPhoneUi();

  document.getElementById("btn-resume").addEventListener("click", function () {
    forceAbnormal = false;
    emergencyTriggerPending = false;
    wasHighRisk = false;
    emergencyActive = false;
    document.getElementById("modal").classList.remove("show");
    var smsP = document.getElementById("modal-sms");
    if (smsP) {
      smsP.style.display = "none";
      smsP.textContent = "";
    }
    hospital = null;
    if (routeLayer && map && map.hasLayer(routeLayer)) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (routeLayer2 && map2 && map2.hasLayer(routeLayer2)) {
      map2.removeLayer(routeLayer2);
      routeLayer2 = null;
    }
    if (hospitalMarker && map && map.hasLayer(hospitalMarker)) map.removeLayer(hospitalMarker);
    if (hospitalMarker2 && map2 && map2.hasLayer(hospitalMarker2)) map2.removeLayer(hospitalMarker2);
    renderSidePanels();
  });

  document.getElementById("modal-ok").addEventListener("click", function () {
    document.getElementById("modal").classList.remove("show");
  });

  document.getElementById("modal-clear").addEventListener("click", function () {
    document.getElementById("btn-resume").click();
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      function (pos) {
        loc.lat = pos.coords.latitude;
        loc.lng = pos.coords.longitude;
        loc.err = null;
        document.getElementById("loc-note").textContent = "";
        updateMarkers();
      },
      function (e) {
        loc.lat = 40.7128;
        loc.lng = -74.006;
        loc.err = e.message;
        document.getElementById("loc-note").textContent =
          "Location: using demo NYC (" + e.message + ")";
        updateMarkers();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  } else {
    loc.lat = 40.7128;
    loc.lng = -74.006;
    document.getElementById("loc-note").textContent = "Geolocation not supported — demo NYC.";
  }

  initMap("map", false);
  initMap("map2", true);
  initChart();
  updateVitalsUI();
  renderSidePanels();

  setInterval(function () {
    var hashRole = window.location.hash.replace("#", "");
    if (hashRole !== "patient" && hashRole !== "") return;

    if (forceAbnormal) {
      vitals = { heart_rate: 130, spo2: 85, temperature_c: 38.9 };
    } else {
      vitals = {
        heart_rate: Math.round(randomWalk(vitals.heart_rate, 4, 58, 105)),
        spo2: Math.round(randomWalk(vitals.spo2, 0.8, 94, 100) * 10) / 10,
        temperature_c: Math.round(randomWalk(vitals.temperature_c, 0.12, 36.2, 37.8) * 10) / 10,
      };
    }
    predictAndReact(vitals);
  }, 2500);

  // Check for URL hash to enforce separate views for different roles
  function applyHashRouting() {
    var hash = window.location.hash.replace("#", "");
    if (hash === "family" || hash === "doctor" || hash === "patient") {
      // Hide the tab selector so it looks like a separate website
      var tabsNav = document.querySelector(".tabs");
      if (tabsNav) tabsNav.style.display = "none";

      document.getElementById("panel-patient").classList.toggle("panel-hidden", hash !== "patient");
      document.getElementById("panel-family").classList.toggle("panel-hidden", hash !== "family");
      document.getElementById("panel-doctor").classList.toggle("panel-hidden", hash !== "doctor");

      if (hash === "family" && map2) setTimeout(function () { map2.invalidateSize(); }, 200);
      if (hash === "patient" && map) setTimeout(function () { map.invalidateSize(); }, 200);
    }
  }

  applyHashRouting();
  window.addEventListener("hashchange", applyHashRouting);

  window.addEventListener("storage", function (e) {
    if (e.key === "lifeguardEmergencyTrigger" && e.newValue) {
      var d = JSON.parse(e.newValue);
      var hashRole = window.location.hash.replace("#", "");
      if (hashRole === "family") {
        toast("<strong>Family Alert</strong><div>" + d.pred.category + " score " + d.pred.risk_score + ". GPS: " + d.lat.toFixed(5) + ", " + d.lng.toFixed(5) + "</div>", "family");
      } else if (hashRole === "doctor") {
        toast("<strong>Doctor / Hospital Alert</strong><div>Incoming emergency — HR " + d.v.heart_rate + ", SpO₂ " + d.v.spo2 + "%.</div>", "doctor");
      }
    }
    if (e.key === "lifeguardState" && e.newValue) {
      var s = JSON.parse(e.newValue);
      vitals = s.vitals;
      prediction = s.prediction;
      loc = s.loc;
      hospital = s.hospital;
      emergencyActive = s.emergencyActive;
      lastCoords = s.lastCoords;

      updateVitalsUI();
      renderSidePanels();

      if (hospital && map2 && hospitalMarker2) {
        hospitalMarker2.setLatLng([hospital.latitude, hospital.longitude]);
        hospitalMarker2.addTo(map2);
      } else if (!hospital && map2 && hospitalMarker2) {
        map2.removeLayer(hospitalMarker2);
      }

      updateMarkers();

      if (emergencyActive && lastCoords) {
        setRouteOnMap(map, lastCoords, loc.lat, loc.lng);
      } else {
        if (routeLayer && map) { map.removeLayer(routeLayer); routeLayer = null; }
        if (routeLayer2 && map2) { map2.removeLayer(routeLayer2); routeLayer2 = null; }
      }
    }
  });

})();
