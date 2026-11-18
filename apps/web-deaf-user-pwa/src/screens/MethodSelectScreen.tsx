import React, { useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { ArrowRight, Globe, ChevronDown } from "lucide-react";

export function MethodSelectScreen() {
  const { setMethod, goToStep, accessibility, organisation } = useSession();

  const orgName = organisation?.name || "Kenyatta National Hospital";
  const orgShort = organisation?.shortName || "KNH";
  const currentLang = accessibility?.language || "English / KSL";

  const [hoveredCard, setHoveredCard] = useState<"sign" | "text" | null>(null);

  const handleSelectSign = () => {
    setMethod("sign");
    goToStep("tellers");
  };
  const handleSelectText = () => {
    setMethod("text");
    goToStep("tellers");
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
          <div style={styles.eyebrowRow}>
            <div style={styles.eyebrowRule} />
            <span style={styles.eyebrow}>Choose your communication method</span>
            <div style={styles.eyebrowRule} />
          </div>

          <h1 style={styles.heading}>Choose how you'd like to communicate</h1>

          <p style={styles.subtitle}>
            Every conversation deserves to be understood. Choose the communication method that works best for you.
          </p>

          <div style={styles.cardsContainer}>
            {/* Card 1 — Sign Language */}
            <article
              style={mergeStyles(
                styles.card,
                styles.signCard,
                hoveredCard === "sign" ? styles.cardHover : undefined,
              )}
              onClick={handleSelectSign}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectSign(); } }}
              aria-label="Continue with Sign Language using the camera"
              onMouseEnter={() => setHoveredCard("sign")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={mergeStyles(styles.cardImagePanel, styles.signImagePanel)}>
                <img src="/assets/kenyan-deaf-user-signing.jpg" alt="Person signing in sign language" style={styles.cardImage} />
              </div>
              <div style={mergeStyles(styles.cardBody, styles.signBody)}>
                <div style={mergeStyles(styles.iconTile, styles.signIconTile)}>
                  <img src="/assets/signova-badge-circular.png" alt="Sign Language" style={styles.cardIcon} />
                </div>
                <div style={mergeStyles(styles.cardCopy, styles.signCopy)}>
                  <span style={mergeStyles(styles.cardTitle, styles.signTitle)}>Sign Language</span>
                  <span style={mergeStyles(styles.cardDescription, styles.signDescription)}>
                    Communicate using sign language with on-device sign recognition.
                  </span>
                </div>
                <div style={mergeStyles(styles.cardAction, styles.signAction)}>
                  <TouchButton
                    variant="primary"
                    size="touch"
                    onPress={handleSelectSign}
                    icon={<ArrowRight size={20} color="#FFFFFF" />}
                    accessibilityLabel="Continue with Sign Language"
                  >
                    Continue with Sign Language
                  </TouchButton>
                </div>
              </div>
            </article>

            {/* Card 2 — Text Communication */}
            <article
              style={mergeStyles(
                styles.card,
                styles.textCard,
                hoveredCard === "text" ? styles.cardHover : undefined,
              )}
              onClick={handleSelectText}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectText(); } }}
              aria-label="Continue by typing your message"
              onMouseEnter={() => setHoveredCard("text")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={mergeStyles(styles.cardImagePanel, styles.textImagePanel)}>
                <img src="/assets/text-card-keyboard.png" alt="Text message on a phone" style={styles.cardImage} />
              </div>
              <div style={mergeStyles(styles.cardBody, styles.textBody)}>
                <div style={mergeStyles(styles.iconTile, styles.textIconTile)}>
                  <img src="/assets/signova-badge-circular.png" alt="Text" style={styles.cardIcon} />
                </div>
                <div style={mergeStyles(styles.cardCopy, styles.textCopy)}>
                  <span style={mergeStyles(styles.cardTitle, styles.textTitle)}>Text Communication</span>
                  <span style={mergeStyles(styles.cardDescription, styles.textDescription)}>
                    Type your message and communicate directly with a service teller.
                  </span>
                </div>
                <div style={mergeStyles(styles.cardAction, styles.textAction)}>
                  <TouchButton
                    variant="primary"
                    size="touch"
                    onPress={handleSelectText}
                    icon={<ArrowRight size={20} color="#FFFFFF" />}
                    accessibilityLabel="Continue with Text"
                  >
                    Continue with Text
                  </TouchButton>
                </div>
              </div>
            </article>
          </div>

          <div style={styles.footer}>
            <div style={styles.footerPromise}>
              <div style={styles.footerMark}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5 1.5-1.88 3.7-1.88 5.5A7 7 0 0 0 2 12c0 1.5.5 2.9 1.5 4.2 1.2 1.6 2.8 2.5 4.5 2.7 1.5.2 3-.3 4.4-1z" />
                </svg>
              </div>
              <span style={styles.footerText}>Your communication, your choice. Signova is here to help.</span>
            </div>
            <div style={styles.footerControlPill}>
              <TouchButton
                variant="outline"
                size="touch"
                onPress={() => goToStep("settings")}
                aria-label={`Language settings, current language ${currentLang}`}
                icon={<Globe size={18} color="var(--purple-600)" />}
              >
                <span style={styles.languageText}>EN</span>
                <ChevronDown size={16} color="rgba(91, 42, 140, 0.85)" />
              </TouchButton>
            </div>
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
    maxWidth: 1100,
    margin: "0 auto",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  } as React.CSSProperties,
  eyebrowRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,
  eyebrowRule: {
    width: 44,
    height: 1,
    background: "var(--purple-600)",
  } as React.CSSProperties,
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: 800,
    color: "var(--purple-800)",
    textAlign: "center",
  } as React.CSSProperties,
  heading: {
    maxWidth: 900,
    color: "var(--purple-800)",
    fontSize: "clamp(32px, 6vw, 44px)",
    lineHeight: "52px",
    fontWeight: 800,
    textAlign: "center",
  } as React.CSSProperties,
  subtitle: {
    marginTop: 8,
    color: "var(--ink)",
    fontSize: "clamp(16px, 4vw, 19px)",
    lineHeight: "28px",
    textAlign: "center",
    marginBottom: 0,
  } as React.CSSProperties,
  cardsContainer: {
    width: "100%",
    gap: 16,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
  card: {
    position: "relative",
    borderRadius: "var(--radius-card)",
    overflow: "hidden",
    border: "2px solid var(--border-soft)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    background: "transparent",
    transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
    boxSizing: "border-box",
  } as React.CSSProperties,
  signCard: {} as React.CSSProperties,
  textCard: {} as React.CSSProperties,
  cardHover: {
    border: "2px solid var(--purple-600)",
    transform: "translateY(-4px)",
    boxShadow: "var(--shadow)",
  } as React.CSSProperties,
  cardImagePanel: {
    position: "relative",
    width: "100%",
    height: 180,
    overflow: "hidden",
  } as React.CSSProperties,
  signImagePanel: {} as React.CSSProperties,
  textImagePanel: {} as React.CSSProperties,
  cardImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
  } as React.CSSProperties,
  cardBody: {
    flex: 1,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  } as React.CSSProperties,
  signBody: {} as React.CSSProperties,
  textBody: {} as React.CSSProperties,
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "var(--lavender)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  signIconTile: {} as React.CSSProperties,
  textIconTile: {} as React.CSSProperties,
  cardIcon: {
    width: 26,
    height: 26,
    objectFit: "contain",
    display: "block",
  } as React.CSSProperties,
  cardCopy: {
    width: "100%",
    marginTop: 14,
    display: "contents",
  } as React.CSSProperties,
  signCopy: {} as React.CSSProperties,
  textCopy: {} as React.CSSProperties,
  cardTitle: {
    display: "block",
    fontSize: 24,
    lineHeight: "32px",
    fontWeight: 800,
    marginBottom: 8,
    color: "var(--purple-800)",
  } as React.CSSProperties,
  signTitle: {} as React.CSSProperties,
  textTitle: {} as React.CSSProperties,
  cardDescription: {
    display: "block",
    fontSize: 16,
    lineHeight: "24px",
    color: "var(--ink)",
    margin: 0,
  } as React.CSSProperties,
  signDescription: {} as React.CSSProperties,
  textDescription: {} as React.CSSProperties,
  cardAction: {
    marginTop: 20,
    width: "100%",
  } as React.CSSProperties,
  signAction: {} as React.CSSProperties,
  textAction: {} as React.CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 10,
    flexWrap: "wrap",
    gap: 12,
  } as React.CSSProperties,
  footerPromise: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
  } as React.CSSProperties,
  footerMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "var(--purple-600)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  footerText: {
    color: "var(--ink)",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: "20px",
  } as React.CSSProperties,
  footerControlPill: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    paddingHorizontal: 4,
    borderRadius: 9999,
    border: "2px solid var(--purple-600)",
    background: "var(--cream-card)",
  } as React.CSSProperties,
  languageButton: {
    minHeight: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 9999,
  } as React.CSSProperties,
  languageText: {
    color: "var(--ink)",
    fontSize: 14,
    fontWeight: 700,
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
