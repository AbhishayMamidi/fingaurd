"""
FinGuard HPA Load Test & Autoscaling Verification Script.
Generates controlled, concurrent HTTP load against transaction-service endpoints
to drive CPU utilization above the HPA target and trigger horizontal scaling.
"""

import os
import time
import uuid
import threading
import requests

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8081")
DURATION_SECONDS = 40
CONCURRENCY = 16

def get_auth_token():
    test_id = str(uuid.uuid4())[:8]
    email = f"loadtest_{test_id}@finguard-test.io"
    password = "SuperSecurePassword123!"
    reg_resp = requests.post(
        f"{GATEWAY_URL}/api/auth/register",
        json={"email": email, "password": password, "full_name": f"HPA Tester {test_id}"},
        timeout=5,
    )
    if reg_resp.status_code == 201:
        return reg_resp.json().get("token")
    
    # Fallback to login
    login_resp = requests.post(
        f"{GATEWAY_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=5,
    )
    return login_resp.json().get("token")

def worker(token, stop_event, stats):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    session = requests.Session()
    session.headers.update(headers)
    
    while not stop_event.is_set():
        try:
            # Query summary and transactions list
            r = session.get(f"{GATEWAY_URL}/api/transactions/summary", timeout=2)
            if r.status_code == 200:
                stats["success"] += 1
            else:
                stats["other"] += 1
        except Exception:
            stats["errors"] += 1

def main():
    print("=" * 60)
    print("FinGuard HPA Load Generator")
    print(f"Targeting: {GATEWAY_URL}")
    print(f"Concurrency: {CONCURRENCY} workers | Duration: {DURATION_SECONDS}s")
    print("=" * 60)

    token = get_auth_token()
    if not token:
        print("[ERROR] Failed to obtain authentication token.")
        return

    # Seed demo data so summary computation has data
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    requests.post(f"{GATEWAY_URL}/api/transactions/seed-demo", headers=headers, timeout=5)

    print("[INFO] Authentication token acquired and demo data seeded. Starting load workers...")
    stop_event = threading.Event()
    stats = {"success": 0, "other": 0, "errors": 0}
    threads = []

    for i in range(CONCURRENCY):
        t = threading.Thread(target=worker, args=(token, stop_event, stats))
        t.daemon = True
        threads.append(t)
        t.start()

    start_time = time.time()
    while time.time() - start_time < DURATION_SECONDS:
        elapsed = int(time.time() - start_time)
        print(f"[{elapsed:02d}s] Requests completed: {stats['success']} (errors: {stats['errors']})")
        time.sleep(5)

    print("[INFO] Load duration reached. Stopping workers...")
    stop_event.set()
    for t in threads:
        t.join(timeout=2)

    total_time = time.time() - start_time
    rps = stats["success"] / total_time if total_time > 0 else 0
    print("=" * 60)
    print(f"[SUMMARY] Total successful requests: {stats['success']}")
    print(f"[SUMMARY] Total elapsed time: {total_time:.1f}s (~{rps:.1f} req/s)")
    print("=" * 60)

if __name__ == "__main__":
    main()
