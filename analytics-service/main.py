import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Any
import numpy as np
import pandas as pd

app = FastAPI(title="Datalyst Analytics", version="1.2")

class ForecastRequest(BaseModel):
    rows: list[dict[str, Any]]
    field: str
    timeField: str | None = None
    horizon: int = 12

def linear_regression(values: np.ndarray):
    n = len(values)
    xs = np.arange(n, dtype=float)
    mean_x = xs.mean()
    mean_y = values.mean()
    denom = np.sum((xs - mean_x) ** 2) or 1.0
    slope = np.sum((xs - mean_x) * (values - mean_y)) / denom
    intercept = mean_y - slope * mean_x
    return slope, intercept

@app.get("/health")
def health(): return {"ok": True}

@app.post("/forecast")
def forecast(request: ForecastRequest, authorization: str | None = Header(default=None)):
    service_token = os.getenv("ANALYTICS_SERVICE_TOKEN")
    if service_token and authorization != f"Bearer {service_token}":
        raise HTTPException(401, "Service authentication is required.")
    frame = pd.DataFrame(request.rows)
    if request.field not in frame:
        raise HTTPException(422, f"Field '{request.field}' is not present in the submitted rows.")
    if request.timeField and request.timeField in frame:
        frame["_time"] = pd.to_datetime(frame[request.timeField], errors="coerce")
        frame = frame.sort_values("_time", kind="stable")
    values = pd.to_numeric(frame[request.field], errors="coerce").dropna().reset_index(drop=True).to_numpy(dtype=float)
    if len(values) < 4:
        raise HTTPException(422, "A forecast needs at least four valid observations.")
    slope, intercept = linear_regression(values)
    n = len(values)
    projection = [round(float(intercept + slope * (n + i)), 2) for i in range(request.horizon)]
    holdouts = min(3, max(1, n // 5))
    train_values = values[:-holdouts]
    test_values = values[-holdouts:]
    train_slope, train_intercept = linear_regression(train_values)
    predicted = np.array([train_intercept + train_slope * (len(train_values) + i) for i in range(holdouts)])
    actual = test_values
    mape = float(np.mean(np.abs(actual - predicted) / np.maximum(np.abs(actual), 1)) * 100)
    mae = float(np.mean(np.abs(actual - predicted)))
    total = round(sum(projection), 2)
    direction = "upward" if slope >= 0 else "downward"
    confidence = "medium" if n >= 6 else "directional"
    return {
        "forecast": projection,
        "totalForecast": total,
        "method": "Linear trend regression",
        "observedPeriods": n,
        "timeField": request.timeField,
        "trend": {"slope": round(float(slope), 4), "intercept": round(float(intercept), 2), "direction": direction},
        "validation": {"type": f"{holdouts}-period holdout", "mapePercent": round(mape, 2), "mae": round(mae, 2), "holdoutPeriods": holdouts},
        "confidence": confidence,
        "limitation": "Forecasts are estimates based on historical patterns; they do not include promotions, economic conditions, inventory constraints, or other external business drivers."
    }
