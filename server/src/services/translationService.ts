import type { Translation } from "../../../shared/types/translation.js";

/**
 * ============================================================================
 * MOCK TRANSLATION SERVICE  —  Phase 1
 * ============================================================================
 *
 * This is the ONLY module in the application that knows how a sign→text
 * translation is produced. Everything else depends solely on the `Translation`
 * contract (gloss / confidence / alternatives[]).
 *
 * Today it returns a scripted, realistic-looking result so the rest of the
 * system can be built and tested end-to-end. It makes NO assumptions about
 * the ML model's input format, landmark layout, or one-hand vs two-hand
 * extraction.
 *
 * PHASE 6 (deferred): replace the body of `translate()` with a call to the
 * real two-hand BiLSTM model (on-device TFLite or an inference sidecar).
 * The signature and return type stay identical, so no other file changes.
 * ============================================================================
 */

const PHRASES: Array<{ gloss: string; weight: number }> = [
  { gloss: "Hello, I need help with my account.", weight: 3 },
  { gloss: "I cannot access my online account.", weight: 3 },
  { gloss: "Where is the customer service desk?", weight: 2 },
  { gloss: "I would like to open a new account.", weight: 2 },
  { gloss: "Can you write this down for me?", weight: 2 },
  { gloss: "My card was declined.", weight: 2 },
  { gloss: "I need to speak with a manager.", weight: 1 },
  { gloss: "Thank you for your help.", weight: 1 },
  { gloss: "Please repeat that more slowly.", weight: 1 },
];

const ALT_PHRASES = PHRASES.map((p) => p.gloss);

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

export interface MockTranslateInput {
  /** Opaque captured input from the client. The mock ignores its contents. */
  input?: unknown;
  durationMs?: number;
}

/**
 * Produce a mock translation. Confidence is randomized within a realistic band
 * so low-confidence / uncertain UI states can be exercised during development.
 */
export async function translate(input: MockTranslateInput = {}): Promise<Translation> {
  // Simulate a small amount of processing latency (non-blocking, bounded).
  await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 120));

  const primary = pickWeighted(PHRASES);
  // Confidence band: mostly high, occasionally low so the fallback UI triggers.
  const confidence = Math.random() < 0.25
    ? 0.35 + Math.random() * 0.2 // low → uncertain fallback
    : 0.75 + Math.random() * 0.24; // high → confident

  const others = ALT_PHRASES.filter((g) => g !== primary.gloss)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map((gloss) => ({ gloss, confidence: Math.max(0.05, confidence - Math.random() * 0.4) }));

  return {
    gloss: primary.gloss,
    confidence: Number(confidence.toFixed(3)),
    alternatives: others,
  };
}
