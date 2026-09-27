import datetime
import logging
import time
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.model import fraud_detector, DISCLAIMER
from app.consumer import fraud_consumer
from app.metrics import (
    http_requests_total,
    http_request_duration_seconds,
    fraud_checks_total,
    fraud_score_distribution,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='{"timestamp": "%(asctime)s", "service": "fraud-detection-service", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger("fraud-detection-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Fraud Detection Service...")
    fraud_consumer.start_background()
    yield
    logger.info("Stopping Fraud Detection Service...")
    fraud_consumer.stop()

app = FastAPI(
    title="FinGuard Fraud Detection Service",
    version="1.0.0",
    description="Anomaly detection service powered by scikit-learn Isolation Forest and heuristics",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FraudCheckRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in currency units")
    description: Optional[str] = Field("", max_length=255)
    merchant: Optional[str] = Field("", max_length=255)
    timestamp: Optional[datetime.datetime] = None
    type: Optional[str] = Field("expense", pattern="^(expense|income)$")

class FraudCheckResponse(BaseModel):
    is_fraud: bool
    fraud_score: float
    risk_level: str
    reasons: List[str]
    disclaimer: str
    model_version: str

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)

    start_time = time.time()
    response = await call_next(request)
    duration_s = time.time() - start_time
    duration_ms = duration_s * 1000

    endpoint = request.url.path
    route = request.scope.get("route")
    if route and hasattr(route, "path"):
        endpoint = route.path

    http_requests_total.labels(
        method=request.method,
        endpoint=endpoint,
        status=str(response.status_code)
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=endpoint
    ).observe(duration_s)

    logger.info(
        f"Handled {request.method} {request.url.path} - Status: {response.status_code} in {duration_ms:.2f}ms"
    )
    return response

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "fraud-detection-service",
        "rabbitmq": "connected" if fraud_consumer.connected else "connecting",
        "model_loaded": fraud_detector._is_trained,
        "model_version": settings.model_version
    }

@app.get("/api/fraud/health")
def api_health_check():
    return health_check()

@app.get("/metrics")
@app.get("/api/fraud/metrics")
def get_metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/model-info")
@app.get("/api/fraud/model-info")
def get_model_info():
    return {
        "model_name": "Isolation Forest + Financial Risk Heuristics",
        "model_version": settings.model_version,
        "n_estimators": 100,
        "contamination": 0.03,
        "features": ["amount", "hour_of_day", "is_weekend", "merchant_risk_score"],
        "disclaimer": DISCLAIMER,
        "intended_use": "Demonstration, educational, and developer prototyping only."
    }

@app.post("/detect", response_model=FraudCheckResponse)
@app.post("/api/fraud/detect", response_model=FraudCheckResponse)
def evaluate_transaction(req: FraudCheckRequest):
    try:
        result = fraud_detector.evaluate(
            amount=req.amount,
            description=req.description or "",
            merchant=req.merchant or "",
            timestamp=req.timestamp,
            tx_type=req.type or "expense"
        )
        fraud_checks_total.labels(
            is_fraud=str(result["is_fraud"]),
            risk_level=result["risk_level"]
        ).inc()
        fraud_score_distribution.observe(result["fraud_score"])
        return result
    except Exception as e:
        logger.error(f"Error evaluating fraud risk: {str(e)}")
        raise HTTPException(status_code=500, detail="Fraud detection service error")
