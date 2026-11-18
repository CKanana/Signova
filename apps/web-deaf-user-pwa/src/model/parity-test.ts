// Parity test: run one sample frame sequence through TS preprocess (126-dim,
// two-hand) and report shape. Compare against Python's 63-dim single-hand.
import { landmarksToFloat32, CLIP_LEN, VALUES_PER_FRAME } from "./preprocess";
import type { HandLandmarksPerFrame } from "../../../../shared/types/session";

// Build a 10-frame clip with two hands present (left hand at slot 0, right at slot 1).
function makeFrame(left: number[][], right: number[][]): HandLandmarksPerFrame {
  return {
    handLandmarks: [
      { landmarks: left.map(([x, y, z]) => ({ x, y, z })) },
      { landmarks: right.map(([x, y, z]) => ({ x, y, z })) },
    ],
  };
}

const frames: HandLandmarksPerFrame[] = [];
for (let f = 0; f < 10; f++) {
  // Left hand: wrist at origin, fingers spread; Right hand: wrist at (1,1,0)
  const left = Array.from({ length: 21 }, (_, k) => [k * 0.01, k * 0.02, 0] as number[]);
  const right = Array.from({ length: 21 }, (_, k) => [1 + k * 0.01, 1 + k * 0.02, 0] as number[]);
  frames.push(makeFrame(left, right));
}

// Pad to CLIP_LEN (60) with [null, null] frames.
while (frames.length < CLIP_LEN) {
  frames.push({ handLandmarks: [null, null] });
}

const out = landmarksToFloat32(frames);

console.log("TS preprocess output:");
console.log("  length:", out.length, "(expected", CLIP_LEN * VALUES_PER_FRAME, ")");
console.log("  valuesPerFrame:", VALUES_PER_FRAME, "(expected 126 = 2 hands * 21 * 3)");
console.log("  clipLen:", CLIP_LEN);

// Spot-check: left wrist (frame 0, block 0, landmark 0) should be ~0 after wrist-relative norm
// Right wrist (frame 0, block 1, landmark 0) should be ~0 after wrist-relative norm
// Left index tip (landmark 8) in frame 0: x=8*0.01=0.08, y=8*0.02=0.16; relative to wrist (0,0,0) -> (0.08, 0.16, 0)
console.log("  frame0 left wrist (block0 lm0):", out[0], out[1], out[2], "(expect ~0,0,0)");
console.log("  frame0 right wrist (block1 lm0):", out[63], out[64], out[65], "(expect ~0,0,0)");
console.log("  frame0 left lm8 (index tip):", out[8*3], out[8*3+1], out[8*3+2], "(expect ~0.08,0.16,0)");
