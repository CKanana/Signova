import type { CSSProperties } from "react";

/** Merge style objects, skipping falsy entries (replaces the React style-array
 *  pattern `[base, cond && extra]` which TypeScript rejects because `false`
 *  is not a CSSProperties value). */
export function mergeStyles(...items: (CSSProperties | undefined | null | false | 0 | "" | boolean)[]): CSSProperties {
  const out: CSSProperties = {};
  for (const item of items) {
    if (item && typeof item === "object") Object.assign(out, item);
  }
  return out;
}
