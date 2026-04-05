"""
Flask API for health risk prediction and mock emergency / hospital helpers.
"""
from __future__ import annotations

import math
import os

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)
except ImportError:
    pass

from flask import Flask, jsonify, redirect, request, send_from_directory

from model import ensure_model, get_model_backend, predict_risk
from whatsapp_cloud import cloud_whatsapp_status, send_family_whatsapp_cloud

app = Flask(__name__)

STATIC_DEMO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static_demo")


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS" and request.path.startswith("/api"):
        return "", 204


@app.after_request
def _cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# Load or train model once at import (avoids deprecated before_first_request)
ensure_model()

# Mock hospitals as offsets (degrees) from a reference — resolved to absolute lat/lng per request
MOCK_HOSPITALS = [
    {"id": "h1", "name": "City General Hospital", "d_lat": 0.018, "d_lng": 0.022},
    {"id": "h2", "name": "Riverside Medical Center", "d_lat": -0.015, "d_lng": 0.028},
    {"id": "h3", "name": "Community ER & Trauma", "d_lat": 0.021, "d_lng": -0.019},
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "AI Health Risk API"})


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json(silent=True) or {}
    try:
        hr = float(data.get("heart_rate", 72))
        spo2 = float(data.get("spo2", 98))
        temp = float(data.get("temperature_c", 36.8))
        med_hist = float(data.get("medical_history", 0.0))
        life_score = float(data.get("lifestyle_score", 5.0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric vitals"}), 400

    result = predict_risk(hr, spo2, temp, med_hist, life_score)
    if get_model_backend() == "random-forest":
        result["model"] = "RandomForestClassifier (synthetic training)"
    else:
        result["model"] = "Heuristic fallback (scikit-learn unavailable)"
    return jsonify(result)


@app.route("/api/nearest-hospital", methods=["POST"])
def nearest_hospital():
    """Pick mock hospital closest to given patient coordinates."""
    data = request.get_json(silent=True) or {}
    try:
        lat = float(data.get("latitude", 40.7128))
        lng = float(data.get("longitude", -74.0060))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid latitude/longitude"}), 400

    best = None
    best_km = float("inf")
    for h in MOCK_HOSPITALS:
        h_lat = lat + h["d_lat"]
        h_lng = lng + h["d_lng"]
        d = _haversine_km(lat, lng, h_lat, h_lng)
        if d < best_km:
            best_km = d
            best = {
                "id": h["id"],
                "name": h["name"],
                "latitude": round(h_lat, 6),
                "longitude": round(h_lng, 6),
                "approx_distance_km": round(d, 2),
            }
    return jsonify({"hospital": best})


@app.route("/api/whatsapp-config", methods=["GET"])
def api_whatsapp_config():
    """Whether server can send WhatsApp from the cloud (no manual tap)."""
    return jsonify(cloud_whatsapp_status())


@app.route("/api/send-family-alert", methods=["POST"])
def api_send_family_alert():
    """
    Send emergency text to family via WhatsApp from the cloud (Twilio or Meta Cloud API).
    Patient browser only triggers this once; delivery does not require opening WhatsApp.
    """
    data = request.get_json(silent=True) or {}
    to_raw = str(data.get("to_phone", data.get("phone", ""))).strip()
    message = str(data.get("message", "")).strip()
    if not message:
        return jsonify({"ok": False, "error": "empty_message"}), 400

    digits = "".join(c for c in to_raw if c.isdigit())
    if len(digits) < 10:
        return jsonify({"ok": False, "error": "invalid_phone", "hint": "Use full international number with country code."}), 400

    e164 = to_raw if to_raw.startswith("+") else f"+{digits}"
    result = send_family_whatsapp_cloud(e164, message)
    # Always 200 so the dashboard can parse JSON without throw on "not configured"
    return jsonify(result), 200


@app.route("/")
def root():
    return redirect("/demo/")


@app.route("/demo")
def demo_redirect():
    return redirect("/demo/")


@app.route("/demo/")
def demo_index():
    return send_from_directory(STATIC_DEMO, "index.html")


@app.route("/demo/<path:filename>")
def demo_static(filename):
    return send_from_directory(STATIC_DEMO, filename)


@app.route("/auth-confirm")
def auth_confirm():
    return """
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; background: #0b0f19; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                .success { color: #00ffcc; font-size: 48px; margin-bottom: 20px; }
                h1 { margin-bottom: 10px; }
                p { color: #8fa3b8; line-height: 1.5; }
                .btn { background: #00ffcc; color: black; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 30px; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="success">✓</div>
            <h1>Email Confirmed!</h1>
            <p>Your Lifeguard AI account has been successfully verified.</p>
            <p>You can now safely close this browser window and open the Lifeguard AI app on your phone to log in.</p>
        </body>
    </html>
    """;


if __name__ == "__main__":
    _wa = cloud_whatsapp_status()
    print("\n  Dashboard (no Node required): http://127.0.0.1:5000/demo/")
    print(f"  From Android device on same WiFi: http://192.168.0.192:5000/api/")
    print(f"  WhatsApp cloud sender: {_wa['mode']} (see backend/WHATSAPP_SETUP.txt)\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
