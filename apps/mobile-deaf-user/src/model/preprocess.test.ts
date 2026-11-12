/**
 * preprocess.ts — unit tests for landmarksToFloat32 with fixtures.
 *
 * Runs with tsx or jest. No platform imports, so it works in any Node
 * environment (tsx or jest with ts-jest).
 */

import {
  landmarksToFloat32,
  countFrames,
  CLIP_LEN,
  VALUES_PER_FRAME,
  VALUES_PER_HAND,
  LANDMARKS_PER_HAND,
} from "./preprocess";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Frame with both hands fully detected (2 hands × 21 × 3 = 126 floats). */
function fullHandFrame(handIndex: number): { handLandmarks: { landmarks: { x: number; y: number; z: number }[] }[] } {
  const landmarks: { x: number; y: number; z: number }[] = [];
  for (let k = 0; k < LANDMARKS_PER_HAND; k++) {
    landmarks.push({
      x: 0.5 + handIndex,   // x = 0.5 for left, 1.5 for right
      y: 0.5,
      z: 0.0,
    });
  }
  return {
    handLandmarks: [
      { landmarks }, // left hand
      { landmarks }, // right hand
    ],
  };
}

/** Frame with no hand (all zeros). */
function emptyFrame(): { handLandmarks: never[] } {
  // handLandmarks is undefined — the function treats "missing hand" as zeros.
  return { handLandmarks: undefined as never };
}

/** Frame with a single hand (left). */
function singleLeftHandFrame(): { handLandmarks: { landmarks: { x: number; y: number; z: number }[] }[] } {
  return {
    handLandmarks: [
      {
        landmarks: Array.from({ length: LANDMARKS_PER_HAND }, (_, k) => ({
          x: 0.5,
          y: 0.5,
          z: 0.0,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preprocess", () => {
  describe("CLIP_LEN", () => {
    it("CLIP_LEN = 60", () => {
      expect(CLIP_LEN).toBe(60);
    });
  });

  describe("VALUES_PER_FRAME", () => {
    it("VALUES_PER_FRAME = 126 (2 hands x 21 x 3)", () => {
      expect(VALUES_PER_FRAME).toBe(126);
    });
    it("VALUES_PER_HAND = 63 (21 x 3)", () => {
      expect(VALUES_PER_HAND).toBe(63);
    });
    it("LANDMARKS_PER_HAND = 21", () => {
      expect(LANDMARKS_PER_HAND).toBe(21);
    });
  });

  describe("landmarksToFloat32 with 60 full hand frames", () => {
    it("returns a Float32Array of length 60 * 126 = 7560", () => {
      const frames = Array.from({ length: 60 }, (_, f) => fullHandFrame(f % 2));
      const buf = landmarksToFloat32(frames);
      expect(buf.length).toBe(60 * 126);
      expect(buf instanceof Float32Array).toBe(true);
    });

    it("fills left hand block with x=0.5 (handIndex=0)", () => {
      const frames = Array.from({ length: 60 }, (_, f) => fullHandFrame(0));
      const buf = landmarksToFloat32(frames);
      const leftBlock = buf.subarray(0, 63);
      expect(leftBlock[0]).toBeCloseTo(0.5);
      expect(leftBlock[1]).toBeCloseTo(0.5);
      expect(leftBlock[2]).toBeCloseTo(0.0);
    });

    it("fills right hand block with x=1.5 (handIndex=1)", () => {
      const frames = Array.from({ length: 60 }, (_, f) => fullHandFrame(1));
      const buf = landmarksToFloat32(frames);
      const rightBlock = buf.subarray(63, 126);
      expect(rightBlock[0]).toBeCloseTo(1.5);
      expect(rightBlock[1]).toBeCloseTo(0.5);
      expect(rightBlock[2]).toBeCloseTo(0.0);
    });

    it("covers the whole clip: frame f occupies buffer[f*126 .. f*126+125]", () => {
      const frames = Array.from({ length: 60 }, (_, f) => fullHandFrame(f % 2));
      const buf = landmarksToFloat32(frames);
      for (let f = 0; f < 60; f++) {
        const frameOffset = f * 126;
        for (let k = 0; k < 21; k++) {
          const o = frameOffset + k * 3;
          expect(buf[o]).toBeCloseTo(0.5 + (f % 2));
          expect(buf[o + 1]).toBeCloseTo(0.5);
          expect(buf[o + 2]).toBeCloseTo(0.0);
          // Right hand block
          const oRight = frameOffset + 63 + k * 3;
          expect(buf[oRight]).toBeCloseTo(0.5 + ((f + 1) % 2));
          expect(buf[oRight + 1]).toBeCloseTo(0.5);
          expect(buf[oRight + 2]).toBeCloseTo(0.0);
        }
      }
    });
  });

  describe("landmarksToFloat32 with empty frames", () => {
    it("returns zeros for a single empty frame", () => {
      const frames = [emptyFrame()];
      const buf = landmarksToFloat32(frames);
      // Missing frame -> all 126 zeros (tail padding)
      expect(buf[0]).toBe(0);
      expect(buf[62]).toBe(0);
      expect(buf[63]).toBe(0);
      expect(buf[125]).toBe(0);
    });

    it("pads a short clip to 60 frames with zero frames", () => {
      const frames = [fullHandFrame(0), emptyFrame()];
      const buf = landmarksToFloat32(frames);
      // Frame 0: left block x=0.5, right block all zeros (missing)
      expect(buf[0]).toBeCloseTo(0.5);
      // Frame 0 right hand block: all zeros
      for (let k = 0; k < 21; k++) {
        const o = 63 + k * 3;
        expect(buf[o]).toBe(0);
        expect(buf[o + 1]).toBe(0);
        expect(buf[o + 2]).toBe(0);
      }
      // Frames 1..59: all zeros
      for (let f = 1; f < 60; f++) {
        for (let v = 0; v < 126; v++) {
          expect(buf[f * 126 + v]).toBe(0);
        }
      }
    });
  });

  describe("landmarksToFloat32 with a single left hand", () => {
    it("fills left block, right block all zeros", () => {
      const frames = Array.from({ length: 60 }, (_, f) => singleLeftHandFrame());
      const buf = landmarksToFloat32(frames);
      // Left hand block: x=0.5
      for (let k = 0; k < 21; k++) {
        const o = k * 3;
        expect(buf[o]).toBeCloseTo(0.5);
        expect(buf[o + 1]).toBeCloseTo(0.5);
        expect(buf[o + 2]).toBeCloseTo(0.0);
      }
      // Right hand block: all zeros
      for (let k = 0; k < 21; k++) {
        const o = 63 + k * 3;
        expect(buf[o]).toBe(0);
        expect(buf[o + 1]).toBe(0);
        expect(buf[o + 2]).toBe(0);
      }
    });
  });

  describe("countFrames", () => {
    it("returns the number of frames", () => {
      expect(countFrames([emptyFrame(), fullHandFrame(0)])).toBe(2);
    });
  });
});
