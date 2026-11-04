# SkillBridge REST API

TypeScript and Express API backed by Supabase PostgreSQL via `@supabase/supabase-js`. All routes are mounted under `/api`. The React app talks to this API; it must never receive the Supabase service-role key.

## Database setup

Create `server/.env` from `server/.env.example`, then set the Supabase project URL, service-role key, and a random JWT secret. In the Supabase dashboard, open **SQL Editor** and run these committed scripts in this exact order:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_exchange_functions.sql`
3. `supabase/migrations/003_row_level_security.sql`

They create the users, skills, exchange_requests, sessions, wallets, wallet_transactions, notifications, waitlists, and disputes tables; their constraints, indexes, updated-at triggers, and RLS policies; and the restricted PostgreSQL functions used by scheduling, cancellations, disputes, idempotent wallet settlement, and platform statistics. No table needs to exist in advance. The API checks database connectivity on startup and `/api/health` reports whether PostgreSQL is connected.

The migration scripts do not import MongoDB records. Back up/export existing MongoDB data and plan/import it separately before directing production traffic at the new database.

## Run locally

```bash
npm install
cp .env.example .env
# Fill server/.env with actual Supabase credentials and a strong JWT_SECRET.
npm run dev
```

From the repository root, copy `server/.env.example` to `server/.env` and use `npm run dev:all` to run the API and Vite frontend together. The root `.env.example` sends `/api` through Vite's development proxy to `http://localhost:4000`. Set `CLIENT_ORIGIN` to the frontend origin(s) allowed by CORS.

Optional sample fixtures:

```bash
npm run seed
```

The optional seed command inserts demo accounts and listings, but does not award credits. Do not use demo passwords outside local development.

## Environment

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | HTTPS Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase service-role/secret key. Never expose through Vite or commit it. |
| `JWT_SECRET` | Yes | Random token-signing secret; at least 32 characters in production. |
| `JWT_EXPIRES_IN` | No | Access-token expiry (default `1d`). |
| `NODE_ENV` | No | `development` locally; set to `production` when deployed. |
| `PORT` | No | API port (default `4000`). |
| `CLIENT_ORIGIN` | No | Comma-separated CORS origins (default `http://localhost:5173`). |
| `PLATFORM_FEE_PERCENT` | No | Validated platform fee percentage (default `0`). |
| `SEED_ADMIN_PASSWORD` | No | Password for the optional seeded administrator. |

The frontend uses only `VITE_API_URL` and `VITE_PROXY_TARGET` from the root `.env`; neither is a Supabase credential.

## Security and transactions

- Passwords use bcrypt hashing. Registration and login issue the existing signed JWTs; authentication reloads the account and checks account status and token version.
- Private endpoints require `Authorization: Bearer <JWT>`. Admin endpoints additionally require a database-backed admin role.
- The server uses the service-role key; RLS policies deny direct private data access to browser roles and expose only active public listings and waitlist submission. Do not give the service-role key to the frontend.
- The PostgreSQL `confirm_session_completion` function locks the session and both wallets, waits for both participant confirmations, checks the payer's balance, transfers credits and writes both ledger entries in the same transaction. A database check prohibits negative balances; unique idempotency keys prevent duplicate transfers.
- Scheduling, cancellation, and dispute creation are likewise database functions so their related state changes are atomic.
- Helmet, a configurable CORS allow-list, request-size limits, rate limiting, Zod request validation, pagination, and centralized error responses are enabled.

## API endpoints

Unless marked **Public**, routes require a bearer token. **Admin** routes additionally require the database role `admin`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Database readiness. |
| `POST` | `/api/auth/register` | Register and return `{ user, token }`. |
| `POST` | `/api/auth/login` | Authenticate and return `{ user, token }`. |
| `GET` / `PATCH` | `/api/auth/me` | Read or update the signed-in profile. |
| `PATCH` | `/api/auth/password` | Verify and change password; revokes previous JWTs. |
| `GET` | `/api/auth/users/:id` | **Private** view of an active public profile. |
| `GET` | `/api/skills?q=&category=&type=&mode=&level=&availability=&page=&limit=` | **Public** full-text search and listing filters. |
| `GET` | `/api/skills/mine` | List the signed-in user's listings. |
| `POST` | `/api/skills` | Create an offer or learning request. |
| `GET` | `/api/skills/:id` | **Public** active listing details. |
| `PATCH` / `DELETE` | `/api/skills/:id` | Update or deactivate an owned listing (admins may moderate). |
| `GET` | `/api/matches?q=` or `/api/matches?skillId=` | Weighted recommendations with match explanations. |
| `GET` / `POST` | `/api/requests` | View exchange history or request an offered skill. |
| `PATCH` | `/api/requests/:id/status` | Provider accepts/rejects; requester cancels. |
| `GET` / `POST` | `/api/sessions` | View exchange history or schedule an accepted exchange. |
| `POST` | `/api/sessions/:id/start` | Start a scheduled session. |
| `POST` | `/api/sessions/:id/cancel` | Atomically cancel an unconfirmed scheduled session. |
| `POST` | `/api/sessions/:id/confirm-completion` | Confirm completion; settles credits after both confirmations. |
| `POST` | `/api/sessions/:id/dispute` | Open a dispute and put the session on hold. |
| `GET` | `/api/wallet?page=&limit=` | Authoritative balance and private wallet ledger. |
| `GET` / `PATCH` | `/api/notifications` and `/api/notifications/:id/read` | List or mark owned notifications read. |
| `POST` | `/api/notifications/read-all` | Mark all owned notifications read. |
| `POST` | `/api/waitlist` | **Public** waitlist signup. |
| `GET` | `/api/disputes` and `/api/disputes/:id` | View own disputes; participants/admins may view details. |
| `GET` | `/api/admin/stats`, `/api/admin/users`, `/api/admin/disputes`, `/api/admin/waitlist`, `/api/admin/wallet-transactions` | **Admin** platform overview and audit lists. |
| `PATCH` | `/api/admin/users/:id/status`, `/api/admin/disputes/:id`, `/api/admin/waitlist/:id` | **Admin** account and moderation workflows. |

Errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`. Paginated responses include `pagination` with page, limit, total, and page count.

## Tests

```bash
npm run build
npm test
```

The matching unit tests run without database credentials. The end-to-end exchange-flow test runs only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured and all three migrations have been applied. It creates uniquely named test records and removes them afterward.
