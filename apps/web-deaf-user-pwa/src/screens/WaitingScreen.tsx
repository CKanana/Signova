import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function WaitingScreen() {
  const {
    goToStep,
    staff,
    sessionStatus,
    joinedTellerId,
  } = useSession();

  const [showJoinedBanner, setShowJoinedBanner] = useState(false);

  const tellerName = staff?.name ?? undefined;
  const counterNumber = staff?.counterNumber ?? "1";
  const statusText = tellerName
    ? `Waiting for ${tellerName}, Counter ${counterNumber} to accept the invite…`
    : `Waiting for Counter ${counterNumber} to accept the invite…`;

  const isJoined = sessionStatus === "ACTIVE" && !!joinedTellerId;

  // Auto-show joined banner when session becomes active.
  useEffect(() => {
    if (isJoined) {
      setShowJoinedBanner(true);
    }
  }, [isJoined]);

  const handleBack = () => {
    goToStep("method");
  };

  const handleContinue = () => {
    goToStep(joinedTellerId ? "live" : "method");
  };

  return (
    <div style={styles.container}>
      {/* Header — solid purple bar, reversed logo, hospital name (white). */}
      <header style={styles.header}>
        <img
          src="/assets/signova-logo-horizontal-light.png"
          alt="Signova"
          style={styles.brandLogo}
        />
        <div style={styles.brandText}>
          <span style={styles.brandName}>{staff?.name ? "Kenyatta National Hospital" : "Kenyatta National Hospital"}</span>
          <span style={styles.brandCode}>KNH</span>
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
          <div style={styles.eyebrowPill}>WAITING FOR YOUR STAFF MEMBER</div>

          {/* H1 — purple-800, weight 800. */}
          <h1 style={styles.heading}>We're connecting you with a staff member</h1>

          {/* Subtitle — ink. */}
          <p style={styles.subtitle}>
            Every conversation deserves to be understood. Your session is open and waiting — we'll connect you as soon as your staff member accepts.
          </p>

          {/* Progress tracker — colour + shape + label. */}
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
            <div className="sn-progress__step" aria-label={isJoined ? "Accepting — completed" : "Accepting — current step"}>
              <div className={`sn-progress__dot ${isJoined ? "sn-progress__dot--completed" : "sn-progress__dot--current"}`} aria-hidden={true}>
                {isJoined ? (
                  <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 12 14 8 4" />
                  </svg>
                ) : null}
              </div>
              <span className={`sn-progress__label ${isJoined ? "sn-progress__label--completed" : "sn-progress__label--current"}`}>
                {isJoined ? "Accepting" : "Accepting"}
              </span>
            </div>
            <span className="sn-progress__arrow" aria-hidden={true}>&rarr;</span>
            <div className="sn-progress__step" aria-label="Signing together — upcoming">
              <div className={`sn-progress__dot ${isJoined ? "sn-progress__dot--current" : "sn-progress__dot--upcoming"}`} aria-hidden={true}>
                {isJoined ? (
                  <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 12 14 8 4" />
                  </svg>
                ) : null}
              </div>
              <span className={`sn-progress__label ${isJoined ? "sn-progress__label--current" : "sn-progress__label--upcoming"}`}>
                Signing together
              </span>
            </div>
          </div>

          {/* Joined banner — shown when teller accepts (Bug 1). */}
          {showJoinedBanner && (
            <div style={styles.joinedBanner} role="status" aria-live="polite">
              <svg width="24" height="24" fill="none" stroke="var(--success-dot)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 12 14 8 4" />
              </svg>
              <div style={styles.joinedCopy}>
                <span style={styles.joinedTitle}>
                  {tellerName ? `Counter ${counterNumber} accepted your request.` : "Your staff member has joined."}
                </span>
                <span style={styles.joinedBody}>
                  Starting {tellerName ? "sign language" : "text chat"}…
                </span>
              </div>
              <TouchButton
                variant="primary"
                size="touch"
                onPress={handleContinue}
                icon={<ArrowRight size={20} color="#FFFFFF" />}
              >
                Continue now
              </TouchButton>
            </div>
          )}

          {/* Info cards: Live reply + Your choice. */}
          <div style={styles.infoCards}>
            <article style={styles.infoCard}>
              <div style={mergeStyles(styles.iconTile, styles.liveIconTile)}>
                <svg width="20" height="20" fill="none" stroke="var(--purple-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="20" height="20" fill="none" stroke="var(--purple-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {/* Status strip — lavender fill, 2px border-ctl border, purple-600 spinner, ink text. */}
          <div
            role="status"
            aria-live="polite"
            aria-label={statusText}
            style={mergeStyles(
              styles.statusStrip,
              isJoined ? styles.statusStripJoined : undefined,
            )}
          >
            <span className="sn-spinner sn-spinner--sm" style={styles.statusSpinner} aria-hidden={true} />
            <span style={styles.statusText}>{statusText}</span>
          </div>

          {/* Secondary Back to method button — not full-width purple bar. */}
          <div style={styles.backButtonWrap}>
            <TouchButton
              variant="outline"
              size="lg"
              onPress={handleBack}
              icon={<ArrowLeft size={20} color="var(--purple-600)" />}
              style={styles.backButton}
            >
              Back to method
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
  header: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
    padding: "calc(var(--space-2) + var(--safe-top)) var(--space-4)",
    borderBottom: "1px solid var(--border-ctl)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } as React.CSSProperties,
  brandLogo: {
    width: 36,
    height: "auto",
    display: "block",
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
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  content: {
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
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
    fontSize: "clamp(28px, 5vw, 40px)",
    fontWeight: 800,
    lineHeight: 1.2,
    color: "var(--purple-800)",
  } as React.CSSProperties,
  subtitle: {
    margin: "0 0 24px",
    fontSize: "clamp(16px, 4vw, 18px)",
    lineHeight: 1.6,
    color: "var(--ink)",
  } as React.CSSProperties,
  progressWrapper: { width: "100%", maxWidth: 560, margin: "0 auto 8px" } as React.CSSProperties,
  joinedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 14,
    background: "var(--success-bg)",
    border: "2px solid var(--success-bg)",
    width: "100%",
    animation: "sn-pulse 2s ease-in-out infinite",
  } as React.CSSProperties,
  joinedCopy: { flex: 1, minWidth: 0, textAlign: "left" } as React.CSSProperties,
  joinedTitle: {
    display: "block",
    fontSize: 15,
    fontWeight: 800,
    color: "var(--success-text)",
    marginBottom: 2,
  } as React.CSSProperties,
  joinedBody: {
    fontSize: 14,
    color: "var(--success-text)",
    margin: 0,
  } as React.CSSProperties,
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
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--border-soft)",
    background: "var(--cream-card)",
    width: "100%",
  } as React.CSSProperties,
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "var(--lavender)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  liveIconTile: {} as React.CSSProperties,
  choiceIconTile: {} as React.CSSProperties,
  infoCopy: { flex: 1, minWidth: 0, textAlign: "left" } as React.CSSProperties,
  infoTitle: {
    display: "block",
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.4,
    color: "var(--purple-800)",
    marginBottom: 4,
  } as React.CSSProperties,
  infoDesc: {
    fontSize: 15,
    lineHeight: 1.55,
    color: "var(--ink)",
    margin: 0,
  } as React.CSSProperties,
  statusStrip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 14,
    background: "var(--lavender)",
    border: "2px solid var(--border-ctl)",
    width: "100%",
  } as React.CSSProperties,
  statusStripJoined: {
    background: "var(--success-bg)",
    borderColor: "var(--success-bg)",
    color: "var(--success-text)",
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
    color: "var(--ink)",
  } as React.CSSProperties,
  backButtonWrap: {
    width: "100%",
    maxWidth: 320,
    marginTop: 8,
  } as React.CSSProperties,
  backButton: {
    width: "100%",
    minHeight: 52,
    borderWidth: 2,
    borderColor: "var(--border-ctl)",
    color: "var(--purple-600)",
    fontWeight: 800,
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
