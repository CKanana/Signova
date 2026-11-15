/**
 * Client translation boundary — model-agnostic (PWA port).
 *
 * This is the ONLY place in the PWA that knows a translation is being
 * produced. It calls the backend's POST /sessions/:id/translate and returns
 * the shared `Translation` contract.
 *
 * The `input` argument is an OPAQUE blob passed straight through to the
 * server; this client makes NO assumptions about its contents.
 *
 * When on-device recognition is enabled, the recogniser is wired through the
 * same seam in SessionContext.tsx (requestTranslation uses the on-device
 * top-1 result directly). Signature, return type, and every caller stay
 * identical — no screen, context, or type changes.
 */

import { api } from "./api";
import type { TranslateResponse } from "../../../../shared/types/mobile";
import type { Translation } from "../../../../shared/types/translation";

export async function requestTranslation(
  sessionId: string,
  input: unknown = null,
  durationMs?: number,
): Promise<TranslateResponse> {
  return api.translate(sessionId, { input, durationMs });
}

export type { Translation };
