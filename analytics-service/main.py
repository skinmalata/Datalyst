from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any
import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

app = FastAPI(title="TrueAnalyzer Analytics", version="1.1")

class ForecastRequest(BaseModel):
    rows: list[dict[str, Any]]
    field: str
    timeField: str | None = None
    horizon: int = 12
    seasonalPeriods: int = 12

def fit(values: pd.Series, seasonal_periods: int):
    seasonal = "add" if len(values) >= seasonal_periods * 2 else None
    return ExponentialSmoothing(values, trend="add", seasonal=seasonal, seasonal_periods=seasonal_periods if seasonal else None, initialization_method="estimated").fit(optimized=True), seasonal

@app.get("/health")
def health(): return {"ok": True}

@app.post("/forecast")
def forecast(request: ForecastRequest):
    frame = pd.DataFrame(request.rows)
    if request.field not in frame:
        raise HTTPException(422, f"Field '{request.field}' is not present in the submitted rows.")
    if request.timeField and request.timeField in frame:
        frame["_time"] = pd.to_datetime(frame[request.timeField], errors="coerce")
        frame = frame.sort_values("_time", kind="stable")
    values = pd.to_numeric(frame[request.field], errors="coerce").dropna().reset_index(drop=True)
    if len(values) < 8:
        raise HTTPException(422, "A forecast needs at least eight valid observations.")
    holdouts = min(3, max(1, len(values) // 5))
    train, test = values.iloc[:-holdouts], values.iloc[-holdouts:]
    try:
        validation_model, validation_seasonal = fit(train, request.seasonalPeriods)
        predicted = validation_model.forecast(holdouts).to_numpy(dtype=float)
        actual = test.to_numpy(dtype=float)
        mape = float(np.mean(np.abs(actual - predicted) / np.maximum(np.abs(actual), 1)) * 100)
        mae = float(np.mean(np.abs(actual - predicted)))
        final_model, seasonal = fit(values, request.seasonalPeriods)
        projection = [round(float(value), 2) for value in final_model.forecast(request.horizon)]
    except (ValueError, np.linalg.LinAlgError) as error:
        raise HTTPException(422, f"The selected values cannot support this forecast: {error}")
    return {
        "forecast": projection,
        "totalForecast": round(sum(projection), 2),
        "method": "Holt-Winters additive trend and seasonality" if seasonal else "Holt linear trend exponential smoothing",
        "observedPeriods": len(values),
        "timeField": request.timeField,
        "validation": {"type": f"{holdouts}-period holdout", "mapePercent": round(mape, 2), "mae": round(mae, 2), "holdoutPeriods": holdouts},
        "seasonality": {"enabled": bool(seasonal), "periods": request.seasonalPeriods if seasonal else None, "reason": "At least two complete seasonal cycles were available." if seasonal else "Seasonality requires at least two complete cycles; trend-only model used."},
        "limitation": "Forecasts are estimates based on historical patterns; they do not include promotions, economic conditions, inventory constraints, or other external business drivers."
    }
