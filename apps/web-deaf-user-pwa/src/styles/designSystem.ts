import type { CSSProperties } from "react";

/* -------------------------------------------------------------------------- */
/* Signova shared design system — upstream source of the token values         */
/* -------------------------------------------------------------------------- */
export const SNOVA = {
  // Brand colours (Royal Purple / Cornsilk primary palette) + derived tones.
  primary: "#5B2A86",
  primaryDark: "#4A1F6E",
  primarySoft: "#E7DFFF",
  onPrimary: "#FFFFFF",
  cornsilk: "#FFF8DC",
  cornsilkSoft: "#FFFEF4",
  cornsilkInk: "#7A6A3A",
  white: "#FFFFFF",
  lavender: "#C9B4FF",
  deepPurple: "#3D1B5E",

  // Text — tuned for strong contrast.
  text: "#241F27",
  textStrong: "#141018",
  mutedText: "#68636B",
  mutedSoft: "#8A818C",

  // Borders.
  border: "#DED8C8",
  borderStrong: "#C3B9A2",
  borderSoft: "#E7E0D2",

  // Status colours (colour is never the only carrier).
  success: "#1B7548",
  successSoft: "#E6F2EA",
  successBorder: "#93C6AC",
  warning: "#965300",
  warningSoft: "#FAF0DD",
  warningBorder: "#D8A86A",
  danger: "#B3261E",
  dangerSoft: "#FBEAEA",
  dangerBorder: "#D98C87",
  focus: "#315EA8",

  // Radii.
  radiusControl: "12px",
  radiusPanel: "20px",
  radiusPill: "9999px",
  radiusCard: "24px",

  // Elevation.
  shadowSoft: "0 6px 24px rgba(91, 42, 134, 0.14)",
  shadowMedium: "0 12px 40px rgba(91, 42, 134, 0.22)",
  shadowFocus: "0 0 0 4px rgba(49, 94, 168, 0.35)",
  shadowCard: "0 2px 10px rgba(36, 31, 39, 0.10)",

  // Transitions.
  transitionFast: "150ms ease",
  transition: "250ms ease",
} as const;

/* -------------------------------------------------------------------------- */
/* Reusable style atoms (CSS properties, not CSS classes)                     */
/* -------------------------------------------------------------------------- */
export const pageContainer: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  background: "var(--signova-background)",
  fontFamily: "var(--signova-font-family)",
  color: "var(--signova-text)",
  display: "flex",
  flexDirection: "column",
};

export const screenContent: (isTablet?: boolean) => CSSProperties = (isTablet = false) => ({
  padding: 24,
  maxWidth: 1024,
  margin: "0 auto",
  boxSizing: "border-box",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  ...(isTablet ? { padding: 56 } : {}),
});

export const cardBase: CSSProperties = {
  borderRadius: "var(--signova-radius-card)",
  border: "1px solid var(--signova-border)",
  background: "var(--signova-surface)",
  boxShadow: "var(--signova-shadow-card)",
};

export const focusVisible: CSSProperties = {
  outline: "3px solid var(--signova-focus)",
  outlineOffset: 2,
};

export const headingH1: CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 800,
  lineHeight: 1.15,
  letterSpacing: -0.02,
  color: "var(--signova-text-strong)",
};

export const subtitle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.7,
  color: "var(--signova-muted-text)",
};

/* -------------------------------------------------------------------------- */
/* Typographic scale helper (maps a semantic level to a token)                */
/* -------------------------------------------------------------------------- */
export const type = {
  eyebrow: { fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--signova-primary)" },
  display: { fontSize: 40, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.02, color: "var(--signova-text-strong)" },
  title: { fontSize: 28, fontWeight: 800, lineHeight: 1.2, color: "var(--signova-text-strong)" },
  body: { fontSize: 16, lineHeight: 1.6, color: "var(--signova-text)" },
  bodyMuted: { fontSize: 14, lineHeight: 1.55, color: "var(--signova-muted-text)" },
} as const;
