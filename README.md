# AI Health Risk Prediction & Emergency Response System

End-to-end prototype: simulated vitals → Flask API → **scikit-learn** risk model → multi-role alerts → **Leaflet** map with **OpenStreetMap** and optional **OSRM** driving route.

## Fastest way to run (Windows — no venv, no Node)

Use this if `python -m venv` fails (disk full / `ensurepip` errors) or you cannot run `npm install`.

1. Double-click **`install-backend.bat`** once (installs packages into your user Python).
2. Double-click **`run-backend.bat`** (or run `python app.py` from the `backend` folder).
3. In your browser open **http://127.0.0.1:5000/demo/**

That page is the **full dashboard** (patient / family / doctor tabs, map, charts, simulate emergency). It is served by Flask from `backend/static_demo/` — **no React build required**.

Optional: double-click **`START-HERE.bat`** to open backend + React dev server in two windows (needs `npm install` in `frontend` to succeed).

## What you get

- **Patient dashboard:** live vitals (heart rate, SpO₂, temperature), AI risk score (0–100) and category (Normal / Warning / High Risk), trend chart, emergency modal, **Simulate emergency** button (e.g. HR 130, SpO₂ 85).
- **Family tracker:** same live location on a map, vitals summary, route when emergency is active. Simulated notifications as **toasts** + **browser console** logs.
- **Doctor / hospital console:** inbound emergency banner, vitals table, GPS coordinates; console logs for triage-style payloads.
- **Maps:** browser **Geolocation** (falls back to demo NYC coordinates if denied), mock “nearest” hospital from the backend, **shortest driving route** via free public OSRM (falls back to a straight line if unreachable).

## Project layout

```
lifeguard-ai/
├── START-HERE.bat          # Opens backend + frontend (optional)
├── install-backend.bat     # pip install --user (no venv)
├── run-backend.bat         # Start Flask
├── run-frontend.bat        # npm install (if needed) + Vite
├── backend/
│   ├── app.py              # Flask API + serves /demo dashboard
│   ├── model.py            # Train/load RandomForest + predict_risk()
│   ├── requirements.txt
│   ├── static_demo/        # Full UI without Node (HTML + JS + Leaflet/Chart CDN)
│   └── model_files/        # Created on first run (trained .joblib)
├── frontend/               # Optional React + Vite UI
│   ├── src/
│   └── package.json
└── README.md
```

## Prerequisites

- **Python 3.10+** (3.11 recommended)
- **Node.js 18+** — only if you want the separate React dev server

## Step 1 — Backend (Flask)

**Option A — scripts (recommended on Windows)**

Run `install-backend.bat`, then `run-backend.bat`.

**Option B — manual, no virtual environment**

```powershell
cd d:\lifeguard-ai\backend
py -3 -m pip install -r requirements.txt --user
py -3 app.py
```

**Option C — virtual environment** (needs free disk space on the drive Python uses)

```powershell
cd d:\lifeguard-ai\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Leave the server running. The API listens on **http://127.0.0.1:5000**.

- **Dashboard:** **http://127.0.0.1:5000/demo/** (same-origin; works without CORS issues)
- `GET /api/health` — sanity check  
- `POST /api/predict` — JSON body: `heart_rate`, `spo2`, `temperature_c`  
- `POST /api/nearest-hospital` — JSON body: `latitude`, `longitude`  

On first prediction, `model.py` trains a **RandomForestClassifier** on synthetic vitals and saves it under `backend/model_files/`. CORS headers are set in `app.py` for tools that call the API from another origin.

## Step 2 — Frontend (React + Vite, optional)

Use this if you want the React UI on port 5173 instead of (or in addition to) `/demo/`.

```powershell
cd d:\lifeguard-ai\frontend
npm install
npm run dev
```

If `npm install` complains about peer dependencies, use `npm install --legacy-peer-deps` (already the default via `frontend/.npmrc`).

Open **http://127.0.0.1:5173** (or the URL Vite prints). The dev server **proxies** `/api` to Flask on port 5000.

Allow **location** when the browser asks so the patient/family maps track you; otherwise the app uses fixed demo coordinates and shows a note.

## Try the full emergency flow

1. Open **Patient dashboard**.
2. Click **Simulate emergency**. Vitals jump to dangerous ranges; the model should return **High Risk**.
3. You should see: patient **modal**, **toasts** (patient / family / doctor), **console logs** tagged `[EMERGENCY — …]`, map **route** to a mock hospital.
4. Switch tabs to **Family tracker** and **Doctor / hospital** to see the same live state.
5. Click **Resume normal simulation** (or **Clear emergency demo** in the modal) to reset the demo latch and return to random walk vitals.

## Tech notes (free stack)

- **Tiles:** OpenStreetMap via Leaflet default tile URL.  
- **Routing:** `https://router.project-osrm.org/` (no API key; respect fair use).  
- **Notifications:** in-app toasts + `console.log` only — no SMS cost.

## Troubleshooting

| Issue | What to do |
|--------|------------|
| `venv` / `ensurepip` fails, disk full | Skip the venv: run **`install-backend.bat`**, then **`run-backend.bat`**, open **http://127.0.0.1:5000/demo/** |
| `npm install` ENOSPC | Free disk space (npm cache + `node_modules` need several GB), then retry; you can use **`/demo/`** without Node. |
| Frontend shows API error | Ensure Flask is running on port 5000; for Vite, proxy is set in `vite.config.js`. |
| Map is blank | Check network/adblock; confirm Leaflet loads (CDN). |
| No route line | OSRM may be slow or blocked; the app draws a straight fallback line. |
| Wrong Python | On Windows try `py -3` or `py -3.11` instead of `python`. |

## License

Educational prototype — use and modify freely.
