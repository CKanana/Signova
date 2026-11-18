// preprocess.test.ts — unit tests for landmarksToFloat32 preprocessing.
// Runs with:  ../../node_modules/.bin/tsx.cmd src/model/preprocess.test.ts
// (node:test + tsx, no native / DOM dependencies.)

import { test } from "node:test";
import assert from "node:assert";
import {
  landmarksToFloat32,
  CLIP_LEN,
  VALUES_PER_FRAME,
  VALUES_PER_HAND,
  LANDMARKS_PER_HAND,
  type Landmark,
} from "./preprocess";
import type { HandLandmarksPerFrame } from "../../../../shared/types/session";

const EXPECTED_LENGTH = CLIP_LEN * VALUES_PER_FRAME; // 60 * 126 = 7560

function lm(x: number, y: number, z: number): Landmark {
  return { x, y, z };
}

function hand(landmarks: Landmark[]): { landmarks: Landmark[] } {
  return { landmarks };
}

function frame(left?: Landmark[], right?: Landmark[]): HandLandmarksPerFrame {
  const handLandmarks: Array<{ landmarks: Landmark[] } | null> = [];
  if (left !== undefined) handLandmarks.push(hand(left));
  else handLandmarks.push(null);
  if (right !== undefined) handLandmarks.push(hand(right));
  else handLandmarks.push(null);
  return { handLandmarks: handLandmarks as unknown as [HandLandmarksPerFrame["handLandmarks"][0], HandLandmarksPerFrame["handLandmarks"][1]] };
}

test("preprocess output is a Float32Array of exact [1,60,126] size (7560 values)", () => {
  const out = landmarksToFloat32([]);
  assert.ok(out instanceof Float32Array, "output must be Float32Array");
  assert.strictEqual(out.length, EXPECTED_LENGTH, `expected ${EXPECTED_LENGTH} values, got ${out.length}`);
  // Row-major [1][60][126]: frame f occupies [f*126 .. f*126+125].
  assert.strictEqual(VALUES_PER_FRAME, 126);
  assert.strictEqual(CLIP_LEN, 60);
  assert.strictEqual(VALUES_PER_HAND, 63);
  assert.strictEqual(LANDMARKS_PER_HAND, 21);
});

test("neither hand present -> all-zero sequence (missing frame = zero-padded)", () => {
  const out = landmarksToFloat32([
    frame(), // no hands
    frame(undefined, undefined),
    { handLandmarks: [null, null] }, // missing handLandmarks entirely
  ]);
  assert.strictEqual(out.length, EXPECTED_LENGTH);
  for (let i = 0; i < out.length; i++) {
    assert.strictEqual(out[i], 0, `expected zero at index ${i}`);
  }
});

test("left hand only -> left block filled, right block all zeros", () => {
  const left = [lm(1, 2, 3)].concat(Array(20).fill(0).map((_, k) => lm(k + 10, k + 20, k + 30)));
  assert.strictEqual(left.length, 21);
  const out = landmarksToFloat32([frame(left)]);

  // Left block (offset 0..62), wrist-centred: wrist (landmark 0) -> (0,0,0),
  // every other landmark -> landmark - wrist.
  for (let k = 0; k < 21; k++) {
    const expectX = k === 0 ? 0 : left[k].x - left[0].x;
    const expectY = k === 0 ? 0 : left[k].y - left[0].y;
    const expectZ = k === 0 ? 0 : left[k].z - left[0].z;
    assert.strictEqual(out[k * 3], expectX, `left x landmark ${k}`);
    assert.strictEqual(out[k * 3 + 1], expectY, `left y landmark ${k}`);
    assert.strictEqual(out[k * 3 + 2], expectZ, `left z landmark ${k}`);
  }
  // Right block (offset 63..125) all zeros.
  for (let i = 63; i < 126; i++) {
    assert.strictEqual(out[i], 0, `right block should be zero at ${i}`);
  }
  // Rest of clip (frames 1..59) all zeros.
  for (let f = 1; f < CLIP_LEN; f++) {
    for (let i = 0; i < VALUES_PER_FRAME; i++) {
      assert.strictEqual(out[f * VALUES_PER_FRAME + i], 0, `frame ${f} should be zero`);
    }
  }
});

test("right hand only -> right block filled, left block all zeros", () => {
  const right = [lm(1, 2, 3)].concat(Array(20).fill(0).map((_, k) => lm(k + 10, k + 20, k + 30)));
  assert.strictEqual(right.length, 21);
  const out = landmarksToFloat32([frame(undefined, right)]);

  // Left block (offset 0..62) all zeros.
  for (let i = 0; i < 63; i++) {
    assert.strictEqual(out[i], 0, `left block should be zero at ${i}`);
  }
  // Right block (offset 63..125), wrist-centred.
  for (let k = 0; k < 21; k++) {
    const expectX = k === 0 ? 0 : right[k].x - right[0].x;
    const expectY = k === 0 ? 0 : right[k].y - right[0].y;
    const expectZ = k === 0 ? 0 : right[k].z - right[0].z;
    assert.strictEqual(out[63 + k * 3], expectX, `right x landmark ${k}`);
    assert.strictEqual(out[63 + k * 3 + 1], expectY, `right y landmark ${k}`);
    assert.strictEqual(out[63 + k * 3 + 2], expectZ, `right z landmark ${k}`);
  }
});

test("both hands present -> left block first, then right block, anatomical ordering preserved", () => {
  const left = [lm(1, 2, 3)].concat(Array(20).fill(0).map((_, k) => lm(k + 10, k + 20, k + 30)));
  const right = [lm(100, 200, 300)].concat(Array(20).fill(0).map((_, k) => lm(k + 1000, k + 2000, k + 3000)));
  const out = landmarksToFloat32([frame(left, right)]);

  for (let k = 0; k < 21; k++) {
    const lx = k === 0 ? 0 : left[k].x - left[0].x;
    const ly = k === 0 ? 0 : left[k].y - left[0].y;
    const lz = k === 0 ? 0 : left[k].z - left[0].z;
    const rx = k === 0 ? 0 : right[k].x - right[0].x;
    const ry = k === 0 ? 0 : right[k].y - right[0].y;
    const rz = k === 0 ? 0 : right[k].z - right[0].z;
    assert.strictEqual(out[k * 3], lx);
    assert.strictEqual(out[k * 3 + 1], ly);
    assert.strictEqual(out[k * 3 + 2], lz);
    assert.strictEqual(out[63 + k * 3], rx);
    assert.strictEqual(out[63 + k * 3 + 1], ry);
    assert.strictEqual(out[63 + k * 3 + 2], rz);
  }
});

test("wrist-centring normalisation: wrist landmark becomes (0,0,0) for each present hand", () => {
  const left = [lm(10, 20, 30), lm(13, 24, 36)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const right = [lm(5, 5, 5), lm(8, 9, 10)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const out = landmarksToFloat32([frame(left, right)]);

  // Wrist = landmark 0. After centring, wrist should be exactly (0,0,0).
  assert.strictEqual(out[0], 0);
  assert.strictEqual(out[1], 0);
  assert.strictEqual(out[2], 0);
  assert.strictEqual(out[63], 0);
  assert.strictEqual(out[64], 0);
  assert.strictEqual(out[65], 0);

  // Non-wrist landmark shifted relative to wrist: lm1 - wrist.
  assert.strictEqual(out[3], 13 - 10);
  assert.strictEqual(out[4], 24 - 20);
  assert.strictEqual(out[5], 36 - 30);
  assert.strictEqual(out[63 + 3], 8 - 5);
  assert.strictEqual(out[63 + 4], 9 - 5);
  assert.strictEqual(out[63 + 5], 10 - 5);
});

test("missing landmarks within a detected hand are zeroed", () => {
  // Left hand with only landmark 0 defined; landmarks 1..20 missing.
  const left = [lm(7, 8, 9)];
  const out = landmarksToFloat32([frame(left)]);
  assert.strictEqual(out[0], 7 - 7); // wrist -> 0
  assert.strictEqual(out[1], 8 - 8);
  assert.strictEqual(out[2], 9 - 9);
  for (let k = 1; k < 21; k++) {
    assert.strictEqual(out[k * 3], 0, `left landmark ${k} x should be zero`);
    assert.strictEqual(out[k * 3 + 1], 0, `left landmark ${k} y should be zero`);
    assert.strictEqual(out[k * 3 + 2], 0, `left landmark ${k} z should be zero`);
  }
});

test("fewer than 60 frames are tail-padded with zeros to exactly 60", () => {
  const left = [lm(1, 2, 3)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const frames = [frame(left), frame(left)]; // only 2 frames
  const out = landmarksToFloat32(frames);

  assert.strictEqual(out.length, EXPECTED_LENGTH);
  // Frames 0 and 1 contain data; frames 2..59 all zeros.
  for (let f = 2; f < CLIP_LEN; f++) {
    for (let i = 0; i < VALUES_PER_FRAME; i++) {
      assert.strictEqual(out[f * VALUES_PER_FRAME + i], 0, `tail frame ${f} should be zero`);
    }
  }
  // Frame 0 and 1 identical (same input).
  for (let i = 0; i < VALUES_PER_FRAME; i++) {
    assert.strictEqual(out[i], out[VALUES_PER_FRAME + i], `frame 0 and 1 should match at ${i}`);
  }
});

test("exactly 60 frames are not padded or truncated", () => {
  const left = [lm(1, 2, 3)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const frames = Array.from({ length: 60 }, () => frame(left));
  const out = landmarksToFloat32(frames);
  assert.strictEqual(out.length, EXPECTED_LENGTH);
  // Every frame's wrist (offset 0) should be normalised to 0.
  for (let f = 0; f < CLIP_LEN; f++) {
    assert.strictEqual(out[f * VALUES_PER_FRAME], 0, `frame ${f} wrist x should be 0`);
  }
});

test("more than 60 frames are truncated to the first 60", () => {
  const left = [lm(1, 2, 3)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const right = [lm(9, 9, 9)].concat(Array(20).fill(0).map(() => lm(0, 0, 0)));
  const frames = Array.from({ length: 100 }, () => frame(left, right));
  const out = landmarksToFloat32(frames);
  assert.strictEqual(out.length, EXPECTED_LENGTH, "truncated clip must still be exactly 60 frames");
  // Only first 60 frames contain data; buffer length fixed at 7560.
  for (let f = 0; f < CLIP_LEN; f++) {
    assert.strictEqual(out[f * VALUES_PER_FRAME], 0); // wrist normalised
    assert.strictEqual(out[f * VALUES_PER_FRAME + 63], 0); // right wrist normalised (9-9=0)
  }
});
