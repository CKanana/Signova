// preprocess.ts — pure function: per-frame hand landmarks -> Float32Array[60][126]
//
// The MediaPipe Hand Landmarker `HandLandmark` protobuf per hand is an ordered
// list of 21 landmarks; each landmark has x, y, z (and sometimes visibility /
// presence, which we ignore). The on-device model takes a fixed 60-frame clip
// with 126 values per frame (2 hands x 21 landmarks x 3 coords), as read from
// the exported TFLite tensor shape. We output two hand blocks of 21 x y z = 126
// floats per frame.
//
// - Left hand block first (landmarks 0..20), then right-hand block.
// - A missing hand -> all 63 zeros for that block.
// - Missing frame -> all 126 zeros (tail padding).
// - Clip is the first 60 frames (frame range from metadata if present, else
//   the first 60 decoded frames).
//
// No platform imports. Unit-tested with tsx / jest.

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmark {
  landmarks: Landmark[];
}

export interface FrameLandmarks {
  // Per-frame union consumed by the MediaPipe hand landmarker plugin.
  // The only field our app reads is handLandmarks (0..2 hands).
  handLandmarks?: HandLandmark[];
}

import type { HandLandmarksPerFrame } from "../../../../shared/types/session";

/**
 * Number of landmarks per hand.
 */
export const LANDMARKS_PER_HAND = 21;

/**
 * Values per hand block: 21 landmarks x 3 coords (x, y, z).
 */
export const VALUES_PER_HAND = LANDMARKS_PER_HAND * 3; // 63

/**
 * Total values per frame: 2 hands x 63 = 126.
 */
export const VALUES_PER_FRAME = VALUES_PER_HAND * 2; // 126

/**
 * Fixed clip length.
 */
export const CLIP_LEN = 60;

/**
 * Mirrors Python dataset.py: _normalize_hand_block().
 * Centres every landmark in a single hand block around the wrist (landmark 0)
 * in-place. Leaves zero (missing-hand) blocks untouched so the caller's
 * zero-padding contract is preserved.
 *
 * @param sequence The full flat Float32Array for the whole clip.
 * @param offset   Byte-offset of the hand block inside `sequence`
 *                 (0 for the left hand of frame f, 63 for the right hand).
 */
/**
 * Mirrors Python dataset.py: _normalize_hand_block().
 * Centres every *present* landmark in a single hand block around the wrist
 * (landmark 0) in-place. Landmark slots that were never written (a missing
 * landmark inside an otherwise detected hand) are left at zero — they are not
 * shifted by the wrist, so no negative wrist-relative garbage is injected.
 * Leaves all-zero (missing-hand) blocks untouched.
 *
 * @param sequence The full flat Float32Array for the whole clip.
 * @param offset   Index-offset of the hand block inside `sequence`
 *                 (0 for the left hand of frame f, 63 for the right hand).
 * @param written  Uint8Array (same length as sequence) where written[i] === 1
 *                 marks that sequence[i] was explicitly populated from a
 *                 detected landmark.
 */
function normalizeHandBlock(sequence: Float32Array, offset: number, written: Uint8Array): void {
  // If every value in this 63-element block is zero, the hand is missing —
  // preserve the zeros rather than subtracting 0 from 0 needlessly.
  const hasHand = sequence.subarray(offset, offset + VALUES_PER_HAND).some((v) => v !== 0);
  if (!hasHand) return;

  // Wrist is landmark 0 — the first x, y, z triplet in the block.
  const wristX = sequence[offset];
  const wristY = sequence[offset + 1];
  const wristZ = sequence[offset + 2];

  for (let landmark = 0; landmark < LANDMARKS_PER_HAND; landmark++) {
    const i = offset + landmark * 3;
    // Only shift landmarks that were actually detected; leave missing slots at
    // zero so they stay zero after normalisation (matches the training contract
    // where every detected hand carries all 21 landmarks).
    if (!written[i]) continue;
    sequence[i]     -= wristX;
    sequence[i + 1] -= wristY;
    sequence[i + 2] -= wristZ;
  }
}

/**
 * Builds a Float32Array of shape [CLIP_LEN][VALUES_PER_FRAME] from the
 * per-frame landmarks, exactly as the M4b spec requires:
 *  - left-hand block first, then right-hand block
 *  - x, y, z per landmark (MediaPipe landmark ordering 0..20)
 *  - missing hand / missing frame -> all zeros (tail-padding)
 *  - clip is the first CLIP_LEN frames
 *
 * @param frames Per-frame landmarks. Frames shorter than CLIP_LEN are
 *               tail-padded with zeros; frames longer are truncated to the
 *               first CLIP_LEN.
 * @returns Float32Array of shape [CLIP_LEN * VALUES_PER_FRAME] in row-major
 *          order (frame f occupies buffer[f*126 .. f*126+125]).
 *
 * Layout example for frame f:
 *   block 0 (left hand):  buffer[i*126 + 0..62]  = landmark x,y,z for k=0..20
 *   block 1 (right hand): buffer[i*126 + 63..125] = landmark x,y,z for k=0..20
 */
export function landmarksToFloat32(
  frames: HandLandmarksPerFrame[],
): Float32Array {
  const buf = new Float32Array(CLIP_LEN * VALUES_PER_FRAME);
  // Tracks which landmark slots were explicitly populated from a detected
  // landmark, so normalisation never touches unwritten (missing) slots.
  const written = new Uint8Array(CLIP_LEN * VALUES_PER_FRAME);

  for (let f = 0; f < CLIP_LEN; f++) {
    const frame = frames[f];
    if (!frame || !frame.handLandmarks) {
      // Missing frame / no hand -> zeros (missing hands are zero-padded).
      continue;
    }
    const hands = frame.handLandmarks;
    const out = buf.subarray(f * VALUES_PER_FRAME);

    for (let h = 0; h < 2; h++) {
      const hand = hands[h];
      const base = h * VALUES_PER_HAND; // 0 for left, 63 for right
      if (hand) {
        const lms = hand.landmarks;
        if (!lms) {
          // Hand present but landmark array missing -> leave zeros.
          continue;
        }
        for (let k = 0; k < LANDMARKS_PER_HAND; k++) {
          const lm = lms[k];
          if (!lm) {
            // Pad a missing landmark within a detected hand with zeros (left
            // unwritten so normalisation skips it).
            continue;
          }
          const o = base + k * 3;
          const abs = f * VALUES_PER_FRAME + o;
          out[o] = lm.x;
          out[o + 1] = lm.y;
          out[o + 2] = lm.z;
          written[abs] = 1;
        }
      }
      // else: hand missing -> leave zeros
    }
  }

  // Normalise each hand block in-place: mirror Python dataset.py
  // normalize_sequence() which calls _normalize_hand_block() per hand per frame.
  for (let frame = 0; frame < CLIP_LEN; frame++) {
    const frameOffset = frame * VALUES_PER_FRAME;
    normalizeHandBlock(buf, frameOffset, written);                    // left hand
    normalizeHandBlock(buf, frameOffset + VALUES_PER_HAND, written); // right hand
  }

  return buf;
}

/**
 * Validates the input shape and returns the number of frames we actually saw.
 * Pure, side-effect-free helper used in tests.
 */
export function countFrames(frames: HandLandmarksPerFrame[]): number {
  return frames.length;
}
