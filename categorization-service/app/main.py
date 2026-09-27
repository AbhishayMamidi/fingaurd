import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.engine import engine
from app.consumer import consumer
from app.metrics import (
    http_requests_total,
    http_request_duration_seconds,
    categorization_requests_total,
    categorization_confidence,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='{"timestamp": "%(asctime)s", "service": "categorization-service", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger("categorization-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Categorization Service...")
    consumer.start_background()
    yield
    # Shutdown
    logger.info("Stopping Categorization Service...")
    consumer.stop()

app = FastAPI(
    title="FinGuard Categorization Service",
    version="1.0.0",
    description="Rule-based transaction categorization engine for personal finance",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    merchant: Optional[str] = Field(None, max_length=255)
    amount: Optional[float] = None
    type: Optional[str] = Field("expense", pattern="^(expense|income)$")

class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    rule_matched: str
    icon: str

class AddRuleRequest(BaseModel):
    category: str = Field(..., min_length=2, max_length=50)
    keyword: str = Field(..., min_length=2, max_length=50)
    icon: Optional[str] = "Tag"

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)

    start_time = time.time()
    response = await call_next(request)
    duration_s = time.time() - start_time
    process_time = duration_s * 1000

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
        f"Handled {request.method} {request.url.path} - Status: {response.status_code} in {process_time:.2f}ms"
    )
    return response

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "categorization-service",
        "rabbitmq": "connected" if consumer.connected else "connecting",
        "version": "1.0.0"
    }

# Also support gateway prefixed health route
@app.get("/api/categories/health")
def api_health_check():
    return health_check()

@app.get("/metrics")
@app.get("/api/categories/metrics")
def get_metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/categorize", response_model=CategorizeResponse)
@app.post("/api/categories/categorize", response_model=CategorizeResponse)
def categorize_transaction(req: CategorizeRequest):
    try:
        result = engine.categorize(
            description=req.description,
            merchant=req.merchant,
            amount=req.amount,
            tx_type=req.type
        )
        categorization_requests_total.labels(
            category=result["category"],
            rule_matched=result["rule_matched"]
        ).inc()
        categorization_confidence.observe(result["confidence"])
        return result
    except Exception as e:
        logger.error(f"Error during categorization: {str(e)}")
        raise HTTPException(status_code=500, detail="Categorization engine error")

@app.get("/rules")
@app.get("/api/categories/rules")
def get_rules():
    return {
        "status": "success",
        "rules": engine.get_all_rules()
    }

@app.post("/rules")
@app.post("/api/categories/rules")
def add_rule(req: AddRuleRequest):
    updated = engine.add_rule(req.category, req.keyword, req.icon or "Tag")
    return {
        "message": f"Rule successfully added for category '{req.category}'",
        "category_rules": updated
    }
