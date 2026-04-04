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
MODEL_PATH = MODEL_DIR / "risk_classifier.joblib"
MODEL_BACKEND = "heuristic-fallback"


def _synthetic_dataset(n_per_class: int = 400) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    rows: list[list[float]] = []
    labels: list[int] = []

    # Normal: HR 55–100, SpO2 95–100, temp 36.3–37.3
    hr = rng.uniform(55, 100, n_per_class)
    spo2 = rng.uniform(95, 100, n_per_class)
    temp = rng.uniform(36.3, 37.3, n_per_class)
    for i in range(n_per_class):
        rows.append([hr[i], spo2[i], temp[i]])
        labels.append(0)

    # Warning: elevated HR or lower SpO2 or mild fever
    hr = rng.uniform(100, 125, n_per_class)
    spo2 = rng.uniform(88, 96, n_per_class)
    temp = rng.uniform(37.2, 38.5, n_per_class)
    for i in range(n_per_class):
        rows.append([hr[i], spo2[i], temp[i]])
        labels.append(1)

    # High risk: critical combinations
    for _ in range(n_per_class):
        scenario = rng.integers(0, 4)
        if scenario == 0:
            rows.append([float(rng.uniform(120, 185)), float(rng.uniform(82, 92)), float(rng.uniform(36.5, 38.0))])
        elif scenario == 1:
            rows.append([float(rng.uniform(95, 140)), float(rng.uniform(75, 88)), float(rng.uniform(36.8, 37.5))])
        elif scenario == 2:
            rows.append([float(rng.uniform(110, 160)), float(rng.uniform(78, 90)), float(rng.uniform(38.5, 40.5))])
        else:
            rows.append([float(rng.uniform(130, 175)), float(rng.uniform(80, 89)), float(rng.uniform(37.0, 39.0))])
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
        MODEL_BACKEND = "random-forest"
        return joblib.load(MODEL_PATH)

    MODEL_BACKEND = "random-forest"
    return _train_and_save()


def get_model_backend() -> str:
    return MODEL_BACKEND


def _heuristic_adjustment(hr: float, spo2: float, temp_c: float) -> float:
    """Boost score when vitals cross clear clinical-style thresholds."""
    extra = 0.0
    if hr >= 120:
        extra += 12 + min(18, (hr - 120) * 0.4)
    elif hr >= 100:
        extra += 5 + (hr - 100) * 0.15
    if spo2 <= 88:
        extra += 20 + (88 - spo2) * 1.2
    elif spo2 <= 92:
        extra += 8 + (92 - spo2) * 1.5
    elif spo2 <= 94:
        extra += 3
    if temp_c >= 39.0:
        extra += 15 + (temp_c - 39.0) * 5
    elif temp_c >= 38.0:
        extra += 6 + (temp_c - 38.0) * 4
    return min(35.0, extra)


def _heuristic_probabilities(heart_rate: float, spo2: float, temperature_c: float) -> np.ndarray:
    score = 0.0

    if heart_rate >= 130:
        score += 40
    elif heart_rate >= 115:
        score += 25
    elif heart_rate >= 100:
        score += 12

    if spo2 <= 85:
        score += 50
    elif spo2 <= 90:
        score += 32
    elif spo2 <= 94:
        score += 15

    if temperature_c >= 39.5:
        score += 24
    elif temperature_c >= 38.5:
        score += 14
    elif temperature_c >= 37.8:
        score += 6

    score = max(0.0, min(100.0, score))
    p_high = score / 100.0
    p_warn = max(0.0, min(1.0, 0.15 + (p_high * 0.65)))
    p_norm = max(0.0, 1.0 - p_warn - p_high)

    raw = np.array([p_norm, p_warn, p_high], dtype=np.float64)
    total = float(raw.sum())
    if total <= 0:
        return np.array([1.0, 0.0, 0.0], dtype=np.float64)
    return raw / total


def predict_risk(heart_rate: float, spo2: float, temperature_c: float) -> dict:
    """
    Returns category, risk_score 0–100, sklearn class probabilities, and flags.
    """
    clf = ensure_model()
    if clf is None:
        proba = _heuristic_probabilities(heart_rate, spo2, temperature_c)
    else:
        X = np.array([[heart_rate, spo2, temperature_c]], dtype=np.float64)
        proba = clf.predict_proba(X)[0]

    # Map probabilities to a 0–100 score (emphasizes higher-risk classes)
    weights = np.array([0.12, 0.48, 1.0], dtype=np.float64)
    base_score = float(np.dot(proba, weights) * 100)
    base_score = max(0.0, min(100.0, base_score + _heuristic_adjustment(heart_rate, spo2, temperature_c)))

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
        },
    }
