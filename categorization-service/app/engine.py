import re
from typing import Dict, List, Optional, Tuple

DEFAULT_RULES = {
    "Income": {
        "keywords": [
            "salary", "payroll", "direct deposit", "paycheck", "freelance",
            "dividend", "bonus", "interest earned", "stripe payout", "paypal payout",
            "refund", "cashback", "stipend"
        ],
        "icon": "TrendingUp",
    },
    "Food & Dining": {
        "keywords": [
            "grocery", "groceries", "supermarket", "restaurant", "uber eats",
            "doordash", "grubhub", "starbucks", "mcdonald", "walmart grocery",
            "cafe", "coffee", "chipotle", "whole foods", "trader joe",
            "bakery", "burger", "pizza", "taco", "diner", "bistro", "kroger"
        ],
        "icon": "Utensils",
    },
    "Utilities & Bills": {
        "keywords": [
            "electric", "electricity", "water", "gas bill", "internet",
            "wifi", "verizon", "at&t", "t-mobile", "broadband", "comcast",
            "utility", "bill pay", "pg&e", "coned", "power", "waste management"
        ],
        "icon": "Zap",
    },
    "Housing & Rent": {
        "keywords": [
            "rent", "mortgage", "lease", "apartment", "hoa", "maintenance fee",
            "property tax", "landlord", "housing", "realty"
        ],
        "icon": "Home",
    },
    "Transportation": {
        "keywords": [
            "uber", "lyft", "shell", "chevron", "bp", "fuel", "gas station",
            "exxon", "subway", "metro", "transit", "parking", "toll",
            "amtrak", "train", "bus fare", "chargepoint", "ev charging"
        ],
        "icon": "Car",
    },
    "Entertainment": {
        "keywords": [
            "netflix", "spotify", "cinema", "hulu", "hbo", "disney",
            "prime video", "steam", "playstation", "nintendo", "xbox",
            "concert", "ticketmaster", "movie", "theater", "audible", "youtube premium"
        ],
        "icon": "Film",
    },
    "Shopping": {
        "keywords": [
            "amazon", "target", "ebay", "apple store", "best buy",
            "walmart", "clothing", "zara", "nike", "adidas", "ikea",
            "home depot", "costco", "h&m", "nordstrom", "etsy"
        ],
        "icon": "ShoppingBag",
    },
    "Healthcare": {
        "keywords": [
            "pharmacy", "cvs", "walgreens", "hospital", "clinic", "doctor",
            "dental", "dentist", "vision", "optical", "labcorp", "prescription",
            "medical", "health", "urgent care"
        ],
        "icon": "HeartPulse",
    },
    "Travel": {
        "keywords": [
            "airline", "delta", "united air", "american airlines", "southwest",
            "airbnb", "hotel", "marriott", "hilton", "expedia", "booking.com",
            "car rental", "hertz", "flight", "hostel"
        ],
        "icon": "Plane",
    }
}

class CategorizationEngine:
    def __init__(self):
        self.rules: Dict[str, Dict] = DEFAULT_RULES.copy()

    def categorize(
        self,
        description: str,
        merchant: Optional[str] = None,
        amount: Optional[float] = None,
        tx_type: Optional[str] = None
    ) -> Dict:
        """
        Categorize a transaction based on rules.
        Returns a dict with category, confidence, rule_matched, and icon.
        """
        # If transaction is explicitly marked as income and amount > 0
        if tx_type and tx_type.lower() == "income":
            return {
                "category": "Income",
                "confidence": 0.95,
                "rule_matched": "Transaction type marked as income",
                "icon": "TrendingUp",
            }

        text_to_scan = f"{merchant or ''} {description or ''}".lower()

        # Check Income rules first
        for kw in self.rules["Income"]["keywords"]:
            if re.search(r"\b" + re.escape(kw) + r"\b", text_to_scan):
                return {
                    "category": "Income",
                    "confidence": 0.90,
                    "rule_matched": f"Keyword matched: '{kw}'",
                    "icon": self.rules["Income"]["icon"],
                }

        # Check Expense categories
        best_category = "Other"
        best_confidence = 0.50
        matched_rule = "Default fallback category"
        best_icon = "HelpCircle"

        for category, details in self.rules.items():
            if category == "Income":
                continue
            for kw in details["keywords"]:
                # Check exact or partial match
                if re.search(r"\b" + re.escape(kw) + r"\b", text_to_scan):
                    return {
                        "category": category,
                        "confidence": 0.88,
                        "rule_matched": f"Keyword matched: '{kw}'",
                        "icon": details.get("icon", "Tag"),
                    }
                elif kw in text_to_scan:
                    # Substring match with slightly lower confidence
                    if best_confidence < 0.75:
                        best_category = category
                        best_confidence = 0.75
                        matched_rule = f"Substring matched: '{kw}'"
                        best_icon = details.get("icon", "Tag")

        return {
            "category": best_category,
            "confidence": best_confidence,
            "rule_matched": matched_rule,
            "icon": best_icon,
        }

    def get_all_rules(self) -> Dict[str, Dict]:
        return self.rules

    def add_rule(self, category: str, keyword: str, icon: str = "Tag"):
        keyword_clean = keyword.strip().lower()
        if category not in self.rules:
            self.rules[category] = {"keywords": [], "icon": icon}
        if keyword_clean not in self.rules[category]["keywords"]:
            self.rules[category]["keywords"].append(keyword_clean)
        return self.rules[category]

engine = CategorizationEngine()
