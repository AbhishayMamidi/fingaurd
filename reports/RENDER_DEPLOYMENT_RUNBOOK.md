# FinGuard — Render Cloud Deployment Runbook

**Operational Runbook Version:** 1.0.0  
**Target:** Render Cloud Platform (`https://dashboard.render.com`)  
**Audience:** DevOps Engineers, Cloud Operators, Site Reliability Engineers  

---

## 1. Prerequisites Checklist

Before initiating deployment on Render, ensure the following are available:
1. **GitHub Account:** Connected to Render with read access to `AbhishayMamidi/fingaurd`.
2. **Render Account:** Free personal workspace at `https://dashboard.render.com`.
3. **CloudAMQP Account (Optional for RabbitMQ):** Free "Little Lemur" instance URL (`amqps://...`) if live asynchronous event processing is enabled.
4. **Git State:** All local pre-deployment changes verified and pushed to `main`.

---

## 2. Step-by-Step Blueprint Deployment Guide

### Step 1: Sign in and Create Blueprint Instance
1. Navigate to [Render Dashboard](https://dashboard.render.com/).
2. Click the **"New +"** button in the top navigation bar.
3. Select **"Blueprint"**.
4. Choose the repository: **`AbhishayMamidi/fingaurd`** (Branch: `main`).
5. Render will automatically parse `render.yaml` and display the list of resources to be provisioned.

### Step 2: Review Resource Plan and Pricing
* **Databases:** `finguard-postgres` (Free Plan, $0/month)
* **Static Sites:** `finguard-frontend` (Free Plan, $0/month)
* **Web Services:** `finguard-gateway`, `finguard-auth`, `finguard-transactions`, `finguard-categorization`, `finguard-fraud`, `finguard-budget` (Free Plan, $0/month)
* **Total Estimated Monthly Cost:** **$0.00 / month** (100% Free Tier Eligible)

### Step 3: Configure Environment Variables
* For `JWT_SECRET`: Render will automatically generate a cryptographically secure random value.
* For `DATABASE_URL`: Render will automatically wire the internal connection string.
* For `RABBITMQ_URL`: Paste your CloudAMQP `amqps://...` connection URL into the input field (or leave blank if testing in decoupled HTTP mode).

### Step 4: Apply Blueprint
1. Click **"Apply"** or **"Create Blueprint Instance"**.
2. Render will trigger builds concurrently across all services.
3. Monitor build progress in the deployment console for each service.

---

## 3. Database Schema Verification

All microservices run idempotent `CREATE TABLE IF NOT EXISTS` migrations automatically on startup.

If manual database verification or external seeding is required:
```powershell
# Set target Render PostgreSQL connection string
$env:DATABASE_URL = "postgres://<user>:<password>@<render-postgres-host>:5432/finguard"

# Run schema initialization script
python scripts/init_render_db.py
```

---

## 4. Post-Deployment Smoke Verification

Once all services indicate **"Live"** (healthy green checkmark):
1. Copy the public URL of `finguard-frontend` (e.g. `https://finguard-frontend.onrender.com`).
2. Copy the public URL of `finguard-gateway` (e.g. `https://finguard-gateway.onrender.com`).
3. Verify Gateway Health:
   ```powershell
   curl -i https://finguard-gateway.onrender.com/health
   # Expected: HTTP 200 {"status":"healthy","service":"api-gateway","version":"1.0.0"}
   ```
4. Run the automated E2E integration suite against the live gateway:
   ```powershell
   $env:GATEWAY_URL = "https://finguard-gateway.onrender.com"
   python tests/e2e_test.py
   # Expected: ALL 10 END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY!
   ```

---

## 5. Operations, Logs & Troubleshooting

### Viewing Logs in Real Time
1. Go to the [Render Dashboard](https://dashboard.render.com).
2. Click on the failing service (e.g. `finguard-auth`).
3. Select the **"Logs"** tab to view standard output and error streams.

### Handling Free Tier Spin-Down / Cold Starts
* Free Web Services on Render automatically spin down after 15 minutes of inactivity.
* When receiving the first request, the service will wake up within 30–50 seconds.
* To avoid timeout errors during cold starts, the frontend API client implements automatic retry logic.

### Manual Redeployments
* When new commits are pushed to `main` on GitHub, Render automatically triggers a rolling redeployment.
* To trigger a manual rebuild without Git changes:
  1. Open the service dashboard in Render.
  2. Click **"Manual Deploy"** > **"Deploy latest commit"** or **"Clear build cache & deploy"**.

---

## 6. Safe Decommissioning / Resource Removal

To remove resources cleanly without leaving lingering cloud instances:
1. Open the [Render Dashboard](https://dashboard.render.com).
2. Go to the **Blueprints** tab and select the `finguard` Blueprint instance.
3. Click **"Settings"** > **"Delete Blueprint"**.
4. Confirm whether you want to delete associated services and databases or unlink them.
5. Deleting the Blueprint instance terminates all associated services with zero residual cost.
