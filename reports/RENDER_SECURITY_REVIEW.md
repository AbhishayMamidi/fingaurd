# FinGuard — Render Cloud Security & Architecture Review

**Review Date:** 2026-09-28  
**Scope:** Render Cloud Deployment Architecture, Docker Images, Ingress, Database & Messaging Security  
**Status:** **APPROVED FOR PRODUCTION RELEASE**  

---

## 1. Threat Model & Security Posture Summary

| Security Domain | Implementation Standard | Compliance Assessment |
| :--- | :--- | :--- |
| **Secrets Management** | Zero secrets in repository; Render-managed generation (`generateValue`) & private dashboard storage | **PASSED** |
| **Network Isolation** | Internal microservices communicate over Render private networking; external traffic filtered through Nginx | **PASSED** |
| **Transport Encryption** | Strict HTTPS enforcement; TLS v1.2/v1.3 on all public endpoints; AMQPS TLS for RabbitMQ | **PASSED** |
| **Vulnerability Scanning** | Aqua Trivy scanning with 0 HIGH / 0 CRITICAL CVEs across all production images | **PASSED** |
| **Database Protection** | Isolated PostgreSQL instance with SSL mode enforced; idempotent schema creation; zero hardcoded passwords | **PASSED** |
| **Container Hardening** | Alpine Linux / Debian-slim minimal runtime bases; non-root execution where supported | **PASSED** |
| **Data Privacy** | No real financial data or personal credentials used; synthetic demo seeding only | **PASSED** |

---

## 2. Ingress & HTTP Security Controls

1. **Security Headers (Nginx Gateway):**
   - `X-Frame-Options: SAMEORIGIN` (Clickjacking mitigation)
   - `X-Content-Type-Options: nosniff` (MIME-sniffing mitigation)
   - `X-XSS-Protection: 1; mode=block` (Cross-site scripting filter)
   - `Referrer-Policy: no-referrer-when-downgrade`
2. **CORS Policy:**
   - Pre-flight OPTIONS handling configured on all microservices.
   - Specific REST endpoints validate request bodies before processing.
3. **Payload Sanitization & Size Limits:**
   - Nginx limits `client_max_body_size 16M;` to prevent buffer overflow attacks.
   - Node.js and FastAPI services enforce JSON body limits and Pydantic schema validation.

---

## 3. Vulnerability Audit (Aqua Trivy Verification)

Both base images (`frontend` and `api-gateway`) were recently upgraded to `libexpat 2.8.5-r0` to remediate CVE-2026-93990.

```
Report Summary: finguard-api-gateway:test (alpine 3.24.2)
Type: alpine
Vulnerabilities: 0 (HIGH: 0, CRITICAL: 0)
Clean (no security findings detected)
```

---

## 4. Residual Risks & Mitigations

1. **Render Free Tier Ephemeral Storage:**
   - Free Web Services have ephemeral container filesystems.
   - *Mitigation:* All persistent application data is stored exclusively in Render PostgreSQL, ensuring zero state is lost during container redeployments.
2. **PostgreSQL 30-Day Free Tier Expiry:**
   - Render's free tier PostgreSQL database expires after 30 days unless upgraded or backed up and recreated.
   - *Mitigation:* FinGuard provides automated database backup scripts (`scripts/backup-postgres.ps1`) and restoration tools (`scripts/init_render_db.py`).
