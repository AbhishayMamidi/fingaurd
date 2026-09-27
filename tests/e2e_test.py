"""
FinGuard End-to-End Automated Integration Test Suite
Verifies the complete flow across all microservices:
API Gateway -> Auth -> Transactions -> Categorization -> Fraud Detection -> Budgets & Alerts
"""

import os
import sys
import time
import uuid
import requests

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8080")

def log(msg):
    print(f"[E2E TEST] {msg}")

def run_tests():
    log(f"Targeting API Gateway at {GATEWAY_URL}")
    session = requests.Session()

    # Step 1: Gateway Health Check
    log("1. Checking API Gateway Health...")
    res = session.get(f"{GATEWAY_URL}/health", timeout=5)
    assert res.status_code == 200, f"Gateway health failed: {res.text}"
    log("[PASS] API Gateway is healthy")

    # Step 2: User Registration
    test_id = str(uuid.uuid4())[:8]
    email = f"test_{test_id}@finguard-test.io"
    password = "SuperSecurePassword123!"
    full_name = f"Test User {test_id}"

    log(f"2. Registering new user: {email}...")
    res = session.post(
        f"{GATEWAY_URL}/api/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
        timeout=5
    )
    assert res.status_code == 201, f"Registration failed ({res.status_code}): {res.text}"
    auth_data = res.json()
    token = auth_data.get("token")
    user_id = auth_data["user"]["id"]
    assert token, "Token not returned in registration response"
    log(f"[PASS] Registered user {user_id}")

    # Set Auth Header for subsequent calls
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Step 3: Login Verification
    log("3. Verifying user login...")
    login_res = session.post(
        f"{GATEWAY_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=5
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    log("[PASS] Login successful")

    # Step 4: Verify Profile
    log("4. Fetching authenticated profile...")
    me_res = session.get(f"{GATEWAY_URL}/api/auth/me", headers=headers, timeout=5)
    assert me_res.status_code == 200, f"Get profile failed: {me_res.text}"
    assert me_res.json()["user"]["email"] == email
    log("[PASS] Profile verified")

    # Step 5: Set Monthly Budgets
    log("5. Setting category budgets...")
    b_res1 = session.post(
        f"{GATEWAY_URL}/api/budgets",
        headers=headers,
        json={"category": "Food & Dining", "monthly_limit": 500.0},
        timeout=5
    )
    assert b_res1.status_code == 201, f"Budget creation failed: {b_res1.text}"

    b_res2 = session.post(
        f"{GATEWAY_URL}/api/budgets",
        headers=headers,
        json={"category": "Entertainment", "monthly_limit": 100.0},
        timeout=5
    )
    assert b_res2.status_code == 201
    log("[PASS] Budgets configured for 'Food & Dining' ($500) and 'Entertainment' ($100)")

    # Step 6: Create Normal Transactions (Rule-based auto-categorization & normal fraud score)
    log("6. Creating standard expense transaction (Auto-categorization)...")
    tx1_res = session.post(
        f"{GATEWAY_URL}/api/transactions",
        headers=headers,
        json={
            "amount": 85.50,
            "merchant": "Whole Foods Market",
            "description": "Weekly grocery items and produce",
            "type": "expense"
        },
        timeout=5
    )
    assert tx1_res.status_code == 201, f"Tx 1 failed: {tx1_res.text}"
    tx1 = tx1_res.json()
    assert tx1["category"] == "Food & Dining", f"Expected 'Food & Dining', got {tx1['category']}"
    assert tx1["is_fraud_flagged"] is False, "Normal grocery transaction should not be flagged as fraud"
    log(f"[PASS] Tx 1 auto-categorized as '{tx1['category']}' with fraud_score={tx1['fraud_score']}")

    # Step 7: Create High-Risk Anomalous Transaction (Fraud Detection Check)
    log("7. Creating anomalous high-risk transaction (Offshore crypto transfer)...")
    tx_fraud_res = session.post(
        f"{GATEWAY_URL}/api/transactions",
        headers=headers,
        json={
            "amount": 4500.00,
            "merchant": "Crypto Tumbler Global Overseas",
            "description": "Immediate wire transfer",
            "type": "expense"
        },
        timeout=5
    )
    assert tx_fraud_res.status_code == 201, f"Tx fraud creation failed: {tx_fraud_res.text}"
    tx_fraud = tx_fraud_res.json()
    assert tx_fraud["is_fraud_flagged"] is True, f"Expected fraud flag to be True! Got: {tx_fraud}"
    assert tx_fraud["fraud_score"] >= 0.70, f"Expected high fraud score >= 0.70! Got: {tx_fraud['fraud_score']}"
    log(f"[PASS] Anomaly correctly flagged: score={tx_fraud['fraud_score']}, reasons={tx_fraud['fraud_reason']}")

    # Step 8: Verify Summary Endpoint
    log("8. Verifying transaction summary aggregation...")
    sum_res = session.get(f"{GATEWAY_URL}/api/transactions/summary", headers=headers, timeout=5)
    assert sum_res.status_code == 200, f"Summary failed: {sum_res.text}"
    summary = sum_res.json()
    assert summary["total_expenses"] == 4585.50
    assert summary["fraud_flagged_count"] == 1
    log(f"[PASS] Summary verified: total_expenses=${summary['total_expenses']}, fraud_count={summary['fraud_flagged_count']}")

    # Step 9: Seed Demo Data
    log("9. Testing synthetic demo data seeder...")
    seed_res = session.post(f"{GATEWAY_URL}/api/transactions/seed-demo", headers=headers, timeout=10)
    assert seed_res.status_code == 200, f"Seeding failed: {seed_res.text}"
    seeded_count = seed_res.json().get("seeded_count", 0)
    assert seeded_count > 0, "No demo records were seeded"
    log(f"[PASS] Successfully seeded {seeded_count} synthetic transactions")

    # Step 10: Verify Isolation
    log("10. Testing user data isolation with separate user account...")
    other_email = f"other_{uuid.uuid4().hex[:8]}@test.io"
    other_reg = session.post(
        f"{GATEWAY_URL}/api/auth/register",
        json={"email": other_email, "password": "Password123!", "full_name": "Other User"},
        timeout=5
    )
    other_token = other_reg.json()["token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    other_txs = session.get(f"{GATEWAY_URL}/api/transactions", headers=other_headers, timeout=5).json()
    assert other_txs["total"] == 0, f"Data isolation breach: Other user saw {other_txs['total']} transactions!"
    log("[PASS] Data isolation verified: User B sees 0 transactions")

    log("\n=======================================================")
    log("ALL 10 END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY!")
    log("=======================================================\n")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] E2E TEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
