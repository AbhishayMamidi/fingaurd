# FinGuard API Gateway

The **API Gateway** acts as the unified reverse proxy and entrypoint for all incoming client traffic into the FinGuard microservices ecosystem. It runs an optimized Nginx instance that securely forwards requests to the appropriate backend microservices and serves/proxies the React frontend.

## Routing Architecture

| Path Prefix | Target Microservice | Internal Upstream |
|---|---|---|
| `/health` | API Gateway Health | Local Nginx 200 response |
| `/api/auth/*` | Auth Service | `http://auth-service:5001/api/auth/*` |
| `/api/transactions/*` | Transaction Service | `http://transaction-service:5002/api/transactions/*` |
| `/api/categories/*` | Categorization Service | `http://categorization-service:5003/api/categories/*` |
| `/api/fraud/*` | Fraud Detection Service | `http://fraud-detection-service:5004/api/fraud/*` |
| `/api/budgets/*` | Budget Service | `http://budget-alert-service:5005/api/budgets/*` |
| `/api/alerts/*` | Alert Service | `http://budget-alert-service:5005/api/alerts/*` |
| `/*` | Frontend Application | `http://frontend:80/*` |

## Security & Observability
- Injects standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
- Formats access logs as structured JSON containing request times and upstream response latencies.
- Standardizes CORS and preserves client IP tracing headers (`X-Real-IP`, `X-Forwarded-For`).
