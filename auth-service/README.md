# FinGuard Auth Service

The **Auth Service** handles user registration, secure authentication, password hashing with `bcryptjs`, and JSON Web Token (JWT) issuance for the FinGuard platform.

## Architecture & Tech Stack
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Database:** PostgreSQL (`finguard_auth` database, table `users`)
- **Security:** bcrypt password hashing (10 salt rounds), signed HMAC-SHA256 JWTs
- **Port:** 5001 (internal container / reverse proxied via Nginx)

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Health status and DB connectivity | No |
| `POST` | `/api/auth/register` | Register a new user | No |
| `POST` | `/api/auth/login` | Log in and receive JWT token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (`Bearer <token>`) |
| `POST` | `/api/auth/verify` | Verify token payload | No |

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AUTH_PORT` | HTTP port | `5001` |
| `JWT_SECRET` | Secret key for signing JWTs | *(Required in prod)* |
| `JWT_EXPIRES_IN` | Token expiration duration | `24h` |
| `POSTGRES_HOST` | Database host | `postgres` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_USER` | Database username | `finguard_user` |
| `POSTGRES_PASSWORD` | Database password | `finguard_dev_secret_2026` |
| `POSTGRES_AUTH_DB` | Database name | `finguard_auth` |

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run service locally
npm start
```
