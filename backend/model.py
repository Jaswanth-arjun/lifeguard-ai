"""
Train and run a scikit-learn classifier for health risk (Normal / Warning / High Risk).
Risk score 0–100 is derived from class probabilities and vital thresholds.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import numpy as np

try:
    import joblib
except ImportError:
    joblib = None

try:
    from sklearn.ensemble import RandomForestClassifier
except ImportError:
    RandomForestClassifier = None

# 0 = Normal, 1 = Warning, 2 = High Risk
CLASS_LABELS = ["Normal", "Warning", "High Risk"]
MODEL_DIR = Path(__file__).resolve().parent / "model_files"
MODEL_PATH = MODEL_DIR / "risk_classifier_v2.joblib"
MODEL_BACKEND = "heuristic-fallback"


def _synthetic_dataset(n_per_class: int = 400) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    rows: list[list[float]] = []
    labels: list[int] = []

    # Normal: HR 55–100, SpO2 95–100, temp 36.3–37.3, med_hist 0-3, lifestyle 6-10
    hr = rng.uniform(55, 100, n_per_class)
    spo2 = rng.uniform(95, 100, n_per_class)
    temp = rng.uniform(36.3, 37.3, n_per_class)
    med = rng.uniform(0, 3, n_per_class)
    life = rng.uniform(6, 10, n_per_class)
    for i in range(n_per_class):
        rows.append([hr[i], spo2[i], temp[i], med[i], life[i]])
        labels.append(0)

    # Warning: elevated HR or lower SpO2 or mild fever, med_hist 3-7, lifestyle 3-6
    hr = rng.uniform(100, 125, n_per_class)
    spo2 = rng.uniform(88, 96, n_per_class)
    temp = rng.uniform(37.2, 38.5, n_per_class)
    med = rng.uniform(3, 7, n_per_class)
    life = rng.uniform(3, 6, n_per_class)
    for i in range(n_per_class):
        rows.append([hr[i], spo2[i], temp[i], med[i], life[i]])
        labels.append(1)

    # High risk: critical combinations, med_hist 6-10, lifestyle 0-4
    for _ in range(n_per_class):
        scenario = rng.integers(0, 4)
        if scenario == 0:
            rows.append([float(rng.uniform(120, 185)), float(rng.uniform(82, 92)), float(rng.uniform(36.5, 38.0)), float(rng.uniform(6,10)), float(rng.uniform(0,4))])
        elif scenario == 1:
            rows.append([float(rng.uniform(95, 140)), float(rng.uniform(75, 88)), float(rng.uniform(36.8, 37.5)), float(rng.uniform(6,10)), float(rng.uniform(0,4))])
        elif scenario == 2:
            rows.append([float(rng.uniform(110, 160)), float(rng.uniform(78, 90)), float(rng.uniform(38.5, 40.5)), float(rng.uniform(6,10)), float(rng.uniform(0,4))])
        else:
            rows.append([float(rng.uniform(130, 175)), float(rng.uniform(80, 89)), float(rng.uniform(37.0, 39.0)), float(rng.uniform(6,10)), float(rng.uniform(0,4))])
        labels.append(2)

    X = np.array(rows, dtype=np.float64)
    y = np.array(labels, dtype=np.int64)
    perm = rng.permutation(len(y))
    return X[perm], y[perm]


def _train_and_save() -> Any:
    if RandomForestClassifier is None:
        raise RuntimeError("scikit-learn is not available")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    X, y = _synthetic_dataset()
    clf = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
    )
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)
    return clf


def ensure_model() -> Any:
    global MODEL_BACKEND

    if joblib is None or RandomForestClassifier is None:
        MODEL_BACKEND = "heuristic-fallback"
        return None

    if MODEL_PATH.exists():
        try:
            loaded = joblib.load(MODEL_PATH)
            MODEL_BACKEND = "random-forest"
            return loaded
        except Exception:
            # Serialized model may be incompatible with local sklearn/numpy.
            # Fall back to heuristics so the API remains available.
            MODEL_BACKEND = "heuristic-fallback"
            return None

    try:
        MODEL_BACKEND = "random-forest"
        return _train_and_save()
    except Exception:
        MODEL_BACKEND = "heuristic-fallback"
        return None


def get_model_backend() -> str:
    return MODEL_BACKEND


def _heuristic_adjustment(hr: float, spo2: float, temp_c: float, med_hist: float, life: float) -> float:
    """Boost score when vitals cross clinical-style thresholds, including lifestyle features."""
    extra = 0.0
    if hr >= 120:
        extra += 10 + min(18, (hr - 120) * 0.4)
    elif hr >= 100:
        extra += 4 + (hr - 100) * 0.15
    if spo2 <= 88:
        extra += 18 + (88 - spo2) * 1.2
    elif spo2 <= 92:
        extra += 6 + (92 - spo2) * 1.5
    elif spo2 <= 94:
        extra += 2
    if temp_c >= 39.0:
        extra += 12 + (temp_c - 39.0) * 5
    elif temp_c >= 38.0:
        extra += 4 + (temp_c - 38.0) * 4
        
    # Add medical history & lifestyle penalty
    if med_hist >= 7:
        extra += 5 + (med_hist - 7) * 2
    elif med_hist >= 4:
        extra += 3
        
    if life <= 3:
        extra += 5 + (3 - life) * 1.5
    elif life <= 5:
        extra += 2
        
    return min(45.0, extra)


def _heuristic_probabilities(heart_rate: float, spo2: float, temperature_c: float, med_hist: float, life: float) -> np.ndarray:
    score = 0.0

    if heart_rate >= 130:
        score += 35
    elif heart_rate >= 115:
        score += 20
    elif heart_rate >= 100:
        score += 8

    if spo2 <= 85:
        score += 45
    elif spo2 <= 90:
        score += 25
    elif spo2 <= 94:
        score += 10

    if temperature_c >= 39.5:
        score += 20
    elif temperature_c >= 38.5:
        score += 10
    elif temperature_c >= 37.8:
        score += 4

    if med_hist >= 8:
        score += 15
    elif med_hist >= 5:
        score += 8
    if life <= 3:
        score += 10
    elif life <= 5:
        score += 5

    score = max(0.0, min(100.0, score))
    p_high = score / 100.0
    p_warn = max(0.0, min(1.0, 0.15 + (p_high * 0.65)))
    p_norm = max(0.0, 1.0 - p_warn - p_high)

    raw = np.array([p_norm, p_warn, p_high], dtype=np.float64)
    total = float(raw.sum())
    if total <= 0:
        return np.array([1.0, 0.0, 0.0], dtype=np.float64)
    return raw / total


def predict_risk(heart_rate: float, spo2: float, temperature_c: float, medical_history: float = 0.0, lifestyle_score: float = 5.0) -> dict:
    """
    Returns category, risk_score 0–100, sklearn class probabilities, and flags.
    Expected feature order: HR, SpO2, Temp, MedicalHistory, LifestyleScore
    """
    clf = ensure_model()
    if clf is None:
        proba = _heuristic_probabilities(heart_rate, spo2, temperature_c, medical_history, lifestyle_score)
    else:
        X = np.array([[heart_rate, spo2, temperature_c, medical_history, lifestyle_score]], dtype=np.float64)
        proba = clf.predict_proba(X)[0]

    # Map probabilities to a 0–100 score (emphasizes higher-risk classes)
    weights = np.array([0.12, 0.48, 1.0], dtype=np.float64)
    base_score = float(np.dot(proba, weights) * 100)
    
    # Add heuristics offset
    adjustment = _heuristic_adjustment(heart_rate, spo2, temperature_c, medical_history, lifestyle_score)
    base_score = max(0.0, min(100.0, base_score + adjustment))

    if base_score >= 75:
        category = "High Risk"
        pred_class = 2
    elif base_score >= 40:
        category = "Warning"
        pred_class = 1
    else:
        category = "Normal"
        pred_class = 0

    return {
        "risk_score": int(round(base_score)),
        "category": category,
        "class_index": pred_class,
        "probabilities": {
            CLASS_LABELS[i]: round(float(proba[i]), 4) for i in range(len(CLASS_LABELS))
        },
        "features": {
            "heart_rate": heart_rate,
            "spo2": spo2,
            "temperature_c": temperature_c,
            "medical_history": medical_history,
            "lifestyle_score": lifestyle_score,
        },
    }
