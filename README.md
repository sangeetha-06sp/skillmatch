# SkillBridge AI

**SkillSwap — an AI-powered peer-to-peer skill exchange platform.** Students can teach what they know, learn what they want, and exchange virtual credits fairly. A student account can be both a mentor and a learner.

The project includes a responsive React/Vite client and a modular Express REST API backed by Supabase PostgreSQL. The client keeps its local demo mode when `VITE_API_URL` is unset; configure it to use database-backed authentication, listings, exchanges, sessions, profiles, notifications, and wallets.

## Features

- Cosmic, responsive UI with persistent dark/light themes, accessible focus states, and reduced-motion support.
- JWT authentication and bcrypt password hashing; protected student pages and server-enforced admin access.
- Student profiles, photo/avatar support, and editable interests, learning goals, availability, college, and department.
- Searchable, filterable skill listings with create, edit, save, and delete workflows.
- Explainable match recommendations; deterministic weighted scoring runs without an external AI service.
- Exchange requests, accept/reject/cancel, session scheduling, Jitsi development meeting links, and cancellation/dispute workflows.
- Double-confirmed session completion, server-validated credit transfers, wallet ledger, and protected balances.
- Notifications, a waitlist, admin management dashboards, and demo accounts.
- Zod request validation, centralized errors, pagination, health checks, and optional seed data. API routes are documented in [`server/README.md`](./server/README.md).

## Requirements

- Node.js 22.12+ (24 LTS recommended) and npm.
- A Supabase project with PostgreSQL enabled.

## Quick start — offline demo

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in or register for a locally persisted demo account, or choose **Explore as a student/admin** on the login screen. Demo changes are stored in your browser’s local storage; no backend, credentials, or external AI API are required.

## Run the full stack

```bash
npm install
npm --prefix server install
cp .env.example .env
cp server/.env.example server/.env
```

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `JWT_SECRET` in `server/.env`. The service-role key must remain server-only. Before starting the API, run the three SQL migrations manually in Supabase SQL Editor in the order shown below. `server:seed` is optional and creates example accounts/listings:

```bash
# Optional demo fixtures
npm run server:seed
npm run dev:all
```

- Web client: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

The root `.env.example` configures `VITE_API_URL=/api`; Vite proxies those requests to `VITE_PROXY_TARGET` (default `http://localhost:4000`) during development. The browser never connects directly to Supabase. For deployment, set `VITE_API_URL` to the public API origin plus `/api` and configure the backend `CLIENT_ORIGIN`. Remove `VITE_API_URL` from the root `.env` to use offline demo mode.

### Supabase SQL migrations

Open the SQL Editor for your Supabase project and run these complete scripts one at a time, in order. Do not skip a script:

1. [`server/supabase/migrations/001_schema.sql`](./server/supabase/migrations/001_schema.sql) — creates all nine tables, constraints, indexes, timestamps, and wallet initialization.
2. [`server/supabase/migrations/002_exchange_functions.sql`](./server/supabase/migrations/002_exchange_functions.sql) — installs atomic scheduling, cancellation, dispute, completion, settlement, and admin-statistics functions.
3. [`server/supabase/migrations/003_row_level_security.sql`](./server/supabase/migrations/003_row_level_security.sql) — enables RLS, adds policies, and limits RPC execution.

These scripts create their schema; they do not assume any tables already exist. Re-running them is designed to be safe for schema objects, but the scripts do not migrate records out of an existing MongoDB deployment. Export/import existing production data separately before switching clients.

### Environment variables

Copy [`server/.env.example`](./server/.env.example) to `server/.env` and set:

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | No | `development` locally; set `production` when deployed. |
| `PORT` | No | API port; defaults to `4000`. |
| `SUPABASE_URL` | Yes for API mode | HTTPS URL of the Supabase project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for API mode | Backend-only Supabase service-role/secret key. Never put this in the root `.env`, frontend code, or a `VITE_` variable. |
| `JWT_SECRET` | Yes | Random signing key; at least 32 characters in production. Never commit it. |
| `JWT_EXPIRES_IN` | No | Access-token expiry (default `1d`). |
| `CLIENT_ORIGIN` | No | Comma-separated allowed browser origins; default `http://localhost:5173`. |
| `PLATFORM_FEE_PERCENT` | No | Validated platform fee percentage (default `0`). |
| `SEED_ADMIN_PASSWORD` | No | Password for the seeded administrator (default is demo-only). Change it before seeding. |
| `VITE_API_URL` | Optional | Root `.env` API base URL (`/api` when using the Vite development proxy). |
| `VITE_PROXY_TARGET` | No | Root `.env` backend origin for Vite’s `/api` development proxy (default `http://localhost:4000`). |

Never use demo credentials or example secrets in production. The API validates the Supabase URL/key and JWT settings on startup. Credit settlement runs in PostgreSQL transactions through restricted SQL functions, with non-negative wallet constraints and unique idempotency keys.

### Seed accounts

`npm run server:seed` adds sample skill listings and accounts. Change `SEED_ADMIN_PASSWORD` before seeding if needed.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@skillbridge.demo` | Value of `SEED_ADMIN_PASSWORD` |
| Student | `avery@skillbridge.demo` | `AveryDemo123!` |
| Student | `jordan@skillbridge.demo` | `JordanDemo123!` |

The **Explore as student/admin** buttons use the local browser demo. Use the seeded credentials on the regular login form to exercise real API authentication and role checks.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite client. |
| `npm run build` | Type-check and create the frontend production build. |
| `npm run preview` | Preview the production build. |
| `npm run dev:all` | Run the Vite client and Express API together. |
| `npm run server:dev` | Run the API in watch mode. |
| `npm run server:seed` | Seed demo data in Supabase. |
| `npm run server:test` | Build and test the backend separately with the commands below. |

Backend checks:

```bash
cd server
npm run build
npm test
```

See [`server/README.md`](./server/README.md) for API routes, payloads, and safety details.

## Architecture

```text
src/
  App.tsx                 Pages, protected routing, and responsive navigation
  context/AppContext.tsx  Theme, browser demo persistence, and API-backed state
  services/api.ts         Fetch client, JWT storage, and API auth helpers
  styles.css              Cosmic design system and responsive layouts
server/src/
  app.ts                  Express middleware, security headers, API routing
  supabase/migrations/    PostgreSQL schema, atomic functions, and RLS policies
  routes/                 REST endpoints and Zod request validation
  services/               Weighted matching, notifications, and wallet transfer
  middleware/             JWT authorization and centralized errors
```

Authentication is handled by the API in full-stack mode; the offline demo is intentionally isolated in local storage and is not an authentication substitute for deployment. Matching scores are deterministic and explainable, with no external AI service or user data sharing.