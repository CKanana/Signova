# Node's `node:test` runner — `before()` does NOT block tests

When a test file runs under `node --import tsx --test` (the Signova server
test runner), top-level `before()` / `after()` hooks from `node:test` run
**asynchronously but do not block test execution**. `node:test` schedules
tests and runs them, in parallel, while `before()` is still pending.

Consequence: `before()` that populates module-level globals (env vars,
MongoDB connection, Express server, auth tokens, base URL) can still be
running when the first test body executes. Tests that read those globals
see `undefined`/`null`/stale values — e.g. a staff token that no longer
exists, a `base` URL that is `undefined` (causing `fetch(undefined)`), or
a server that has not yet listened (connection refused). The result is
spurious test failures that look like route or auth bugs but are really
test-harness race conditions.

## Rule

If a test file relies on module-level state populated in `before()`:

1. Create a `ready` promise (or reuse a single top-level `ready` promise)
   declared before `before()`.
2. In `before()`, resolve `ready` only after **all** setup is complete
   (env vars, DB connection, server listening, tokens, seeding).
3. Make every test body `async () => { await ready; ... }` — OR wrap the
   whole body so `ready` is awaited first.

This applies to both `test()` body functions, `before()` hooks themselves
(other than the one that resolves `ready`), and shared helper functions
called from tests.

## Why the rule exists

Node's test runner executes the test queue concurrently with pending
async `before()` hooks. Top-level `await` inside a test body does not
help unless the test body itself awaits. A bare `before()` plus tests
that read globals is a data race: the tests win the race.

## Correct example shape

```ts
import { test, before, after } from "node:test";

let base: string;
const ready = Promise.resolve(); // default resolves immediately

before(async () => {
  // ... set env, connect DB, start server ...
  base = "http://127.0.0.1:" + server.address().port;
  ready = Promise.resolve(); // mark ready (reassign, do NOT await here)
});

test("something", async () => {
  await ready; // <-- tests wait here
  // ... use base, accessToken, etc ...
});
```

## When to apply

- Any `node:test` file that populates globals in `before()` and later
  reads them in `test()` or `after()` hooks.
- Server-boot test files (`server/test/*.test.ts`) that boot Express + a
  DB and then assert on tokens, routes, or session state.
