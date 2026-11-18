// liveRecognition.ts — pure temporal stabiliser for live sign recognition.
//
// Consumes per-inference top-1 predictions from the deployed model
// ([1, 60, 126] TFLite classifier over 60-frame landmark clips) and commits a
// gloss to the live translation only when it is temporally stable:
//
//   - the same top-1 gloss must be observed across `stableInferences`
//     consecutive inferences at or above `confidenceThreshold`;
//   - placeholder / unknown / low-confidence predictions break the stability
//     run and are never committed;
//   - the same gloss is not re-committed within `dedupWindowMs`;
//   - after a commit, a short suppression window prevents the same held sign
//     from doubling up.
//
// No model, camera, or DOM access here — purely synchronous and deterministic,
// so it can be unit-tested with simulated predictions.

export interface SignPrediction {
  sign: string;
  probability: number;
  ts: number;
}

export interface CommittedSign {
  sign: string;
  confidence: number;
  ts: number;
}

export interface LiveRecognizerOptions {
  /** Minimum top-1 probability for a prediction to count towards stability. */
  confidenceThreshold: number;
  /** Consecutive agreeing inferences required before a gloss is committed. */
  stableInferences: number;
  /** Inferences after a commit before the next commit is considered. */
  suppressInferences: number;
  /** Minimum ms between commits of the same gloss. */
  dedupWindowMs: number;
}

export const DEFAULT_LIVE_RECOGNITION_OPTIONS: LiveRecognizerOptions = {
  confidenceThreshold: 0.5,
  stableInferences: 3,
  suppressInferences: 8,
  dedupWindowMs: 3000,
};

export class LiveRecognizer {
  private readonly opts: LiveRecognizerOptions;
  private readonly committed: CommittedSign[] = [];
  private pending: { sign: string; count: number } | null = null;
  private lastCommit: { sign: string; ts: number } | null = null;
  private suppressedUntil = 0;
  private inferencesSinceCommit = 0;

  constructor(opts: Partial<LiveRecognizerOptions> = {}) {
    this.opts = { ...DEFAULT_LIVE_RECOGNITION_OPTIONS, ...opts };
  }

  /** Feed one model inference result. Returns the committed gloss, if any. */
  feed(prediction: SignPrediction): CommittedSign | null {
    const now = prediction.ts;
    this.inferencesSinceCommit += 1;

    // Unknown, placeholder, or below-threshold predictions can never be
    // committed and they break any stability run in progress.
    if (
      !prediction.sign ||
      prediction.sign === "unknown" ||
      prediction.probability < this.opts.confidenceThreshold
    ) {
      this.pending = null;
      return null;
    }

    if (this.pending?.sign === prediction.sign) {
      this.pending.count += 1;
    } else {
      this.pending = { sign: prediction.sign, count: 1 };
    }

    if (this.pending.count < this.opts.stableInferences) return null;

    // Do not re-commit the same gloss within the dedup window.
    if (
      this.lastCommit?.sign === prediction.sign &&
      now - this.lastCommit.ts < this.opts.dedupWindowMs
    ) {
      this.pending = null;
      return null;
    }

    // Cool-down after a commit: suppress re-commits of the same held sign so a
    // prolonged sign does not double up. A different sign is allowed through
    // once it is stable.
    if (
      now < this.suppressedUntil &&
      this.lastCommit?.sign === prediction.sign &&
      this.inferencesSinceCommit < this.opts.suppressInferences
    ) {
      return null;
    }

    const committed: CommittedSign = {
      sign: prediction.sign,
      confidence: prediction.probability,
      ts: now,
    };
    this.committed.push(committed);
    this.lastCommit = { sign: prediction.sign, ts: now };
    this.suppressedUntil = now + this.opts.dedupWindowMs;
    this.inferencesSinceCommit = 0;
    this.pending = null;
    return committed;
  }

  /** Committed glosses in the order they were recognised. */
  get committedSigns(): readonly CommittedSign[] {
    return this.committed;
  }

  /** Clear all committed glosses and stability state (e.g. when re-signing). */
  clear(): void {
    this.committed.length = 0;
    this.pending = null;
    this.lastCommit = null;
    this.suppressedUntil = 0;
    this.inferencesSinceCommit = 0;
  }
}
