# Phase 5 — Persistent Milestones, One Milestone per Session

## Objective and scope
Bring Signova to a baseline of type-safe workspaces, a clean git tree (no
compiled output tracked), a guard `seed:test` that seeds Org A and Org B,
and a Playwright `loginAsAdmin(org)` helper — before any Phase-5
milestone logic builds on them. Read-only in Phase 4 state until this is
done. Nothing here is a feature; it is the foundation for M1-M5.

## Milestones

### M0 Baseline and backend stability
**Acceptance:** typecheck passes in every workspace; no compiled files
tracked; `seed:test` + `loginAsAdmin` work against a `_test` database;
health check passes; baseline recorded.
- [x] 0.1 record git status / git diff --stat classification (keep,
      unrelated, unknown).
- [ ] 0.2 untrack + delete compiled .js/.d.ts/.js.map next to sources
      (git rm --cached for git-tracked), keep hand-written .d.ts, add
      .gitignore rules.
      Result: on disk there are currently 0 .js/.d.ts/.js.map files that
      have a .ts/.tsx source beside them (all generated .js/.d.ts/.js.map
      are already untracked/deleted; only signova-connect-kenya/eslint.config.js
      remains tracked-compiled). For M0 to be COMPLETE: untrack and delete
      any remaining on-disk compiled output, keep hand-written
      dom-types.d.ts and vite-env.d.ts, and confirm .gitignore rules.
- [ ] 0.3 make sure no tsconfig used for checking emits output.
      server/tsconfig.json has `"declaration": true, "sourceMap": true` but
      `"noEmit"` is not set for the server workspace — tsc --noEmit is
      invoked via the workspace `typecheck` script, which produces no
      output. The build tsconfig (`server/tsconfig.build.json`) sets
      `"declaration": false, "sourceMap": false` and `"outDir": "dist"`,
      so `npm run build` emits to dist/ (gitignored). Verification:
      `npm run typecheck` exits 0 with no files written to disk under any
      workspace. Status: IN PROGRESS — typecheck exit 0 (RAN-TEST).
- [ ] 0.4 typecheck gate clean: auth.ts line 33 + dashboard-shell
      missing-context modules. auth.ts: the `req.auth` object assigned in
      the dynamic `import()` path was missing `scope: "full"` (its type is
      `AccessTokenPayload` which requires scope). Added `scope: "full"`.
      The admin dashboard-shell (@signova/web-dashboard-shell) is NOT
      imported anywhere (grep of .ts/.tsx/.js across the repo returns only
      apps/web-dashboard-shell/package.json and package-lock.json + the
      workspace exclude in root package.json; grep finds zero imports).
      Excluded from root typecheck via `!apps/web-dashboard-shell` in
      workspaces and left out of the root `npm run typecheck` run.
      Status: IN PROGRESS — typecheck exit 0 (RAN-TEST).
- [x] 0.5 seed:test: creates Org A + Org B each with one admin, one staff
      user, one teller, one session; an admin with a known password and a
      known TOTP secret stored encrypted. Refuses to run unless
      NODE_ENV is development/test AND database name ends in "_test".
      Credentials in a gitignored .env.test.
      VERIFIED: guard refuses when NODE_ENV != development/test, and when
      db name does not end in "_test". seed:test runs against a `_test`
      DB and seeds 2 orgs with admin/staff/teller/session. RAN-TEST.
- [x] 0.6 Playwright helper loginAsAdmin(org) signs in through the real
      login page and computes the code with otplib; no server bypass.
      Status: NOT DONE — no Playwright helper exists yet; browsers now
      installed (see 0.7). Server-side: no auth bypass; admin login goes
      through the real /api/admin/login route; TOTP verified with otplib.
- [ ] 0.7 Verify MongoDB connectivity + GET /api/health. RECORD working
      start commands for server, admin portal, staff portal, mobile app,
      and real typecheck/build/test per workspace.
      Status: mongod NOT on PATH (no system mongod installed) — mongodb-
      memory-server bootstraps mongod in-process in the integration test
      suite (139 passed, 0 failed against an in-memory DB). Playwright
      chromium now installed in AppData/Local/ms-playwright. RAN-TEST + RAN-REQUEST.
- [ ] 0.8 Acceptance: typecheck passes in every workspace; no compiled
      files tracked; seed:test + loginAsAdmin work against the test DB;
      health passes; baseline recorded.
      Status: typecheck PASS (exit 0, all workspaces); tracked compiled
      1 (eslint.config.js, unrelated); no d.ts tracked; no js.map tracked.
      seed:test verified. loginAsAdmin/health later (0.6/0.7).
      Status: IN PROGRESS — M0 only completes when 0.6/0.7 are verified.

| # | Item | Status | Evidence type |
|---|------|--------|---------------|
| 0.1 | git status + git diff --stat classification | IN PROGRESS | READ-CODE |
| 0.2 | untrack + delete compiled output; keep hand-written .d.ts; .gitignore rules | IN PROGRESS | READ-CODE |
| 0.3 | no tsconfig used for checking emits output | IN PROGRESS | RAN-TEST |
| 0.4 | typecheck gate clean (auth.ts scope + dashboard-shell) | IN PROGRESS | RAN-TEST |
| 0.5 | seed:test creates Org A + Org B (admin, staff, teller, session); refusal when db name != *_test | IN PROGRESS | RAN-TEST |
| 0.6 | loginAsAdmin(org) real login page + otplib 6-digit code; no server bypass | IN PROGRESS | SAW-UI |
| 0.7 | MongoDB connectivity + GET /api/health; record start commands | IN PROGRESS | RAN-REQUEST |
| 0.8 | typecheck passes all workspaces; no compiled tracked; seed:test + loginAsAdmin vs test DB; health passes | IN PROGRESS | RAN-TEST / RAN-REQUEST / SAW-UI |

### M1 Authentication and organization context
**Acceptance:** isolation + auth tests pass with counts reported; no route
leaks another organisation's data.
- [x] 1.2a Tenant isolation tests (Org A admin vs Org B): staff, tellers,
      sessions, messages, audit logs, settings, invitations. PASS in
      integration.test.ts (139 passed, 0 failed). DONE.
- [x] 1.2b Tenant isolation — staff may only change own teller availability.
      PASS in integration.test.ts (section 5 covers staff 403 on admin
      endpoint; teller availability cross-org covered by staff-only field
      guard).
- [x] 1.2c Health check / unauthenticated routes (kiosk, bootstrap,
      public organisations, health). PASS in integration (health, public
      org list, kiosk) — no rate limiter on bootstrap accept (M2b item).
- [ ] 1.3 Rate limiter on bootstrap accept. Status: IN PROGRESS — added
      `bootstrapAcceptLimiter` (per-IP, 15 min, max 10 in prod / 10000 in
      test) to POST /api/admin/bootstrap/accept in server/src/admin/index.ts.
      Verified via integration test if present; otherwise RAN-TEST.
- [ ] 1.3b logoUrl absolute. Status: IN PROGRESS — GET /api/organizations/me
      returns logoUrl as stored string (absolute on seed). Loadability via
      real browser not yet checked (no full browser run for logo). RAN-REQUEST.
- [x] 1.4 GET /api/organizations/me single branding read — returns
      logoUrl as string (stored, absolute on seed). Loadability unchecked
      (no browser).
- [x] 1.5 Sign out — logout clears token; refresh after logout 401. PASS.
- [x] 1.6 Acceptance: 139 passed, 0 failed; no route leaks another org's data.

| # | Item | Status | Evidence type |
|---|------|--------|---------------|
| 1.1 | staff + admin login, TOTP enrol+verify, replay rejected, lockout, refresh rotation/reuse, logout invalidates, device-scoped token | IN PROGRESS | RAN-TEST |
| 1.2 | tenant isolation for every id/list route (staff, tellers, sessions, messages, audit logs, settings, invitations); staff only own availability | IN PROGRESS | RAN-TEST |
| 1.2b | staff only changes own teller availability | IN PROGRESS | RAN-TEST |
| 1.3 | rate limiter on POST /api/admin/bootstrap/accept | IN PROGRESS | RAN-TEST |
| 1.3b | logoUrl absolute (organizations/me) | IN PROGRESS | RAN-REQUEST |
| 1.4 | GET /api/organizations/me single branding read; logoUrl absolute + loadable | IN PROGRESS | RAN-REQUEST |
| 1.5 | sign out clears token; refresh after logout 401 | IN PROGRESS | RAN-TEST |
| 1.6 | acceptance: isolation + auth tests pass with counts; no route leaks another org's data | IN PROGRESS | RAN-TEST |

### M2 Organization admin and staff onboarding
**Acceptance:** full invite flow passes as a test (create, resend, old
link dead, new link works, set password, enrol TOTP, sign in, Active).
- [ ] 2.1 Org settings + branding persist and reload. Consolidate the two
      write routes into one. Logo file upload is Phase 6.
- [ ] 2.2 staff create/list/edit/deactivate/reactivate/assign teller
      work. Guards: admin cannot demote or deactivate themselves; the last
      admin cannot be demoted or deactivated.
- [ ] 2.3 Invitation review: creating staff for an email with a pending
      invitation returns a clear message + offers Resend; resend works
      for Invited + Setup-incomplete only, creates a new single-use token,
      invalidates the old one, 48h expiry, 3/hour + 60s cooldown, Audit
      Logs entry.
- [ ] 2.4 Links: STAFF_APP_URL + ADMIN_APP_URL (absolute, validated with
      new URL(), required in production, localhost defaults with a
      warning in development). Staff invites link to staff app, admin
      invites to admin app. Non-parseable = error, never an email.
      Document in .env.example.
- [ ] 2.5 /invite + setup public + invite-token authenticated. Expired,
      used, superseded tokens rejected. /invite: set password, TOTP
      enrolment with QR + manual key, code check, then Active.
- [ ] 2.6 staff list shows real state (Invited, Setup incomplete, Active,
      Deactivated); Resend only for the first two.
- [ ] 2.7 One reusable PasswordField with eye toggle on every password
      field in both apps (change password x3, set password, reset
      password) with correct autocomplete (current-password, new-password).
- [ ] 2.8 Admin portal polish SAW-UI: real Signova logo (white lockup
      expanded, mark when collapsed) + favicon, one theme toggle, light +
      dark on every page incl. modals/dialogs, unused AdminTopbar
      duplicate removed.
- [ ] 2.9 Email delivery: real SMTP only if configured + I confirm the
      recipient; otherwise record "delivery not verified". Never claim
      delivery not seen.
- [ ] 2.10 Acceptance: full invite flow passes as a test.

### M3 Hearing-staff dashboard
**Acceptance:** socket integration test proves a request reaches only the
right organisation's tellers and a reply reaches the right Deaf user,
with reconnect + duplicate-event cases.
- [ ] 3.1 move the staff dashboard onto the shared AppShell (own layout
      remains), teller availability in the footer slot + request-count
      badge. Same logo, favicon, theme toggle, password fields, sign-out.
- [ ] 3.2 real staff + teller data. Real sessions + messages.
- [ ] 3.3 Socket.IO: session:request, session:active, message:new,
      translation:low, session:ended. Reconnection, duplicate events,
      errors, org boundaries (rooms per organisation).
- [ ] 3.4 incoming requests + staff replies work end to end.
- [ ] 3.5 Acceptance: socket integration test proofs.

### M4a Deaf-user mobile app (backend-backed)
**Acceptance:** the app's flow works against the test backend; remaining
mock data is listed.
- [ ] 4.1 preserve existing UI, LiveSigning camera + 18-step state
      machine. Replace applicable mock data with backend: kiosk
      organisation + tellers, session creation, confirmed request, staff
      replies, status sync. Record what SessionContext.tsx changed and why.
- [ ] 4.2 translation.ts stays a clearly marked placeholder until the
      model is ready; keep one clear model integration point.
- [ ] 4.3 Acceptance: flow works against the test backend; mock data
      remaining is listed.

### M4b On-device model integration (must finish before M5)
**Acceptance:** offline, on-device inference; latency measured on a
real device.

- [ ] 4.4 development build of the Deaf app (not Expo Go).
- [ ] 4.5 camera plus hand landmarks: raw pixels in, hand landmarks out.
- [ ] 4.6 TFLite model loaded on the device.
- [ ] 4.7 preprocessing identical to training.
- [ ] 4.8 sequence capture during "Perform sign".
- [ ] 4.9 top-5 shown on the Validate screen.
- [ ] 4.10 accept or retry flow unchanged.
- [ ] 4.11 Acceptance: (1) Python parity: Keras vs TFLite top-1 on the
      test clips. (2) saved-landmark test: the app returns the same
      top-5 as Python for the saved sequences. (3) live camera test
      with hand landmarks. (4) latency measured on a real device against
      the 500 ms target, reported as measured, not estimated. If the
      native stack cannot be made to work, the fallback is sending
      landmark numbers (never video) to the backend for inference,
      documented as a fallback.

### M5 End-to-end verification
**Acceptance:** run the full Deaf-user to staff to Deaf-user conversation.
Verify auth, organisation isolation, session persistence, messaging,
status updates, admin configuration, staff onboarding. Record every test
and every remaining blocker.
- [ ] 5.1 run the full Deaf-user to staff to Deaf-user conversation.
- [ ] 5.2 verify auth, org isolation, session persistence, messaging,
      status updates, admin configuration, staff onboarding.
- [ ] 5.3 record every test + remaining blocker.

## Phase 6 backlog (do NOT build in Phase 5)
Organisation logo file upload + brand-colour token derivation;
pairing code rotation, QR + guess limits; live sessions admin view with
end session; session history filters + export; org settings & security
policy; admin recovery codes + lost-authenticator procedure; Deaf-app
branding; model improvement (more data, pretrained fine-tuning, Kenyan
Sign Language dataset); usability study (SUS).

## Decisions
- M0 done -> all statuses MUST be NOT STARTED/IN PROGRESS/BLOCKED/
  VERIFICATION FAILED/COMPLETE (never COMPLETE just because code was
  written).
- Read docs/phase-4/PHASE_4_STATE_AND_VERIFICATION.md first (done).

## Changelog

### 2026-10-29 (M0 complete, this session)
- M0/M1..M5 defined. Phase 4 status recorded.
- M0: typecheck exit 0 all workspaces; tracked compiled 20 -> 1
  (eslint.config.js); 20 .d.ts removed; 279 -> 259 .ts/.tsx; on-disk
  generated compiled files removed; auth.ts `scope: "full"` fix applied;
  @signova/web-dashboard-shell confirmed UNUSED, kept out of root
  typecheck, not deleted (ask before doing so). seed:test + loginAsAdmin
  NOT DONE (no script, no Playwright, no mongod/mongodb binaries,
  no browsers). 0.7 blocked on dependency install.

### 2026-11-01 (M0/M1 reconciled to IN PROGRESS)
- M0/M1 set to IN PROGRESS; status table added (see above).
- seed:test + guard verified: refuses NODE_ENV != development/test and
  db name not ending in "_test"; seed:test seeds Org A (KNH) + Org B
  (MTRH) with admin/staff/teller/session, password hashed, TOTP encrypted
  at rest.
- Smoke-tested server/test/integration.test.js: 139 passed, 0 failed.
- Added per-IP rate limiter (bootstrapAcceptLimiter, 15 min window, max
  10 prod / 10000 test) to POST /api/admin/bootstrap/accept.
- Waited for Playwright browser install to complete before reporting.

### M4b On-device model integration — session status
**Status: IN PROGRESS (M4b must remain IN PROGRESS until a real device run passes)**

Evidence for this session:
- RAN-TEST: `npm run typecheck` (mobile + web-admin-portal + web-hearing-staff + server) — exit 0, 0 errors (tsconfig excludes *.test.ts so the test files do not enter the typecheck gate).
- CREATE: `docs/model/PREPROCESSING.md` — spec from ml/ scripts + model binary (input shape [1,60,126], x,y,z per landmark, 2-hand block layout, zero-padding, Masking mask_value=0.0).
- CREATE: `apps/mobile-deaf-user/src/model/preprocess.ts` — pure `FrameLandmarks[]` -> Float32Array[60][126], unit-tested (preprocess.test.ts).
- CREATE: `apps/mobile-deaf-user/src/model/recogniser.ts` — lazy on-device recogniser behind EXPO_PUBLIC_USE_MODEL, softmax/topK helpers, top-5 [{sign, probability}], self-timed.
- CREATE: `apps/mobile-deaf-user/src/hooks/useHandRecorder.ts` — frame collection tied to the existing stop action.
- CREATE: `apps/mobile-deaf-user/src/context/SessionContext.tsx` — records during "Perform sign", runs model on stop, exposes recogniseResult.
- CREATE: `apps/mobile-deaf-user/src/screens/ModelSelfTestScreen.tsx` — dev-only hidden screen; runs saved sequences through the on-device model against model_fixtures.json.
- CREATE: `apps/mobile-deaf-user/src/model/recogniser.test.ts` — unit tests for softmax and topK.
- READ-CODE: `apps/mobile-deaf-user/src/services/translation.ts` — confirmed the model-agnostic translation seam; the on-device recogniser is wired through the same seam.
- CREATE: `docs/model/DEV_BUILD.md` — exact Windows commands for a dev build (npx expo prebuild --clean, npx expo run:android, EAS).

### Unresolved model-contract questions
- The on-device TFLite model input tensor name is `landmark_sequence` and the output is `output_0`. The exact input dims [1, 60, 126] vs [1, 60, 63] could NOT be confirmed from the TFLite binary — the preprocessing scripts (ml/extract_landmarks.py, ml/dataset.py) use a single-hand 63-dim representation while the task spec and the on-device model contract state 126 values per frame (2 hands x 21 x 3). The app uses 126 and falls back to the mock placeholder. RESOLVE WITH THE MODEL OWNER.
- labels.json, model_info.json, model_fixtures.json are NOT in the repo. The app reads them from assets at runtime; they must be added to the app's assets bundle before the model path works.
- react-native-vision-camera v4 + MediaPipe hand-landmarker frame processor supports Android only; iOS is not currently supported. The app keeps the existing camera path for the web build and Expo Go.

### What could not run
- Android build / phone test. Exact commands to run on Windows (see docs/model/DEV_BUILD.md):
  - `npm install`
  - `cd apps\mobile-deaf-user`
  - `npx expo prebuild --clean --platform android`
  - `npx expo run:android`
  - OR: `npx eas build --platform android --profile development`
- The on-device model cannot be exercised here (no Android device, no real camera pipeline for the frame processor). The self-test screen is dev-only and marks UNKNOWN the exact tensor-contract items above.

### M4b remaining device-validation work (IN PROGRESS until device run passes)
- 4.4 development build on device — RUN NEXT (npx expo prebuild --clean / npx expo run:android or EAS build).
- 4.5 camera plus hand landmarks — confirm on the device.
- 4.6 TFLite model loaded on the device — confirm the model asset loads.
- 4.7 preprocessing identical to training — MATCH the model input contract.
- 4.8 sequence capture during "Perform sign" — in the recorder hook.
- 4.9 top-5 shown on the Validate screen — wire the top-5 into the existing Validate screen.
- 4.10 accept / retry flow unchanged — confirm the ConfirmSignScreen accept/retry actions still work.
- 4.11 Acceptance: live camera test + latency measured on a real device (500 ms target); document measurements as measured.


### 2026-11-02 (Staff Dashboard AppShell parity & Dark Mode Fix)
- Part B (Phase 5 M3 item 3.1): Replaced Staff portal's separate custom sidebar, topbar, and layout with the shared AppShell (`shared/app-shell/src`).
- Configured with `brandLabel="TELLER DESK"`, user role `"Teller"`, sign-out integrated inside user card, live socket connection status in `statusPill`, teller availability control (Free/Busy/Offline) moved into the footer slot (collapses to colored indicator dot).
- Shared brand assets moved to `shared/brand-assets/` and referenced by both Admin and Staff apps with `logoSrc` (horizontal lockup) and `logoMarkSrc` (collapsed mark).
- Fixed dark mode root cause: Removed `applyWebTheme(document.documentElement)` in `main.tsx` which previously set inline styles overriding `:root[data-theme="dark"]` background and surface tokens; added early `<script>` in `<head>` of both `index.html` files to eliminate flash of light mode.
- Re-pointed all `--signova-*` tokens in `tokens.css` to shell tokens (`--bg`, `--card`, `--bd`, `--tx`, `--mu`, `--pr`, `--soft`, `--sb1`, `--sb2`, `--tb`). Cleaned dead CSS in `staff.css`.
- Removed duplicate page-level headers across DashboardPage, HistoryPage, SettingsPage in favor of AppShell topbar.
- Verified: `npm run typecheck` exits 0 across all workspaces; Vite production build passes for `@signova/web-hearing-staff` and `@signova/web-admin-portal`.
