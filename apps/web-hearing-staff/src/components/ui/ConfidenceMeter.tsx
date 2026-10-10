
/**
 * Translation confidence meter.
 *
 * The value shown is ALWAYS the confidence returned by the backend
 * (message.confidence from the shared Translation contract). This component
 * makes no assumptions about the model — when the real two-hand BiLSTM
 * replaces the mock service, the same number flows through unchanged.
 *
 * Bands (mirrors the server's TRANSLATION_LOW_CONFIDENCE threshold of 0.6):
 *   Confident  ≥ 0.80  — green
 *   Moderate   0.60–0.79 — purple
 *   Uncertain  < 0.60  — amber, with the uncertainty called out in text
 */

const LOW_THRESHOLD = 0.6;

export type ConfidenceBand = "high" | "moderate" | "low";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return "high";
  if (confidence >= LOW_THRESHOLD) return "moderate";
  return "low";
}

export function bandLabel(band: ConfidenceBand): string {
  switch (band) {
    case "high":
      return "Confident";
    case "moderate":
      return "Moderate";
    default:
      return "Uncertain";
  }
}

interface ConfidenceMeterProps {
  confidence: number;
  /** Compact mode for inline use inside message cards. */
  compact?: boolean;
}

export function ConfidenceMeter({ confidence, compact = false }: ConfidenceMeterProps) {
  const pct = Math.round(confidence * 100);
  const band = confidenceBand(confidence);
  return (
    <span className="staff-metric" title={`Translation confidence: ${pct}%`}>
      <span className="staff-metric__label">{compact ? "" : "Confidence"}</span>
      <span className="staff-metric__track" role="img" aria-label={`Confidence ${pct} percent`}>
        <span className={`staff-metric__fill staff-metric__fill--${band}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`staff-metric__value staff-metric__value--${band}`}>
        {pct}% · {bandLabel(band)}
      </span>
    </span>
  );
}
