import datetime
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional
import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.config import settings
from app.database import get_db, init_db
from app.metrics import (
    http_requests_total,
    http_request_duration_seconds,
    transactions_created_total,
    fraud_flagged_transactions_total,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from app.models import Transaction
from app.publisher import publisher

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='{"timestamp": "%(asctime)s", "service": "transaction-service", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger("transaction-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Transaction Service...")
    init_db()
    publisher.connect()
    yield
    logger.info("Shutting down Transaction Service...")

app = FastAPI(
    title="FinGuard Transaction Service",
    version="1.0.0",
    description="Transaction management, categorization orchestration, and fraud check integration",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount must be positive")
    type: str = Field("expense", pattern="^(expense|income)$")
    description: str = Field(..., min_length=1, max_length=255)
    merchant: Optional[str] = Field("", max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    date: Optional[datetime.datetime] = None

class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[str] = Field(None, pattern="^(expense|income)$")
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    merchant: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    date: Optional[datetime.datetime] = None

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)

    start = time.time()
    response = await call_next(request)
    duration_s = time.time() - start
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

    logger.info(f"Handled {request.method} {request.url.path} - Status: {response.status_code} in {duration_ms:.2f}ms")
    return response

# Inter-service helpers
async def auto_categorize(description: str, merchant: str, amount: float, tx_type: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post(
                f"{settings.categorization_service_url}/categorize",
                json={
                    "description": description,
                    "merchant": merchant,
                    "amount": amount,
                    "type": tx_type
                }
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("category", "Other")
    except Exception as e:
        logger.warning(f"Categorization service unavailable, defaulting to 'Other': {e}")
    return "Other"

async def check_fraud(amount: float, description: str, merchant: str, timestamp: datetime.datetime, tx_type: str):
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post(
                f"{settings.fraud_service_url}/detect",
                json={
                    "amount": amount,
                    "description": description,
                    "merchant": merchant,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                    "type": tx_type
                }
            )
            if res.status_code == 200:
                data = res.json()
                return (
                    bool(data.get("is_fraud", False)),
                    float(data.get("fraud_score", 0.0)),
                    "; ".join(data.get("reasons", []))
                )
    except Exception as e:
        logger.warning(f"Fraud detection service unavailable during evaluation: {e}")
    return False, 0.0, ""

# Health Check
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "transaction-service",
        "database": "connected" if db_ok else "error",
        "rabbitmq": "connected" if publisher.is_connected else "disconnected"
    }

@app.get("/api/transactions/health")
def api_health(db: Session = Depends(get_db)):
    return health_check(db)

@app.get("/metrics")
@app.get("/api/transactions/metrics")
def get_metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# CRUD Endpoints
@app.get("/transactions")
@app.get("/api/transactions")
def list_transactions(
    category: Optional[str] = None,
    type: Optional[str] = None,
    is_fraud: Optional[bool] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime.datetime] = None,
    end_date: Optional[datetime.datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == user_id)

    if category:
        query = query.filter(Transaction.category == category)
    if type:
        query = query.filter(Transaction.type == type)
    if is_fraud is not None:
        query = query.filter(Transaction.is_fraud_flagged == is_fraud)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Transaction.description.ilike(search_filter)) |
            (Transaction.merchant.ilike(search_filter))
        )
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    total_count = query.count()
    items = query.order_by(desc(Transaction.date)).offset(offset).limit(limit).all()

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "items": [item.to_dict() for item in items]
    }

@app.post("/transactions", status_code=status.HTTP_201_CREATED)
@app.post("/api/transactions", status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    tx_date = payload.date or datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Automatic Categorization if not explicitly provided
    assigned_category = payload.category
    if not assigned_category or assigned_category.strip().lower() == "other":
        assigned_category = await auto_categorize(
            description=payload.description,
            merchant=payload.merchant or "",
            amount=payload.amount,
            tx_type=payload.type
        )

    # 2. Fraud Anomaly Check
    is_fraud, fraud_score, fraud_reason = await check_fraud(
        amount=payload.amount,
        description=payload.description,
        merchant=payload.merchant or "",
        timestamp=tx_date,
        tx_type=payload.type
    )

    # 3. Create Record
    tx = Transaction(
        id=str(uuid.uuid4()),
        user_id=user_id,
        amount=payload.amount,
        type=payload.type,
        description=payload.description,
        merchant=payload.merchant or "",
        category=assigned_category,
        date=tx_date,
        is_fraud_flagged=is_fraud,
        fraud_score=fraud_score,
        fraud_reason=fraud_reason,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    # Record Prometheus business metrics
    transactions_created_total.labels(
        type=tx.type,
        category=tx.category or "Other"
    ).inc()
    if tx.is_fraud_flagged:
        fraud_flagged_transactions_total.inc()

    # 4. Asynchronously Publish Event to RabbitMQ
    event_data = {
        "event_id": str(uuid.uuid4()),
        "event_type": "TRANSACTION_CREATED",
        "transaction_id": tx.id,
        "user_id": tx.user_id,
        "amount": float(tx.amount),
        "type": tx.type,
        "category": tx.category,
        "description": tx.description,
        "merchant": tx.merchant,
        "date": tx.date.isoformat(),
        "is_fraud_flagged": tx.is_fraud_flagged,
        "fraud_score": float(tx.fraud_score or 0.0),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    publisher.publish_event("transaction.created", event_data)

    return tx.to_dict()

@app.get("/transactions/summary")
@app.get("/api/transactions/summary")
def get_summary(
    month: Optional[str] = None, # e.g. "2026-09"
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    all_txs = query.all()

    total_income = 0.0
    total_expenses = 0.0
    category_totals = {}
    fraud_count = 0

    for tx in all_txs:
        amt = float(tx.amount)
        if tx.is_fraud_flagged:
            fraud_count += 1
        if tx.type == "income":
            total_income += amt
        else:
            total_expenses += amt
            cat = tx.category or "Other"
            category_totals[cat] = category_totals.get(cat, 0.0) + amt

    category_breakdown = [
        {
            "category": cat,
            "total": round(total, 2),
            "percentage": round((total / total_expenses * 100), 1) if total_expenses > 0 else 0.0
        }
        for cat, total in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_balance": round(total_income - total_expenses, 2),
        "fraud_flagged_count": fraud_count,
        "total_transactions": len(all_txs),
        "category_breakdown": category_breakdown
    }

@app.get("/transactions/{transaction_id}")
@app.get("/api/transactions/{transaction_id}")
def get_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return tx.to_dict()

@app.put("/transactions/{transaction_id}")
@app.put("/api/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.type is not None:
        tx.type = payload.type
    if payload.description is not None:
        tx.description = payload.description
    if payload.merchant is not None:
        tx.merchant = payload.merchant
    if payload.category is not None:
        tx.category = payload.category
    if payload.date is not None:
        tx.date = payload.date

    # Re-evaluate fraud if amount or merchant changed
    if payload.amount is not None or payload.merchant is not None:
        is_fraud, score, reason = await check_fraud(
            amount=float(tx.amount),
            description=tx.description,
            merchant=tx.merchant,
            timestamp=tx.date,
            tx_type=tx.type
        )
        tx.is_fraud_flagged = is_fraud
        tx.fraud_score = score
        tx.fraud_reason = reason

    db.commit()
    db.refresh(tx)

    # Publish updated event
    publisher.publish_event("transaction.updated", {
        "event_id": str(uuid.uuid4()),
        "event_type": "TRANSACTION_UPDATED",
        "transaction_id": tx.id,
        "user_id": tx.user_id,
        "amount": float(tx.amount),
        "type": tx.type,
        "category": tx.category,
        "date": tx.date.isoformat(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    })

    return tx.to_dict()

@app.delete("/transactions/{transaction_id}")
@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == user_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    db.delete(tx)
    db.commit()

    publisher.publish_event("transaction.deleted", {
        "event_id": str(uuid.uuid4()),
        "event_type": "TRANSACTION_DELETED",
        "transaction_id": transaction_id,
        "user_id": user_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    })

    return {"message": "Transaction deleted successfully.", "id": transaction_id}

@app.post("/transactions/seed-demo")
@app.post("/api/transactions/seed-demo")
async def seed_demo_data(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Seeds clearly labeled synthetic demo data for rapid testing and demonstration.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    
    demo_records = [
        # Normal Incomes
        {"amount": 4200.00, "type": "income", "category": "Income", "merchant": "FinTech Innovations Inc", "description": "Bi-Weekly Salary Deposit", "days_ago": 20},
        {"amount": 4200.00, "type": "income", "category": "Income", "merchant": "FinTech Innovations Inc", "description": "Bi-Weekly Salary Deposit", "days_ago": 5},
        {"amount": 350.00, "type": "income", "category": "Income", "merchant": "Freelance Client", "description": "UI Consulting Project", "days_ago": 12},

        # Normal Everyday Expenses
        {"amount": 1850.00, "type": "expense", "category": "Housing & Rent", "merchant": "Oakridge Apartments", "description": "Monthly Apartment Rent", "days_ago": 26},
        {"amount": 142.30, "type": "expense", "category": "Food & Dining", "merchant": "Whole Foods Market", "description": "Weekly organic groceries", "days_ago": 22},
        {"amount": 85.50, "type": "expense", "category": "Utilities & Bills", "merchant": "City Electric & Power", "description": "Residential electricity bill", "days_ago": 18},
        {"amount": 65.00, "type": "expense", "category": "Utilities & Bills", "merchant": "Verizon Wireless", "description": "Unlimited 5G Mobile Plan", "days_ago": 15},
        {"amount": 54.20, "type": "expense", "category": "Transportation", "merchant": "Chevron Gas Station", "description": "Full tank fuel refill", "days_ago": 14},
        {"amount": 28.50, "type": "expense", "category": "Food & Dining", "merchant": "Chipotle Mexican Grill", "description": "Dinner with colleague", "days_ago": 11},
        {"amount": 18.99, "type": "expense", "category": "Entertainment", "merchant": "Netflix", "description": "Premium 4K Streaming Subscription", "days_ago": 10},
        {"amount": 11.99, "type": "expense", "category": "Entertainment", "merchant": "Spotify", "description": "Family music subscription", "days_ago": 8},
        {"amount": 210.45, "type": "expense", "category": "Shopping", "merchant": "Target", "description": "Home decor and supplies", "days_ago": 6},
        {"amount": 32.40, "type": "expense", "category": "Transportation", "merchant": "Uber", "description": "Airport ride downtown", "days_ago": 4},
        {"amount": 95.00, "type": "expense", "category": "Healthcare", "merchant": "CVS Pharmacy", "description": "Prescription refill & vitamins", "days_ago": 3},
        {"amount": 45.00, "type": "expense", "category": "Food & Dining", "merchant": "Starbucks Reserve", "description": "Coffee and pastries for team", "days_ago": 1},

        # Clearly Labeled Synthetic Fraud Alert Records
        {
            "amount": 4850.00,
            "type": "expense",
            "category": "Other",
            "merchant": "Crypto Tumbler Global Overseas",
            "description": "[DEMO FRAUD] Suspicious Offshore Fast Transfer",
            "days_ago": 2,
            "is_fraud": True,
            "fraud_score": 0.94,
            "fraud_reason": "High-risk merchant profile flag; Matched high-risk indicator: 'crypto tumbler'; Significantly elevated single-transaction volume ($4,850.00)"
        },
        {
            "amount": 1950.00,
            "type": "expense",
            "category": "Other",
            "merchant": "Unknown Casino Offshore",
            "description": "[DEMO FRAUD] 03:15 AM High Stakes Transaction",
            "days_ago": 7,
            "is_fraud": True,
            "fraud_score": 0.88,
            "fraud_reason": "Matched high-risk indicator: 'casino'; Unusual transaction timing (03:15 AM) with elevated amount"
        }
    ]

    count = 0
    for record in demo_records:
        tx_time = now - datetime.timedelta(days=record["days_ago"], hours=3)
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            amount=record["amount"],
            type=record["type"],
            description=record["description"],
            merchant=record["merchant"],
            category=record["category"],
            date=tx_time,
            is_fraud_flagged=record.get("is_fraud", False),
            fraud_score=record.get("fraud_score", 0.05),
            fraud_reason=record.get("fraud_reason", "Routine transaction verified")
        )
        db.add(tx)
        count += 1

    db.commit()
    logger.info(f"Seeded {count} synthetic demo transactions for user {user_id}")
    return {
        "status": "success",
        "message": f"Successfully seeded {count} labeled synthetic demo transactions.",
        "seeded_count": count
    }
