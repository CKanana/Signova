import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { ArrowRight } from "lucide-react";

export function WelcomeScreen() {
  const { organisation, goToStep } = useSession();

  const orgName = organisation?.name || "Kenyatta National Hospital";
  const orgShort = organisation?.shortName || "KNH";
  const welcomeMsg = organisation?.welcomeMessage || "Communication support is available in sign language or text.";

  return (
    <div style={styles.container}>
      {/* Blurred background image (restored original design). */}
      <div style={styles.bgWrap}>
        <img src="/assets/kenyan-deaf-user-signing.jpg" alt="" style={styles.bgImage} />
        <div style={styles.bgScrim} />
      </div>

      {/* Header — solid purple bar, reversed logo, hospital name (white). */}
      <header style={styles.header}>
        <img
          src="/assets/signova-logo-horizontal-light.png"
          alt="Signova"
          style={styles.brandLogo}
        />
        <div style={styles.brandText}>
          <span style={styles.brandName}>{orgName}</span>
          <span style={styles.brandCode}>{orgShort}</span>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            aria-label="Accessibility settings"
            onClick={() => goToStep("settings")}
            style={styles.iconButton}
          >
            <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 18H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
              <circle cx="11" cy="13" r="6" />
              <path d="M9 7h6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Help and guidance"
            onClick={() => goToStep("help")}
            style={styles.iconButton}
          >
            <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 18" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.content}>
          {/* Eyebrow pill — lavender fill, purple-800 text. */}
          <div style={styles.eyebrowPill}>
            {orgShort} - SIGN LANGUAGE AND TEXT SUPPORT
          </div>

          {/* Hero heading — extra bold, purple-800. */}
          <h1 style={styles.heading}>Welcome to {orgName}</h1>

          {/* Tagline — semi-bold purple-600. */}
          <p style={styles.tagline}>Every conversation deserves to be understood.</p>

          {/* Body — ink 18px. */}
          <p style={styles.body}>{welcomeMsg}</p>

          {/* Buttons — primary solid purple, secondary cream with purple border. */}
          <div style={styles.buttonStack}>
            <TouchButton
              variant="primary"
              size="touch"
              fullWidth
              onPress={() => goToStep("method")}
              icon={<ArrowRight size={23} color="#FFFFFF" />}
            >
              Start communication
            </TouchButton>
            <TouchButton
              variant="outline"
              size="lg"
              fullWidth
              onPress={() => goToStep("help")}
              icon={
                <svg width="22" height="22" fill="none" stroke="var(--purple-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 18H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
                  <circle cx="11" cy="13" r="6" />
                  <path d="M9 7h6" />
                </svg>
              }
            >
              Accessibility help
            </TouchButton>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--cornsilk)",
    fontFamily: "var(--font-family)",
    color: "var(--ink)",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
  } as React.CSSProperties,
  bgWrap: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  bgImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    filter: "blur(12px) brightness(0.75)",
    transform: "scale(1.05)",
  } as React.CSSProperties,
  bgScrim: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    background: "linear-gradient(180deg, rgba(255, 248, 220, 0.30) 0%, rgba(255, 248, 220, 0.45) 100%)",
  } as React.CSSProperties,
  header: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
    padding: "calc(var(--space-2) + var(--safe-top)) var(--space-4)",
    borderBottom: "1px solid var(--border-ctl)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    position: "relative",
    zIndex: 10,
  } as React.CSSProperties,
  brandLogo: {
    width: 40,
    height: "auto",
    display: "block",
    flexShrink: 0,
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
  } as React.CSSProperties,
  brandText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  brandCode: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  } as React.CSSProperties,
  iconButton: {
    background: "rgba(255,255,255,0.15)",
    border: "2px solid rgba(255,255,255,0.35)",
    borderRadius: "var(--radius-control)",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#FFFFFF",
    transition: "background 0.15s, border-color 0.15s",
  } as React.CSSProperties,
  main: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  content: {
    maxWidth: 560,
    width: "100%",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    position: "relative",
  } as React.CSSProperties,
  eyebrowPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: "var(--radius-pill)",
    background: "var(--lavender)",
    border: "1px solid var(--border-soft)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "var(--purple-800)",
  } as React.CSSProperties,
  heading: {
    margin: "0 0 12px",
    fontSize: "clamp(32px, 6vw, 56px)",
    fontWeight: 800,
    lineHeight: 1.15,
    color: "var(--purple-800)",
    letterSpacing: -0.02,
  } as React.CSSProperties,
  tagline: {
    margin: "0 0 16px",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.5,
    color: "var(--purple-600)",
  } as React.CSSProperties,
  body: {
    margin: "0 0 28px",
    fontSize: 18,
    lineHeight: 1.6,
    color: "var(--ink)",
  } as React.CSSProperties,
  buttonStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    maxWidth: 420,
  } as React.CSSProperties,
};
