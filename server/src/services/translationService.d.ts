import type { Translation } from "../../../shared/types/translation.js";
export interface MockTranslateInput {
    /** Opaque captured input from the client. The mock ignores its contents. */
    input?: unknown;
    durationMs?: number;
}
/**
 * Produce a mock translation. Confidence is randomized within a realistic band
 * so low-confidence / uncertain UI states can be exercised during development.
 */
export declare function translate(input?: MockTranslateInput): Promise<Translation>;
