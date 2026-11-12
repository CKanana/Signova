# Signova Server Test-Suite Jobs

Class-level workflow for running and hardening the Signova server test suites
across multi-job security tasks, plus the evidence-reporting conventions the
user requires for every result.

## When this applies

- Any batch of Phase 5 / regression / security-fix server tests (`server/test/*.test.ts`).
- Any security fix that must be covered by a test suite (teller availability,
  invite token status, staff rules, bootstrap limiter).
- Any commit-per-job session here.
- Any run that must produce real output (never a made-up screenshot, health
  line, or pass/fail count).

## Order of work

1. Read the task's acceptance items (M0/M1 from `docs/phase-5/PHASE_5_PLAN.md`).
2. Typecheck server: `npm run typecheck` (tsc --noEmit). Fix type errors first.
3. Run suites with `npx tsx server/test/<file>.ts`, one suite per command.
4. Record each suite as `passed | failed` counts (evidence type on every result).
5. Fix root causes, not symptoms. Verify the fix with one rerun per job.
6. Commit each job separately with a real message.
7. Update `docs/phase-5/PHASE_5_PLAN.md` with an evidence table for every M0/M1
   item. M1 COMPLETE only if every suite passed; M0 COMPLETE only if the
   screenshots show the logged-in Admin pages (never fabricate screenshots).
8. Stop at the tool-call budget and write the remaining work into the plan.

## Standing rules (every instance of this task)

- Server tests and security fixes only; do not touch Playwright; do not start M2.
- Typecheck with `tsc --noEmit` only; no compiled files.
- mongodb-memory-server only; no real emails.
- Never push; never commit screenshots/, scripts/, tmp/, _backup/ or .env files.
- Evidence type on every result; never claim a check you did not run.
- Never print tokens, passwords, OTPs or secrets.
- A job is NOT done, and must NOT be marked done, unless its tests pass.
- If a run fails, fix only the Playwright/setup so the real output is produced;
  otherwise fix the underlying bug.
- Always use the shared test helper for logins (Job 1) — never ad-hoc logins.
- No `logoUrl` / import-order ReferenceError: seed the admin with the
  confirmed-2FA state (twoFactorEnabled and twoFactorConfirmedAt) plus a
  totpSecret before a 2FA flow can run.
- Never mark M1 COMPLETE, and never claim a suite passed, unless the
  `npm test` table shows 0 failed across every suite.

## What the helper does (for agents reading the code)

`server/test/helpers.ts` provides `loginAsAdminWith2FA(org)` and
`loginAsStaff(org)`: the full real flow (login, challenge, OTP code from the
seeded secret via otplib, enrolment/activation, replay-window handling). Use
these in every suite instead of ad-hoc logins.

## Tool-call budget

Stop at about 80 tool calls and write the remaining work into the plan.
