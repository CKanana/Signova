// liveRecognition.test.ts — unit tests for the live-recognition stabilizer.
// Runs with:  ../../node_modules/.bin/tsx.cmd src/model/liveRecognition.test.ts
// (node:test + tsx, no native / DOM dependencies.)

import { test } from "node:test";
import assert from "node:assert";
import { LiveRecognizer, DEFAULT_LIVE_RECOGNITION_OPTIONS } from "./liveRecognition";

function feedAll(recognizer: LiveRecognizer, predictions: { sign: string; probability: number; ts: number }[]): string[] {
  const committed: string[] = [];
  for (const p of predictions) {
    const c = recognizer.feed(p);
    if (c) committed.push(c.sign);
  }
  return committed;
}

test("commits a stable top-1 gloss after consecutive agreeing inferences", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "hello", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
  ]), ["hello"]);
});

test("does not commit an unstable prediction", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "world", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
  ]), []);
});

test("never commits unknown or placeholder labels", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "unknown", probability: 0.99, ts: 100 },
    { sign: "", probability: 0.99, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
    { sign: "hello", probability: 0.9, ts: 400 },
    { sign: "hello", probability: 0.9, ts: 500 },
  ]), ["hello"]);
});

test("rejects below-threshold predictions", () => {
  const recognizer = new LiveRecognizer({ confidenceThreshold: 0.5 });
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.4, ts: 100 },
    { sign: "hello", probability: 0.4, ts: 200 },
    { sign: "hello", probability: 0.4, ts: 300 },
  ]), []);
});

test("does not repeat the same gloss within the dedup window", () => {
  const recognizer = new LiveRecognizer({ dedupWindowMs: 3000 });
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "hello", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
    { sign: "hello", probability: 0.9, ts: 3100 },
    { sign: "hello", probability: 0.9, ts: 3200 },
    { sign: "hello", probability: 0.9, ts: 3300 },
  ]), ["hello", "hello"]);
});

test("commits different signs in sequence", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "hello", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
    { sign: "help", probability: 0.9, ts: 400 },
    { sign: "help", probability: 0.9, ts: 500 },
    { sign: "help", probability: 0.9, ts: 600 },
  ]), ["hello", "help"]);
});

test("uses default options when none supplied", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "hello", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
  ]), ["hello"]);
  assert.deepEqual(DEFAULT_LIVE_RECOGNITION_OPTIONS, {
    confidenceThreshold: 0.5,
    stableInferences: 3,
    suppressInferences: 8,
    dedupWindowMs: 3000,
  });
});

test("clearing removes all committed glosses and stability state", () => {
  const recognizer = new LiveRecognizer();
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 100 },
    { sign: "hello", probability: 0.9, ts: 200 },
    { sign: "hello", probability: 0.9, ts: 300 },
  ]), ["hello"]);
  assert.deepEqual([...recognizer.committedSigns].map((s) => s.sign), ["hello"]);
  recognizer.clear();
  assert.deepEqual([...recognizer.committedSigns], []);
  // After clearing, the same sign can be committed fresh.
  assert.deepEqual(feedAll(recognizer, [
    { sign: "hello", probability: 0.9, ts: 1000 },
    { sign: "hello", probability: 0.9, ts: 2000 },
    { sign: "hello", probability: 0.9, ts: 3000 },
  ]), ["hello"]);
});
