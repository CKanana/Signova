import React from "react";

/**
 * Status pill. Status is never communicated by colour alone: every pill
 * pairs its colour with a text label (and usually a dot), so it stays
 * understandable in high-contrast mode and for colour-blind users.
 */

export type BadgeTone = "free" | "busy" | "offline" | "live" | "warn" | "danger" | "neutral" | "solid";

interface BadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({ tone, children, dot = false, pulse = false }: BadgeProps) {
  return (
    <span className={`staff-badge staff-badge--${tone}`}>
      {dot && <span className={pulse ? "staff-live-dot" : "staff-badge__dot"} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Map a backend TellerStatus to a tone + human label. */
export function tellerBadge(status: "FREE" | "BUSY" | "OFFLINE"): { tone: BadgeTone; label: string } {
  switch (status) {
    case "FREE":
      return { tone: "free", label: "Available" };
    case "BUSY":
      return { tone: "busy", label: "In a session" };
    default:
      return { tone: "offline", label: "Offline" };
  }
}
