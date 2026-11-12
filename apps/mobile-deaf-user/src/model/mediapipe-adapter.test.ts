// mediapipe-adapter.test.ts — unit tests for toFrameLandmarks.
//
// Tests the isolated adapter ONLY (no native modules). The adapter converts a
// MediaPipe hand-landmarker frame into Signova's FrameLandmarks contract.
// It runs with `tsx` (no ts-jest, no jest config) and needs no native
// dependencies.
//
// Scenarios (M6.3.4):
//   1. Left hand detected alone            -> left slot filled, right null
//   2. Right hand detected alone           -> right slot filled, left null
//   3. Both hands in either detection order -> anatomical by category_name
//   4. Missing handedness metadata          -> throws
//   5. Missing hands                        -> null slots both
//   6. Duplicate handedness labels          -> throws
//   7. Unexpected handedness values         -> throws
//
// preprocess.ts is NOT modified by these tests.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  toFrameLandmarks,
  type MediaPipeHandLandmarksFrame,
  type MediaPipeHandedness,
  VALID_HANDEDNESS_LABELS,
  HAND_CONFIDENCE_MIN,
  HAND_CONFIDENCE_MAX,
} from "./mediapipe-adapter";
import {
  CLIP_LEN,
  VALUES_PER_FRAME,
  VALUES_PER_HAND,
  LANDMARKS_PER_HAND,
} from "./preprocess";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** [x,y,z] per landmark; 21 landmarks = 126 floats. */
function makeLandmarks(override?: Partial<{ [k: number]: { x: number; y: number; z: number } }>): { landmarks: { x: number; y: number; z: number }[] } {
  const lm: { x: number; y: number; z: number }[] = [];
  for (let k = 0; k < LANDMARKS_PER_HAND; k++) {
    lm.push({ x: k, y: k * 0.5, z: k * 0.25 });
  }
  if (override) {
    for (const [k, v] of Object.entries(override)) {
      const idx = Number(k);
      if (lm[idx]) {
        lm[idx] = { ...lm[idx], ...v };
      }
    }
  }
  return { landmarks: lm };
}

/** Hands in reverse (right detected first in the array). */
function reverseOrderFrame(): MediaPipeHandLandmarksFrame {
  return {
    handedness: [
      { category_name: "Right" },
      { category_name: "Left" },
    ],
    landmarks: [
      makeLandmarks({ 0: { x: 100 } }),
      makeLandmarks({ 0: { x: 200 } }),
    ],
  };
}

/** A valid, full right hand (slot 1). */
function rightHandFrame(): MediaPipeHandLandmarksFrame {
  return {
    handedness: [{ category_name: "Right" }],
    landmarks: [makeLandmarks({ 0: { x: 500 } })],
  };
}

/** A valid, full left hand (slot 0). */
function leftHandFrame(): MediaPipeHandLandmarksFrame {
  return {
    handedness: [{ category_name: "Left" }],
    landmarks: [makeLandmarks({ 0: { x: 1 } })],
  };
}

/** No hands at all (null slots). */
function emptyFrame(): MediaPipeHandLandmarksFrame {
  return { handedness: [], landmarks: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Left hand detected alone -> left slot filled, right slot null", () => {
  const frame = leftHandFrame();
  const out = toFrameLandmarks(frame);
  assert.equal(out.handLandmarks?.length, 2);
  assert.ok(out.handLandmarks?.[0]?.landmarks?.length === LANDMARKS_PER_HAND, "slot 0 filled");
  assert.equal(out.handLandmarks?.[1], null);
});

test("Right hand detected alone -> right slot filled, left slot null", () => {
  const frame = rightHandFrame();
  const out = toFrameLandmarks(frame);
  assert.equal(out.handLandmarks?.length, 2);
  assert.equal(out.handLandmarks?.[1]?.landmarks?.length, LANDMARKS_PER_HAND, "slot 1 filled");
  assert.equal(out.handLandmarks?.[0], null);
});

test("Both hands in either detection order -> anatomical by category_name", () => {
  const normal = toFrameLandmarks(leftHandFrame());
  assert.ok(normal.handLandmarks?.[0]?.landmarks?.[0]?.x === 1, "normal: left in slot 0");

  // Reverse order in the array must still map Left->slot0, Right->slot1.
  const reversed = toFrameLandmarks(reverseOrderFrame());
  assert.ok(reversed.handLandmarks?.[0]?.landmarks?.[0]?.x === 200, "slot 0 should be LEFT (x=200)");
  assert.ok(reversed.handLandmarks?.[1]?.landmarks?.[0]?.x === 100, "slot 1 should be RIGHT (x=100)");
});

test("Missing handedness metadata -> throws", () => {
  const frame: MediaPipeHandLandmarksFrame = {
    handedness: [{ category_name: "" }],
    landmarks: [makeLandmarks({})],
  };
  assert.throws(
    () => toFrameLandmarks(frame),
    /Missing handedness metadata/,
  );
});

test("Missing hands -> both slots null", () => {
  const frame = emptyFrame();
  const out = toFrameLandmarks(frame);
  assert.equal(out.handLandmarks?.length, 2);
  assert.equal(out.handLandmarks?.[0], null);
  assert.equal(out.handLandmarks?.[1], null);
});

test("Duplicate handedness labels -> throws", () => {
  const frame: MediaPipeHandLandmarksFrame = {
    handedness: [
      { category_name: "Left" },
      { category_name: "Left" },
    ],
    landmarks: [makeLandmarks({}), makeLandmarks({})],
  };
  assert.throws(
    () => toFrameLandmarks(frame),
    /Duplicate handedness label "Left"/,
  );
});

test("Unexpected handedness values -> throws", () => {
  const frame: MediaPipeHandLandmarksFrame = {
    handedness: [{ category_name: "Ambidextrous" }],
    landmarks: [makeLandmarks({})],
  };
  assert.throws(
    () => toFrameLandmarks(frame),
    /Unexpected handedness value "Ambidextrous"/,
  );
});

// ── Contract / constant sanity checks (from preprocess.ts, not modified) ──

test("preprocess contract constants are unchanged", () => {
  assert.equal(CLIP_LEN, 60);
  assert.equal(VALUES_PER_FRAME, 126);
  assert.equal(VALUES_PER_HAND, LANDMARKS_PER_HAND * 3); // 63
  assert.equal(LANDMARKS_PER_HAND, 21);
});

// ── Handedness metadata guard constants ──

test("VALID_HANDEDNESS_LABELS contains exactly Left and Right", () => {
  assert.deepEqual(
    [...VALID_HANDEDNESS_LABELS].sort(),
    ["Left", "Right"],
  );
});

test("hand confidence range is 0.0 - 1.0", () => {
  assert.equal(HAND_CONFIDENCE_MIN, 0.0);
  assert.equal(HAND_CONFIDENCE_MAX, 1.0);
});
