import { api } from "./api";
import type { TranslateResponse } from "../../../../shared/types/mobile";
import type { Translation } from "../../../../shared/types/translation";

/**
 * ============================================================================
 * CLIENT TRANSLATION BOUNDARY  —  model-agnostic
 * ============================================================================
 *
 * This is the ONLY place in the mobile app that knows a translation is being
 * produced. It calls the backend's POST /sessions/:id/translate and returns
 * the shared `Translation` contract.
 *
 * The `input` argument is an OPAQUE blob. It is passed straight through to the
 * server and this client makes NO assumptions about its contents — not
 * landmarks, not hand count, not one-hand vs two-hand, not MediaPipe, nothing.
 * Whatever the future real model needs is decided behind the server's
 * translationService (and, for on-device inference, inside this function's
 * replacement) — never here at the UI layer.
 *
 * PHASE 6: to run the real two-hand model on-device, replace the body of
 * `requestTranslation` with the on-device call. The signature, return type,
 * and every caller stay identical. No screen, context, or type changes.
 * ============================================================================
 */

export async function requestTranslation(
  sessionId: string,
  input: unknown = null,
  durationMs?: number,
): Promise<TranslateResponse> {
  return api.translate(sessionId, { input, durationMs });
}

/** Re-export the contract type for callers that need it. */
export type { Translation };
