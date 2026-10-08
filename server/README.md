# Signova Server

Backend API for the Signova institutional service-counter communication system.

Node 22 · Express 5 · TypeScript (ESM) · MongoDB Atlas (Mongoose) · Socket.IO · JWT + TOTP 2FA.

## Structure

```
server/src/
├── config/       env validation + MongoDB connection
├── models/       Mongoose schemas (Organization, User, Teller, Session, Message, SessionLog, AuditLog, RefreshToken)
├── middleware/   auth (JWT/RBAC), error, validation, rate limiting, security, logging
├── routes/       REST routers per resource (mounted under /api)
├── controllers/  thin request handlers
├── services/     domain logic incl. the MOCK translation seam
├── realtime/     Socket.IO /signova namespace, rooms, event handlers
└── seed/         development data
```

## Setup

1. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   Required variables (see `.env.example` for all):
   - `MONGODB_URI` — your MongoDB Atlas SRV connection string
   - `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CHALLENGE_TOKEN_SECRET` — strong random values
   - `TOTP_ENCRYPTION_KEY` — 32-byte key (64 hex chars) for encrypting TOTP secrets at rest

   Generate secrets, e.g. `openssl rand -hex 32`.

2. Install dependencies (from the repo root, workspaces) or inside `server/`:

   ```bash
   npm install
   ```

## Run

```bash
# development (tsx watch)
npm run dev --workspace @signova/server
# or, from server/:
npm run dev

# production
npm run build && npm start
```

Server listens on `PORT` (default 4000). Health check: `GET /api/health`.

## Seed development data

```bash
npm run seed --workspace @signova/server
# or, from server/:
npm run seed
```

Creates one organization (KNH), an admin, three staff users, and three tellers.
**Development passwords only** — printed to the console on seed. 2FA is not
pre-enabled; the first login triggers authenticator enrollment.

## Authentication flow (staff/admin)

1. `POST /api/auth/login` with email + password.
   - If 2FA is enabled → `{ status: "2fa_required", challengeToken }`.
   - If 2FA is not yet set up → `{ status: "mfa_enroll_required", challengeToken }`.
2. **2FA verify:** `POST /api/auth/2fa/verify` with the challenge token + 6-digit TOTP code.
   **Enroll (first time):**
   - `POST /api/auth/2fa/enroll/start` → returns secret + QR code URL.
   - `POST /api/auth/2fa/enroll/activate` with the code → returns `accessToken` + `refreshToken`.
3. Use the `accessToken` (15 min) as a Bearer token. Refresh with `POST /api/auth/refresh`.

No full access token is issued before successful 2FA.

## Real-time

Socket.IO namespace `/signova`. Connect with `{ auth: { token: <accessToken> } }`.
Rooms: `session:{id}`, `org:{orgId}:tellers`, `user:{userId}`. Event names live
in `src/realtime/events.ts`.

## Translation (MOCK)

`POST /api/sessions/:id/translate` calls the isolated mock service in
`src/services/translationService.ts`, which returns the shared `Translation`
contract (`gloss`, `confidence`, `alternatives[]`). The real two-hand ML model
will replace only that service's implementation in Phase 6 — no other code
depends on the translation source.

## API overview

See the phase design doc for the full endpoint list. All protected routes
require `Authorization: Bearer <accessToken>` and are org-scoped; roles are
enforced server-side.
