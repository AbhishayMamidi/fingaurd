import datetime
import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, Numeric, String, Text
from app.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(20), nullable=False, default="expense")
    description = Column(String(255), nullable=False)
    merchant = Column(String(255), default="")
    category = Column(String(100), nullable=False, default="Other", index=True)
    date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    is_fraud_flagged = Column(Boolean, default=False, index=True)
    fraud_score = Column(Float, default=0.0)
    fraud_reason = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "amount": float(self.amount),
            "type": self.type,
            "description": self.description,
            "merchant": self.merchant,
            "category": self.category,
            "date": self.date.isoformat() if self.date else None,
            "is_fraud_flagged": bool(self.is_fraud_flagged),
            "fraud_score": float(self.fraud_score or 0.0),
            "fraud_reason": self.fraud_reason or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
