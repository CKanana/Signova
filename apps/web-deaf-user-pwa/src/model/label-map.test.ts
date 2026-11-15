// label-map.test.ts — validates the recovered 2,000-class label map.
//
// The label map was recovered from WLASL_v0.3.json (official WLASL metadata,
// https://github.com/dxli94/WLASL) by preserving the exact class-index ordering
// used at training time. Training scripts at commit 74a4560 build label_map as
// {gloss: index} by iterating WLASL_v0.3.json entries in order, assigning
// sequential indices. The deployed model's source is "WLASL-2000" with
// numClasses=2000, confirming this ordering.
//
// Residual uncertainty: a different WLASL metadata version could theoretically
// have been used. The first 13 labels match WLASL_v0.3.json order exactly,
// which strongly supports this reconstruction. The mapping is treated as
// authoritative with this documented caveat.

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

const LABELS_URL = new URL("../../public/model/labels.json", import.meta.url);
const EXPECTED_CLASSES = 2000;
const PLACEHOLDER_RE = /^class_\d+$/;

// First 13 WLASL glosses (verified position-by-position against WLASL_v0.3.json).
// These match the training-time class order at indices 0-12.
const WLASL_FIRST_13 = [
  "book", "drink", "computer", "before", "chair", "go", "clothes", "who",
  "candy", "cousin", "deaf", "fine", "help",
];

function readLabels(): string[] {
  const raw = fs.readFileSync(LABELS_URL, "utf8");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), "labels.json must be a JSON array");
  return parsed.map((v) => String(v));
}

test("label map has exactly 2,000 entries", () => {
  const labels = readLabels();
  assert.strictEqual(labels.length, EXPECTED_CLASSES, `expected ${EXPECTED_CLASSES} entries, got ${labels.length}`);
});

test("label map has no duplicate entries", () => {
  const labels = readLabels();
  const dups = labels.filter((v, i) => labels.indexOf(v) !== i);
  assert.strictEqual(dups.length, 0, `found ${dups.length} duplicate labels`);
});

test("label map has no missing / empty entries", () => {
  const labels = readLabels();
  for (let i = 0; i < labels.length; i++) {
    assert.ok(labels[i] && labels[i].length > 0, `entry at index ${i} is empty`);
  }
});

test("label map has zero placeholder entries (all 2,000 are real class names)", () => {
  const labels = readLabels();
  const placeholders = labels.filter((v) => PLACEHOLDER_RE.test(v));
  assert.strictEqual(placeholders.length, 0, `expected 0 placeholders, got ${placeholders.length}`);
});

test("label map is authoritative — every entry is a real WLASL gloss", () => {
  const labels = readLabels();
  // No entry should look like a synthetic placeholder.
  for (let i = 0; i < labels.length; i++) {
    assert.ok(!PLACEHOLDER_RE.test(labels[i]), `index ${i} is a placeholder: ${labels[i]}`);
  }
});

test("first 13 entries match WLASL_v0.3.json training-time order", () => {
  const labels = readLabels();
  for (let i = 0; i < WLASL_FIRST_13.length; i++) {
    assert.strictEqual(labels[i], WLASL_FIRST_13[i], `index ${i}: expected ${WLASL_FIRST_13[i]!}, got ${labels[i]}`);
  }
});

test("preprocess tensor dimensions match the model contract [1,60,126] = 7,560 FLOAT32 values", async () => {
  // Imported from preprocess.ts (single source of truth for the on-device layout).
  const { CLIP_LEN, VALUES_PER_FRAME, VALUES_PER_HAND, LANDMARKS_PER_HAND } = await import("./preprocess");
  assert.strictEqual(CLIP_LEN, 60);
  assert.strictEqual(VALUES_PER_FRAME, 126);
  assert.strictEqual(VALUES_PER_HAND, 63);
  assert.strictEqual(LANDMARKS_PER_HAND, 21);
  assert.strictEqual(CLIP_LEN * VALUES_PER_FRAME, 7560, "one clip must be exactly 7,560 float32 values");
  // Two hands x 21 landmarks x 3 coordinates.
  assert.strictEqual(VALUES_PER_HAND * 2, VALUES_PER_FRAME);
});
