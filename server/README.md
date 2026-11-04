# SkillBridge REST API

TypeScript, Express, MongoDB, and Mongoose API. All routes are mounted under `/api`.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Start a local MongoDB instance, or set `MONGODB_URI` to a MongoDB Atlas URI. The API exits with a clear error if MongoDB is unavailable. For a temporary development database, set `MONGODB_URI=memory://`; `mongodb-memory-server` downloads a MongoDB binary on first use and discards data when the API process exits. Do not use this option in production.

The root client runs on port `5173`; set `CLIENT_ORIGIN=http://localhost:5173` in `server/.env`. The root `.env.example` sets `VITE_API_URL=/api`; Vite proxies `/api` to `VITE_PROXY_TARGET=http://localhost:4000`. For production, configure the frontend API URL and backend CORS origin for your deployed domains.

To create sample users and listings:

```bash
npm run seed
```

| Account | Email | Password |
|---|---|---|
| Admin | `admin@skillbridge.demo` | `SEED_ADMIN_PASSWORD` (default: `ChangeMe123!`; demo only) |
| Student | `avery@skillbridge.demo` | `AveryDemo123!` |
| Student | `jordan@skillbridge.demo` | `JordanDemo123!` |

Change the admin password and JWT secret before using any non-local environment. Never use these demo credentials in production.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Watch-mode API server. |
| `npm run build` | Strict TypeScript compilation to `dist/`. |
| `npm start` | Run the compiled server. |
| `npm run seed` | Insert demo users and listings. |
| `npm test` | Run API integration and matching tests. |

## Authentication and security

- Register and login to receive a signed JWT. Send it as `Authorization: Bearer <token>` on protected routes.
- Passwords are bcrypt-hashed. Registration requires at least 10 characters with an uppercase letter, lowercase letter, and digit.
- Authenticated user IDs and admin roles are taken from the verified token/database, never from request bodies.
- Helmet, a restrictive configurable CORS allow-list, JSON body limits, and rate limiting are enabled.
- Zod validates request bodies and query filters. Errors use consistent JSON responses and safe messages.
- All listing and administrative list APIs paginate. Monetary values are whole virtual credits; clients never submit or set wallet balances.
- Session completion requires confirmation from both participants. Wallet settlement is idempotent and uses MongoDB transactions on replica sets. Standalone development MongoDB uses guarded conditional balance updates, an idempotency key, and compensation for failed credits. Use a replica set for crash-safe multi-document transactions in production.

## Endpoints

`/api/health` is public. Unless marked **Public**, routes below require a bearer token. **Admin** routes additionally require the database role `admin`.

### Health and authentication

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Database readiness. |
| `POST` | `/api/auth/register` | Register a student and return `{ user, token }`. |
| `POST` | `/api/auth/login` | Authenticate and return `{ user, token }`. |
| `GET` | `/api/auth/me` | Get the current profile. |
| `PATCH` | `/api/auth/me` | Update profile fields (name, bio, college, department, year, interests, availability, skill text, avatar URL). |
| `PATCH` | `/api/auth/password` | Verify the current password and change it; revokes existing tokens. |
| `GET` | `/api/auth/users/:id` | View a public student profile. |

Example registration:

```json
{
  "name": "Alex Morgan",
  "email": "alex@university.edu",
  "password": "SecurePass123",
  "college": "Stanford University",
  "department": "Computer Science",
  "year": "3rd year"
}
```

### Listings and matching

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/skills?q=&category=&type=&mode=&level=&availability=&page=&limit=` | **Public** search/filter active listings. |
| `GET` | `/api/skills/mine` | List the signed-in user’s listings. |
| `POST` | `/api/skills` | Create an offer or learning request; optional `availability` and `credits` are stored on the listing. |
| `GET` | `/api/skills/:id` | **Public** listing detail. |
| `PATCH` | `/api/skills/:id` | Update an owned listing; admins can moderate. |
| `DELETE` | `/api/skills/:id` | Deactivate an owned listing; admins can moderate. |
| `GET` | `/api/matches?q=` | Rank active offered skills and include a point-by-point score explanation. |
| `GET` | `/api/matches?skillId=` | Match against an offer owned by the signed-in user. |

Listing levels are `beginner`, `intermediate`, `advanced`, or `expert`; modes are `online`, `in-person`, or `either`; types are `offer` and `request`.

### Exchanges and sessions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/requests?page=&limit=` | List requests involving the signed-in user. |
| `POST` | `/api/requests` | Request another student’s offered skill; accepts `skillId` and optional `message`. The amount is copied from the server-owned listing price, never from the client. |
| `PATCH` | `/api/requests/:id/status` | Accept/reject as provider, or cancel as requester. |
| `GET` | `/api/sessions?page=&limit=` | List sessions involving the signed-in user. |
| `POST` | `/api/sessions` | Schedule an accepted exchange (`requestId`, ISO `scheduledAt`, `durationMinutes`, optional `mode`, `meetingUrl`, `notes`). |
| `POST` | `/api/sessions/:id/start` | Start a scheduled session. |
| `POST` | `/api/sessions/:id/cancel` | Cancel an unconfirmed scheduled session; no credits transfer. |
| `POST` | `/api/sessions/:id/confirm-completion` | Confirm a session; credits transfer after both participants confirm. |
| `POST` | `/api/sessions/:id/dispute` | Report a session problem with a reason; the session is put on hold. |

### Wallet, notifications, and waitlist

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/wallet?page=&limit=` | Get the authenticated user’s authoritative balance and transaction history. |
| `GET` | `/api/notifications?unread=true&page=&limit=` | List notifications and unread count. |
| `PATCH` | `/api/notifications/:id/read` | Mark one owned notification as read. |
| `POST` | `/api/notifications/read-all` | Mark all notifications as read. |
| `POST` | `/api/waitlist` | **Public** join the waitlist with email, name, and interests. |

### Disputes and administration

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/disputes` | User/Admin | Users see their own disputes; admins see all. |
| `GET` | `/api/disputes/:id` | Participant/Admin | View a dispute. |
| `GET` | `/api/admin/stats` | Admin | Aggregate platform statistics. |
| `GET` | `/api/admin/users?q=&page=&limit=` | Admin | Search and paginate users. |
| `PATCH` | `/api/admin/users/:id/status` | Admin | Activate/deactivate an account; deactivation revokes tokens. |
| `GET` | `/api/admin/disputes?status=&page=&limit=` | Admin | Review disputes. |
| `PATCH` | `/api/admin/disputes/:id` | Admin | Update status and include a resolution note when closing. |
| `GET` | `/api/admin/waitlist?status=&page=&limit=` | Admin | Review waitlist entries. |
| `PATCH` | `/api/admin/waitlist/:id` | Admin | Set waitlist status to pending, invited, or joined. |
| `GET` | `/api/admin/wallet-transactions?page=&limit=` | Admin | Audit wallet transactions. |

Errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`. Success responses are JSON objects; paginated lists include a `pagination` object with page, limit, total, and page count. See `test/` for examples of authentication, admin authorization, matching, session completion, and one-time settlement.
