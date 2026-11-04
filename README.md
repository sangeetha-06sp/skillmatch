# SkillBridge AI

**SkillSwap — an AI-powered peer-to-peer skill exchange platform.** Students can teach what they know, learn what they want, and exchange virtual credits fairly. A student account can be both a mentor and a learner.

The project includes a responsive React/Vite client and a modular Express/Mongoose REST API. The client works immediately in a browser-persisted demo mode; set `VITE_API_URL` to use real authentication and API-backed listings, requests, sessions, profiles, and wallets.

## Features

- Cosmic, responsive UI with persistent dark/light themes, accessible focus states, and reduced-motion support.
- JWT authentication and bcrypt password hashing; protected student pages and server-enforced admin access.
- Student profiles, photo/avatar support, and editable interests, learning goals, availability, college, and department.
- Searchable, filterable skill listings with create, edit, save, and delete workflows.
- Explainable match recommendations; deterministic weighted scoring runs without an external AI service.
- Exchange requests, accept/reject/cancel, session scheduling, Jitsi development meeting links, and cancellation/dispute workflows.
- Double-confirmed session completion, server-validated credit transfers, wallet ledger, and protected balances.
- Notifications, a waitlist, admin management dashboards, and demo accounts.
- Zod request validation, centralized errors, pagination, health checks, and seed data. API routes are documented in [`server/README.md`](./server/README.md).

## Requirements

- Node.js 22.12+ (24 LTS recommended) and npm.
- MongoDB Community locally, MongoDB Atlas, or a development-only ephemeral MongoDB (`mongodb-memory-server`).

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

Start MongoDB locally, or set `MONGODB_URI` in `server/.env` to your MongoDB connection string. Configure a random JWT secret of at least 32 characters and set `CLIENT_ORIGIN=http://localhost:5173`. Then seed demo accounts and start both services:

```bash
npm run server:seed
npm run dev:all
```

- Web client: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

The root `.env.example` configures `VITE_API_URL=/api`; Vite proxies those requests to `VITE_PROXY_TARGET` (default `http://localhost:4000`) during development. For deployment, set `VITE_API_URL` to the public API origin plus `/api` and configure the backend `CLIENT_ORIGIN`. Remove `VITE_API_URL` from the root `.env` to use offline demo mode.

### Environment variables

Copy [`server/.env.example`](./server/.env.example) to `server/.env` and set:

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | No | `development` locally; set `production` when deployed. |
| `PORT` | No | API port; defaults to `4000`. |
| `MONGODB_URI` | Yes for API mode | Local MongoDB or Atlas URI. `memory://` is for ephemeral development only. |
| `JWT_SECRET` | Yes | Random signing key; at least 32 characters in production. Never commit it. |
| `JWT_EXPIRES_IN` | No | Access-token expiry (default `1d`). |
| `CLIENT_ORIGIN` | No | Comma-separated allowed browser origins; default `http://localhost:5173`. |
| `PLATFORM_FEE_PERCENT` | No | Validated platform fee percentage (default `0`). |
| `SEED_ADMIN_PASSWORD` | No | Password for the seeded administrator (default is demo-only). Change it before seeding. |
| `VITE_API_URL` | Optional | Root `.env` API base URL (`/api` when using the Vite development proxy). |
| `VITE_PROXY_TARGET` | No | Root `.env` backend origin for Vite’s `/api` development proxy (default `http://localhost:4000`). |

Never use demo credentials, example secrets, or an in-memory database in production. The API validates required environment settings on startup. MongoDB transactions are used on replica sets; standalone development MongoDB uses guarded atomic balance updates and idempotency keys.

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
| `npm run server:seed` | Seed demo data in MongoDB. |
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
  models/                 Mongoose data models
  routes/                 REST endpoints and Zod request validation
  services/               Weighted matching, notifications, and wallet transfer
  middleware/             JWT authorization and centralized errors
```

Authentication is handled by the API in full-stack mode; the offline demo is intentionally isolated in local storage and is not an authentication substitute for deployment. Matching scores are deterministic and explainable, with no external AI service or user data sharing.