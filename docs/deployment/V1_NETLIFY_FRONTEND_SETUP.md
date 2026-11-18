# Signova V1 — Netlify Frontend Setup

Three independent Netlify sites deploy from the same repository. They are not
merged, not monorepo-rewritten, and do not share a publish directory.

**Deployment status:** not deployed. Site names below are proposed names; the
owner must confirm availability and create the sites.

---

## 1. Site summary

| Application | Proposed site name | Base directory | Custom domain |
|---|---|---|---|
| Deaf-user PWA | `signova-app` | `apps/web-deaf-user-pwa` | `app.<SIGNOVA_DOMAIN>` |
| Teller dashboard | `signova-teller` | `apps/web-hearing-staff` | `teller.<SIGNOVA_DOMAIN>` |
| Administrator dashboard | `signova-admin` | `apps/web-admin-portal` | `admin.<SIGNOVA_DOMAIN>` |

Each site uses its own `netlify.toml`, already present in the application
directory.

---

## 2. Common build settings

Apply to all three sites:

| Setting | Value |
|---|---|
| Repository | The existing Signova GitHub repository |
| Base directory | The application directory from the table |
| Build command | `npm ci --workspaces=false --include=dev && npm run build` |
| Publish directory | `dist` |
| Node version | `22.12.0` |

`--workspaces=false` is required. The repository root is an npm workspace, but
each app has its own lockfile and is deployed as a standalone Vite application.
It also prevents a Netlify build from installing the Expo/React Native workspace.

Each application imports shared source via relative paths (`shared/types`,
`shared/app-shell`, `shared/brand-assets`). No `file:` dependency or workspace
link is needed at build time.

---

## 3. Environment variables

### Deaf-user PWA

| Variable | Value |
|---|---|
| `NODE_VERSION` | `22.12.0` |
| `VITE_API_URL` | `https://api.<SIGNOVA_DOMAIN>` |
| `VITE_USE_MODEL` | `true` |

`VITE_USE_MODEL=true` is mandatory. If it is missing or false, the production
PWA falls back to the mock recognition path and violates the V1 model
requirement. `VITE_API_URL` must have no trailing slash.

### Teller dashboard

| Variable | Value |
|---|---|
| `NODE_VERSION` | `22.12.0` |
| `VITE_API_URL` | `https://api.<SIGNOVA_DOMAIN>` |
| `VITE_GOOGLE_CLIENT_ID` | Optional; same Google web client ID as admin |

### Administrator dashboard

| Variable | Value |
|---|---|
| `NODE_VERSION` | `22.12.0` |
| `VITE_API_URL` | `https://api.<SIGNOVA_DOMAIN>` |
| `VITE_STAFF_APP_URL` | `https://teller.<SIGNOVA_DOMAIN>` |
| `VITE_GOOGLE_CLIENT_ID` | Optional; same Google web client ID as teller |

Vite inlines `VITE_*` values at build time. Changing an environment variable
requires a new deploy; it does not change an already-built site.

Never put server secrets (`MONGODB_URI`, JWT secrets, TOTP key, SMTP password,
Google client secret) in Netlify. Only the public `VITE_*` values belong here.

---

## 4. SPA redirects

Each `netlify.toml` contains:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This is required for teller and admin `BrowserRouter` deep links. It is also
harmless for the PWA state machine and keeps `/login`/`/invite` behaviour
consistent. Static files are served before the rewrite.

Do not add a base path (`/app`, `/teller`, `/admin`) to the apps. Each subdomain
is its own origin with routes at `/`.

---

## 5. `netlify.toml` files

| File | Notable settings |
|---|---|
| `apps/web-deaf-user-pwa/netlify.toml` | SPA fallback; no-cache for `sw.js`, `registerSW.js`, manifest; basic security headers |
| `apps/web-hearing-staff/netlify.toml` | SPA fallback; basic security headers |
| `apps/web-admin-portal/netlify.toml` | SPA fallback; `no-store`/`noindex` for the disabled `auth_bridge.html`; basic security headers |

The service worker headers matter: a cached `sw.js` can pin users to an old
precache manifest and delay model/app updates.

---

## 6. Custom domains and HTTPS

After each site is created and a first deploy succeeds:

1. Netlify → Domain management → Add a domain.
2. Enter `app.`, `teller.`, or `admin.<SIGNOVA_DOMAIN>`.
3. Netlify displays the DNS record to create. **Copy the exact target shown.**
   Do not invent a CNAME.
4. Add that record in Namecheap (see `V1_NAMECHEAP_DOMAIN_AND_DNS_SETUP.md`).
5. Wait for Netlify to show the domain as verified.
6. Confirm the automatically provisioned Let's Encrypt certificate is active.
7. Enable “Force HTTPS” only after the certificate is issued.

Do not add a wildcard domain until all three sites are verified; a wildcard can
mask a misconfigured host.

---

## 7. Google sign-in (optional)

If Google sign-in is enabled:

1. Use the same Google OAuth Web Client ID on teller and admin.
2. Add authorized JavaScript origins:
   - `https://app.<SIGNOVA_DOMAIN>` (only if the PWA uses Google; it currently
     does not)
   - `https://teller.<SIGNOVA_DOMAIN>`
   - `https://admin.<SIGNOVA_DOMAIN>`
3. Add the matching `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to Render.
4. Test both the “existing account” and “new/unlinked account” paths.

Netlify Deploy Preview URLs (`https://deploy-preview-*.netlify.app`) are **not**
in the production CORS allowlist. API calls from previews will be rejected by
design. Test production deploys on the custom domains.

---

## 8. Verification after each deploy

```powershell
# PWA
curl.exe -I https://app.<SIGNOVA_DOMAIN>/
curl.exe -I https://app.<SIGNOVA_DOMAIN>/manifest.webmanifest
curl.exe -I https://app.<SIGNOVA_DOMAIN>/sw.js
curl.exe -I https://app.<SIGNOVA_DOMAIN>/model/signova_model.tflite
curl.exe -I https://app.<SIGNOVA_DOMAIN>/models/hand_landmarker.task

# Teller
curl.exe -I https://teller.<SIGNOVA_DOMAIN>/login
curl.exe -I https://teller.<SIGNOVA_DOMAIN>/staff/dashboard

# Admin
curl.exe -I https://admin.<SIGNOVA_DOMAIN>/login
curl.exe -I https://admin.<SIGNOVA_DOMAIN>/admin/overview
```

Then in a browser:

- DevTools → Application → Manifest: no errors, icons resolve.
- Application → Service Workers: one active worker scoped to `/`.
- Network: API requests go to `https://api.<SIGNOVA_DOMAIN>`, never to the
  Netlify origin.
- Console: no mixed-content, CORS, or 404 errors.
- Teller/admin login reaches the Render API and returns a 2FA challenge.

---

## 9. Build reproducibility notes

- Lockfiles are committed for all three apps and the server.
- The builds used during this audit:
  - PWA: `tsc --noEmit && vite build`, 46 precache entries.
  - Teller: `tsc --noEmit && vite build`.
  - Admin: `tsc -b && vite build` (after fixing the missing API method).
- The checked-in `dist/` folders are build artifacts. Netlify rebuilds from
  source; do not configure Netlify to publish the repository copy of `dist/`.

---

## 10. Not verified

- No Netlify site exists yet.
- No custom domain or certificate exists yet.
- No production build has been served from Netlify.
- No Android installation has been performed from `app.<SIGNOVA_DOMAIN>`.
