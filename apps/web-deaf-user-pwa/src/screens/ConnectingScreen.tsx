import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { ArrowLeft, HelpCircle, AccessibilityIcon } from "lucide-react";

export function ConnectingScreen() {
  const { staff, connectToSession } = useSession();

  useEffect(() => {
    connectToSession();
  }, [connectToSession]);

  const counterNumber = staff?.counterNumber || "1";
  const statusText = `Waiting for Counter ${counterNumber} to accept the invite…`;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} aria-label="Back">
          <ArrowLeft size={20} color="var(--signova-primary)" />
        </button>
        <div style={styles.brandLockup}>
          <img src="/assets/signova-logo-stacked.png" alt="Signova" style={styles.brandLogo} />
          <div style={styles.brandText}>
            <span style={styles.brandName}>KNH</span>
            <span style={styles.brandSub}>Kenyatta National Hospital</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.iconButton} aria-label="Accessibility settings">
            <AccessibilityIcon size={20} color="var(--signova-primary)" />
          </button>
          <button type="button" style={styles.iconButton} aria-label="Help and guidance">
            <HelpCircle size={20} color="var(--signova-primary)" />
          </button>
        </div>
      </div>
      <div style={styles.scroll}>
        <div style={styles.column}>
          {/* Eyebrow pill */}
          <div style={styles.eyebrowPill}>WAITING FOR YOUR STAFF MEMBER</div>

          {/* H1 */}
          <h1 style={styles.heading}>We're connecting you with a staff member</h1>

          {/* Subtitle */}
          <p style={styles.subtitle}>
            Your session is open and waiting — we'll connect you as soon as your staff member accepts.
          </p>

          {/* Progress tracker */}
          <div className="sn-progress" style={styles.progressWrapper} aria-label="Session progress">
            <div className="sn-progress__step" aria-label="Session opened — completed">
              <div className="sn-progress__dot sn-progress__dot--completed" aria-hidden={true}>
                <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 12 14 8 4" />
                </svg>
              </div>
              <span className="sn-progress__label sn-progress__label--completed">Session opened</span>
            </div>
            <span className="sn-progress__arrow" aria-hidden={true}>&rarr;</span>
            <div className="sn-progress__step" aria-label="Accepting — current step">
              <div className="sn-progress__dot sn-progress__dot--current" aria-hidden={true} />
              <span className="sn-progress__label sn-progress__label--current">Accepting</span>
            </div>
            <span className="sn-progress__arrow" aria-hidden={true}>&rarr;</span>
            <div className="sn-progress__step" aria-label="Signing together — upcoming">
              <div className="sn-progress__dot sn-progress__dot--upcoming" aria-hidden={true} />
              <span className="sn-progress__label sn-progress__label--upcoming">Signing together</span>
            </div>
          </div>

          {/* Info cards: Live reply + Your choice */}
          <div style={styles.infoCards}>
            <article style={styles.infoCard}>
              <div style={mergeStyles(styles.iconTile, styles.liveIconTile)}>
                <svg width="20" height="20" fill="none" stroke="var(--signova-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 18" />
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div style={styles.infoCopy}>
                <span style={styles.infoTitle}>Live reply</span>
                <span style={styles.infoDesc}>Your staff member will reply to your signs in real time.</span>
              </div>
            </article>
            <article style={styles.infoCard}>
              <div style={mergeStyles(styles.iconTile, styles.choiceIconTile)}>
                <svg width="20" height="20" fill="none" stroke="var(--signova-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div style={styles.infoCopy}>
                <span style={styles.infoTitle}>Your choice</span>
                <span style={styles.infoDesc}>You chose sign language — it will be recognised on your device.</span>
              </div>
            </article>
          </div>

          {/* Status strip */}
          <div
            role="status"
            aria-live="polite"
            aria-label={statusText}
            style={mergeStyles(styles.statusStrip)}
          >
            <span className="sn-spinner sn-spinner--sm" style={styles.statusSpinner} aria-hidden={true} />
            <span style={styles.statusText}>{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--cornsilk)",
    fontFamily: "var(--signova-font-family)",
    color: "var(--signova-text)",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "calc(var(--signova-spacing-sm) + var(--signova-safe-top)) var(--signova-spacing-md)",
    borderBottom: "1px solid var(--signova-border)",
    background: "var(--signova-surface)",
  } as React.CSSProperties,
  backButton: {
    background: "transparent",
    border: "2px solid var(--signova-border-ctl)",
    borderRadius: "var(--signova-radius-control)",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--signova-text)",
    flexShrink: 0,
  } as React.CSSProperties,
  brandLockup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  brandLogo: {
    width: 32,
    height: 32,
    flexShrink: 0,
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
    color: "var(--signova-text-strong)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  brandSub: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--signova-muted-text)",
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
    background: "transparent",
    border: "2px solid var(--signova-border-ctl)",
    borderRadius: "var(--signova-radius-control)",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--signova-text)",
  } as React.CSSProperties,
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "calc(var(--signova-spacing-md) + var(--signova-safe-top)) var(--signova-spacing-md) calc(var(--signova-spacing-xl) + var(--signova-safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  column: {
    maxWidth: 560,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    alignItems: "center",
    textAlign: "center",
  } as React.CSSProperties,
  eyebrowPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: "var(--signova-radius-pill)",
    background: "var(--signova-primary-soft)",
    border: "1px solid var(--signova-border)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "var(--signova-primary)",
  } as React.CSSProperties,
  heading: {
    margin: "0 0 12px",
    fontSize: "clamp(28px, 5vw, 40px)",
    fontWeight: 800,
    lineHeight: 1.2,
    color: "var(--signova-text-strong)",
  } as React.CSSProperties,
  subtitle: {
    margin: "0 0 24px",
    fontSize: "clamp(16px, 4vw, 18px)",
    lineHeight: 1.6,
    color: "var(--signova-text)",
  } as React.CSSProperties,
  progressWrapper: { width: "100%", maxWidth: 420 } as React.CSSProperties,
  infoCards: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  } as React.CSSProperties,
  infoCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: "var(--signova-radius-card)",
    border: "1px solid var(--signova-border)",
    background: "var(--signova-surface)",
    boxShadow: "var(--signova-shadow-card)",
    width: "100%",
  } as React.CSSProperties,
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "var(--signova-primary-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  liveIconTile: { borderColor: "var(--signova-primary)" } as React.CSSProperties,
  choiceIconTile: { borderColor: "var(--signova-primary)" } as React.CSSProperties,
  infoCopy: { flex: 1, minWidth: 0, textAlign: "left" } as React.CSSProperties,
  infoTitle: {
    display: "block",
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.4,
    color: "var(--signova-primary)",
    marginBottom: 4,
  } as React.CSSProperties,
  infoDesc: {
    fontSize: 15,
    lineHeight: 1.55,
    color: "var(--signova-text)",
    margin: 0,
  } as React.CSSProperties,
  statusStrip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 14,
    background: "var(--signova-primary-soft)",
    border: "2px solid var(--signova-border-ctl)",
    width: "100%",
  } as React.CSSProperties,
  statusSpinner: {
    width: 16,
    height: 16,
    borderWidth: 2.5,
    flexShrink: 0,
  } as React.CSSProperties,
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
    color: "var(--signova-text)",
  } as React.CSSProperties,
};

function mergeStyles<T extends Record<string, any>>(
  ...styles: (T | undefined | null)[]
): T {
  const result: Partial<T> = {};
  for (const s of styles) {
    if (s) Object.assign(result, s);
  }
  return result as T;
}
