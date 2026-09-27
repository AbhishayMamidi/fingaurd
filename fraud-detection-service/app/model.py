import datetime
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, List, Optional

DISCLAIMER = "Experimental fraud detection model for demonstration purposes only. Not suitable for real financial decisions."

HIGH_RISK_KEYWORDS = [
    "casino", "gambling", "crypto tumbler", "offshore wire", "bitcoin atm",
    "darkweb", "unknown international", "western union offshore", "unrecognized withdrawal"
]

class FraudDetector:
    def __init__(self):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.03,
            random_state=42
        )
        self._is_trained = False
        self._train_baseline()

    def _train_baseline(self):
        """
        Trains Isolation Forest on synthetic normal spending distributions.
        Features: [amount, hour_of_day, is_weekend, merchant_risk_score]
        """
        np.random.seed(42)
        n_samples = 1500

        # Normal spending: amounts mostly $5 - $250, occasionally up to $800
        amounts = np.concatenate([
            np.random.gamma(shape=2.5, scale=20.0, size=int(n_samples * 0.85)),  # Normal grocery/dining $10-$150
            np.random.uniform(200, 800, size=int(n_samples * 0.15))               # Occasional electronics/bills
        ])

        # Normal hours: mostly 8 AM to 11 PM
        hour_weights = np.array([
            0.005, 0.005, 0.005, 0.005, 0.01, 0.02,  # 00:00 - 05:00
            0.04, 0.06, 0.08, 0.08, 0.07, 0.08,     # 06:00 - 11:00
            0.09, 0.08, 0.07, 0.07, 0.08, 0.09,     # 12:00 - 17:00
            0.08, 0.07, 0.05, 0.04, 0.02, 0.01      # 18:00 - 23:00
        ])
        hour_probs = hour_weights / np.sum(hour_weights)
        hours = np.random.choice(range(24), size=n_samples, p=hour_probs)

        weekends = np.random.choice([0, 1], size=n_samples, p=[0.71, 0.29])
        merchant_risk = np.zeros(n_samples) # Normal merchants have risk score 0

        X_train = np.column_stack([amounts, hours, weekends, merchant_risk])
        self.model.fit(X_train)
        self._is_trained = True

    def _extract_features(
        self,
        amount: float,
        timestamp: Optional[datetime.datetime] = None,
        merchant: Optional[str] = None
    ) -> np.ndarray:
        if timestamp is None:
            timestamp = datetime.datetime.now(datetime.timezone.utc)

        hour = timestamp.hour
        is_weekend = 1 if timestamp.weekday() >= 5 else 0

        # Heuristic merchant risk
        merchant_text = (merchant or "").lower()
        merchant_risk = 0.0
        for kw in HIGH_RISK_KEYWORDS:
            if kw in merchant_text:
                merchant_risk = 1.0
                break

        return np.array([[amount, hour, is_weekend, merchant_risk]])

    def evaluate(
        self,
        amount: float,
        description: str = "",
        merchant: Optional[str] = None,
        timestamp: Optional[datetime.datetime] = None,
        tx_type: str = "expense"
    ) -> Dict:
        """
        Evaluates a transaction for anomalous or fraudulent indicators.
        """
        # Income transactions are typically not flagged as consumer fraud anomalies
        if tx_type and tx_type.lower() == "income":
            return {
                "is_fraud": False,
                "fraud_score": 0.05,
                "risk_level": "LOW",
                "reasons": ["Income transaction considered standard profile."],
                "disclaimer": DISCLAIMER,
                "model_version": "v1.0-isolation-forest-experimental",
            }

        reasons = []
        features = self._extract_features(amount, timestamp, merchant)

        # Raw decision function from Isolation Forest:
        # Negative scores represent anomalies, positive scores represent normal
        raw_score = self.model.decision_function(features)[0]

        # Convert to 0.0 (safest) to 1.0 (most anomalous)
        # Typically raw_score ranges from -0.3 to +0.3
        normalized_score = float(np.clip(1.0 - (raw_score + 0.25) / 0.5, 0.0, 1.0))

        # Check heuristic indicators
        merchant_lower = (merchant or "").lower()
        desc_lower = (description or "").lower()
        combined_text = f"{merchant_lower} {desc_lower}"

        has_high_risk_keyword = False
        for kw in HIGH_RISK_KEYWORDS:
            if kw in combined_text:
                has_high_risk_keyword = True
                reasons.append(f"Matched high-risk indicator: '{kw}'")
                normalized_score = max(normalized_score, 0.92)
                break

        # High amount rule: > $2,000 for regular individual spending
        if amount >= 3000.0:
            reasons.append(f"Significantly elevated single-transaction volume (${amount:,.2f})")
            normalized_score = max(normalized_score, 0.85)
        elif amount >= 1500.0:
            reasons.append(f"Transaction amount (${amount:,.2f}) is over 3x standard daily baseline")
            normalized_score = max(normalized_score, 0.70)

        # Unusual hour rule: Between 1 AM and 4:30 AM
        hour = (timestamp or datetime.datetime.now(datetime.timezone.utc)).hour
        if 1 <= hour <= 4 and amount > 300.0:
            reasons.append(f"Unusual transaction timing ({hour:02d}:00 UTC) with elevated amount")
            normalized_score = max(normalized_score, 0.75)

        # Determine risk level
        if normalized_score >= 0.75:
            risk_level = "HIGH"
            is_fraud = True
            if not reasons:
                reasons.append("Multi-factor anomaly detected by Isolation Forest model")
        elif normalized_score >= 0.55:
            risk_level = "MEDIUM"
            is_fraud = normalized_score >= 0.70
            if not reasons:
                reasons.append("Moderate deviation from standard baseline behavior")
        else:
            risk_level = "LOW"
            is_fraud = False
            if not reasons:
                reasons.append("Consistent with typical consumer spending patterns")

        return {
            "is_fraud": is_fraud,
            "fraud_score": round(normalized_score, 3),
            "risk_level": risk_level,
            "reasons": reasons,
            "disclaimer": DISCLAIMER,
            "model_version": "v1.0-isolation-forest-experimental",
        }

fraud_detector = FraudDetector()
