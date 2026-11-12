# Signova Phase-5 Regression & Security Fixes

Detailed procedure for the recurring multi-job sessions on the Signova server
test suites: running suites, fixing regressions, hardening security rules, and
reporting with real evidence.

## Job order (defined by the user's task, not this file)

Jobs are run in the order the user specifies. Each job = one commit, one suite,
one pass/fail verdict. Common jobs in recent sessions:

- **Job 1: Test hygiene** — shared helpers, 2FA seed fix, `npm test` command.
- **Job 2: Regression** — compare commits to find the breaking change; fix the
  cause, not the assertions.
- **Job 3: Teller availability security** — org-scoped lookup, STAFF own-teller
  rule, ADMIN own-org rule.
- **Job 4: Invite token security** — pending/not-expired/owner-only/consume
  atomically; no 500.
- **Job 5: Logo URL** — absolute vs relative logoUrl resolution in
  `organizationController.ts`.

## Common gotchas

- Seeded admin has `twoFactorEnabled: true` but no `totpSecret` → 2FA login
  breaks. Generate a TOTP secret in the seed before a 2FA flow can run.
- `m1_ran.test.ts` looks like scratch. Merge its useful cases into the proper
  suites and remove it.
- Every suite must exit non-zero on an assertion failure (`check()` helper).
- `npm test` at server level must run all `.ts` suites and print a table
  `suite | passed | failed`, exiting non-zero if any suite fails.
- `check()` failure exits the process with a non-zero code; the test harness
  must not swallow that.

## Evidence report format

Final report (under 15 lines):

- Table of every suite with `passed | failed` from `npm test`.
- The two security fixes with their test results.
- The regression cause, and the commits that fixed it.
- What you could not check.
- Mark M1 COMPLETE only if every suite passes.

## Tool-call budget

Stop at about 80 tool calls and write the remaining work into the plan.
