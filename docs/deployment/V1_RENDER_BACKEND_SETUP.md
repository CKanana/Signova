# Signova V1 — Render Backend Setup

**Target service:** `https://api.<SIGNOVA_DOMAIN>`  
**Deployment status:** not deployed. This document is the exact procedure and
configuration to apply once the owner supplies the domain and approves hosting.

---

## 1. Service definition

| Setting | Value |
|---|---|
| Platform | Render Web Service |
| Repository | Same Signova GitHub repository |
| Root directory | `server` |
| Runtime | Node |
| Node version | `22.12.0` (or any `22.x` ≥ 22.12.0) |
| Build command | `npm ci --workspaces=false --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instance port | Render injects `PORT`; the app already reads `process.env.PORT` |
| Auto-deploy | Owner decision; disable until production env is complete |

The build compiles `server/src` **and** the shared types at `../shared/types`,
which is why the repository is checked out in full even though Root Directory is
`server`. The compiled entry point is `server/dist/server/src/index.js`.

`npm ci --workspaces=false` is deliberate: the server has its own lockfile and
must not install the Expo/React Native workspace on every backend build.

---

## 2. Environment variables

Set these in Render → Environment. Values marked **secret** must never be
committed, logged, or pasted into documentation.

### Required

| Variable | Value / rule |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset; Render provides it. The app defaults to 4000 locally. |
| `CORS_ORIGINS` | `https://app.<SIGNOVA_DOMAIN>,https://teller.<SIGNOVA_DOMAIN>,https://admin.<SIGNOVA_DOMAIN>` |
| `MONGODB_URI` | Existing Atlas SRV URI, **secret** |
| `ACCESS_TOKEN_SECRET` | ≥16 chars, **secret**, generate new |
| `ACCESS_TOKEN_TTL` | `15m` |
| `REFRESH_TOKEN_SECRET` | ≥16 chars, **secret**, generate new |
| `REFRESH_TOKEN_TTL` | `7d` |
| `CHALLENGE_TOKEN_SECRET` | ≥16 chars, **secret**, generate new |
| `CHALLENGE_TOKEN_TTL` | `5m` |
| `TOTP_ENCRYPTION_KEY` | 32-byte key, hex (64 chars) or base64, **secret** |
| `APP_NAME` | `Signova` |
| `ADMIN_PORTAL_URL` | `https://admin.<SIGNOVA_DOMAIN>` |
| `PASSWORD_RESET_BASE_URL` | `https://teller.<SIGNOVA_DOMAIN>` |
| `APP_PUBLIC_BASE_URL` | `https://teller.<SIGNOVA_DOMAIN>` (invitation/setup links) |

`NODE_ENV=production` makes the config layer reject any non-HTTPS value for
`ADMIN_PORTAL_URL` or `APP_PUBLIC_BASE_URL`, and fails fast at boot.

### Optional / feature-dependent

| Variable | Value / rule |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address, **secret-ish** |
| `SMTP_APP_PASSWORD` | Gmail app password, **secret**; without it reset/invite email fails safely |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID; same value as the frontends |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret, **secret** |
| `TRANSLATION_LOW_CONFIDENCE` | `0.6` (server-side mock/translation threshold) |
| `PASSWORD_RESET_TTL_MINUTES` | `15` |
| `SIGNOVA_ORG_ID` | Optional Atlas organization `_id` if more than one active org exists |
| `SIGNBRIDGE_ENABLED` | `true` only when a reachable hosted SignBridge exists |
| `SIGNBRIDGE_URL` | Public HTTPS URL of the hosted SignBridge service, no trailing slash |
| `SIGNBRIDGE_API_KEY` | **secret**, must equal the SignBridge service's `SIGNBRIDGE_API_KEY` |
| `SIGNBRIDGE_TIMEOUT_MS` | Raise (e.g. `120000`) if the SignBridge service cold-starts |
| `SIGNBRIDGE_*` | Remaining defaults are safe; see `server/.env.example` |

### Do not set on Render

- `GOOGLE_REDIRECT_URI` — present in the old example file but unused by the
  current Google ID-token flow.
- Any `VITE_*` variable — frontend build-time values do not belong on the API.
- Development tunnel URLs, localhost origins, or `SIGNBRIDGE_ENABLED=true` with
  no reachable SignBridge service.

### Secret generation

```bash
openssl rand -base64 48   # access / refresh / challenge secrets
openssl rand -hex 32      # TOTP_ENCRYPTION_KEY (64 hex chars)
```

Use different values for each secret. Do not reuse the development `server/.env`.

---

## 3. MongoDB Atlas

1. Keep the existing Atlas cluster and database; do not create a new one unless
   the owner decides otherwise.
2. Create/confirm a database user with read/write access to the Signova database.
3. Network access:
   - If Render egress is not statically known, allow the minimum range the owner
     approves (commonly `0.0.0.0/0` for a free/dynamic service, with strong
     credentials and TLS).
   - If the owner has a static egress IP/range, allowlist only that range.
4. Confirm the URI includes the database name and TLS options expected by
   Mongoose (`mongodb+srv://...`).
5. The server exits on a failed initial connection. A Render deploy is not
   healthy until Atlas accepts the connection.

Do not paste the Atlas URI into this repository or into chat.

---

## 4. CORS and Socket.IO

### HTTP CORS

`server/src/middleware/security.ts` reads `CORS_ORIGINS` and rejects unknown
origins with credentials enabled. Production must contain exactly:

```
https://app.<SIGNOVA_DOMAIN>
https://teller.<SIGNOVA_DOMAIN>
https://admin.<SIGNOVA_DOMAIN>
```

No trailing slashes, no wildcards, no `http://`, no localhost, no dev tunnels.

### Socket.IO

- Namespace: `/signova` (`server/src/realtime/events.ts`).
- Path: `/socket.io` (`server/src/realtime/gateway.ts`).
- Auth: access token in `socket.handshake.auth.token`; reject before handlers run.
- CORS: the same allowlist as HTTP (fixed during this audit; it previously
  reflected any origin).
- Transports: clients request `websocket` then `polling`; Render supports both.
- Do not add a path prefix, a second namespace, or an API gateway rewrite.

Client code already targets:

```
https://api.<SIGNOVA_DOMAIN>/signova
```

with the default `/socket.io` path.

---

## 5. Authentication and sessions

Preserve the existing behaviour:

- Staff/admin: email + password → TOTP challenge → full access + refresh tokens.
- Bootstrap administrator: single-use setup token → password → TOTP enrollment.
- Deaf user: public kiosk session creation returns a device-scoped access token.
- Access tokens are short-lived; refresh tokens rotate and are revocable.
- RBAC and organization scoping are enforced server-side; sharing a parent
  domain does not replace authorization.

Production checks after deploy:

1. `POST /api/admin/login` for an administrator returns `2fa_required` or
   `authenticated` (never a full token before 2FA).
2. `GET /api/auth/me` with a valid bearer token returns the correct role/org.
3. A teller token cannot access `/api/admin/*`.
4. An admin from another organization cannot read this organization's sessions.

---

## 6. Deploy procedure

1. Create the Render Web Service from the repository.
2. Set Root Directory `server`.
3. Set the build and start commands above.
4. Add every required environment variable.
5. Deploy and watch the build log:
   - `npm ci --workspaces=false --include=dev` succeeds
   - `tsc -p tsconfig.build.json` succeeds
   - process starts and logs `MongoDB Atlas connected`
6. Open `https://<service>.onrender.com/api/health` and confirm:
   ```json
   { "status": "ok", "db": "connected", "dbConnected": true }
   ```
7. Add the custom domain `api.<SIGNOVA_DOMAIN>` in Render → Settings → Custom
   Domains. Copy the **exact** CNAME target Render displays; do not guess it.
8. After DNS is live, confirm Render shows the certificate as issued and the
   health endpoint works over HTTPS on the custom domain.

---

## 7. Verification commands

```powershell
# Liveness and DB state
Invoke-RestMethod https://api.<SIGNOVA_DOMAIN>/api/health

# CORS preflight from an allowed origin
curl.exe -i -X OPTIONS "https://api.<SIGNOVA_DOMAIN>/api/auth/login" `
  -H "Origin: https://app.<SIGNOVA_DOMAIN>" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"

# CORS rejection from a non-allowlisted origin (must not return an allow header)
curl.exe -i -X OPTIONS "https://api.<SIGNOVA_DOMAIN>/api/auth/login" `
  -H "Origin: https://evil.example" `
  -H "Access-Control-Request-Method: POST"

# Socket.IO handshake reachability (expect an HTTP response, not a timeout)
curl.exe -i "https://api.<SIGNOVA_DOMAIN>/socket.io/?EIO=4&transport=polling"
```

A Socket.IO handshake without a token is expected to reach the namespace
middleware and be rejected at the application level, not by CORS.

---

## 8. Known limitations on Render

1. **SignBridge is not deployed.** `SIGNBRIDGE_ENABLED=false` means staff text
   messages have animation status `skipped`; text messaging still works. Do not
   claim text-to-ASL works in production until the service is hosted and tested.
2. **Video files use local disk.** `server/src/storage/videos` is ephemeral on
   Render. If SignBridge is enabled later, move MP4 storage to persistent object
   storage and update the stream route.
3. **Rate limits are per IP.** A large institution behind one NAT IP may hit the
   300 requests / 15 min API limit; review after real traffic measurements.
4. **Health check is liveness-oriented.** `/api/health` returns `status: "ok"`
   even when `dbConnected` is false. Render health checks are process-level; use
   the JSON body for database verification.
5. **No backend deployment has been performed.** Every runtime claim above is a
   configuration expectation, not a verified production result.
