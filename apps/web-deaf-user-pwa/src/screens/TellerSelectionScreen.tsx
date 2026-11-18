import React, { useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { ArrowRight, Check, MapPin, Users } from "lucide-react";

export function TellerSelectionScreen() {
  const { tellers, selectTeller, loadTellers, isLoadingTellers, isCreatingSession, error, organisation } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredTellerId, setHoveredTellerId] = useState<string | null>(null);

  const availableTellers = tellers.filter((t) => t.status === "FREE");

  function getInitials(name: string): string {
    return name.split(" ").map((part) => part[0]).join("");
  }

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleContinue = async () => {
    if (!selectedId) return;
    const teller = tellers.find((t) => t._id === selectedId);
    if (!teller) return;
    const ok = await selectTeller(teller);
    if (!ok) {
      await loadTellers();
      setSelectedId(null);
    }
  };

  const selectedTeller = selectedId ? tellers.find((t) => t._id === selectedId) : null;

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
          <span style={styles.brandName}>{organisation?.name || "Kenyatta National Hospital"}</span>
          <span style={styles.brandCode}>{organisation?.shortName || "KNH"}</span>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            aria-label="Accessibility settings"
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
          <div style={styles.intro}>
            <div style={styles.availabilityLabel}>
              <div style={mergeStyles(styles.availabilityDot, { background: "var(--success-dot)" })} />
              <span style={styles.availabilityText}>
                {isLoadingTellers ? "LOADING TELLERS…" : `${availableTellers.length} TELLERS AVAILABLE`}
              </span>
            </div>
            <h2 style={styles.title}>Choose a teller</h2>
            <p style={styles.subtitle}>
              Select who you would like to help with your conversation.
            </p>
          </div>

          {isLoadingTellers && (
            <div style={styles.loadingPanel}>
              <div style={mergeStyles(styles.loadingSpinner, { borderColor: "var(--border-soft)", borderTopColor: "var(--purple-600)" })} />
              <span style={styles.loadingText}>Loading available tellers…</span>
            </div>
          )}

          {!isLoadingTellers && availableTellers.length === 0 && !error && (
            <div style={styles.emptyPanel}>
              <div style={styles.emptyMark}>!</div>
              <div style={styles.emptyCopy}>
                <span style={styles.emptyTitle}>No tellers are available right now</span>
                <span style={styles.emptyBody}>All counters are busy. Please try again in a moment.</span>
              </div>
              <TouchButton variant="outline" size="md" onPress={() => void loadTellers()}>
                Refresh
              </TouchButton>
            </div>
          )}

          {error && (
            <div style={mergeStyles(styles.errorPanel, styles.errorPanelVisible)}>
              <span style={styles.errorIcon}>!</span>
              <span style={styles.errorText}>{error}</span>
              <TouchButton variant="outline" size="md" onPress={() => void loadTellers()}>
                Try again
              </TouchButton>
            </div>
          )}

          {!isLoadingTellers && availableTellers.length > 0 && (
            <div style={styles.tellerList}>
              {availableTellers.map((teller) => (
                <article
                  key={teller._id}
                style={mergeStyles(
                  styles.tellerCard,
                  selectedId === teller._id ? styles.tellerCardSelected : undefined,
                  hoveredTellerId === teller._id ? styles.tellerCardHover : undefined,
                )}
                  onClick={() => handleSelect(teller._id)}
                  role="radio"
                  aria-checked={selectedId === teller._id}
                  aria-label={`${teller.name}, ${teller.serviceLabel}, ${teller.serviceDesk}, available`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(teller._id);
                    }
                  }}
                  onMouseEnter={() => setHoveredTellerId(teller._id)}
                  onMouseLeave={() => setHoveredTellerId(null)}
                >
                  <div style={styles.avatar}>
                    {getInitials(teller.name)}
                  </div>
                  <div style={styles.tellerDetails}>
                    <div style={styles.nameRow}>
                      <span style={styles.tellerName}>{teller.name}</span>
                      <span style={mergeStyles(styles.statusBadge, styles.statusBadgeFree)}>
                        <span className="sn-badge__dot" style={{ backgroundColor: "var(--success-dot)" }} />
                        Available
                      </span>
                    </div>
                    <span style={styles.tellerRole}>{teller.serviceLabel}</span>
                    <div style={styles.serviceDeskRow}>
                      <MapPin size={13} color="var(--purple-600)" />
                      <span style={styles.serviceDesk}>{teller.serviceDesk} &middot; Counter {teller.counterNumber}</span>
                    </div>
                    <span style={styles.tellerLanguages}>Kenyan Sign Language &middot; English</span>
                  </div>
                  <div style={mergeStyles(styles.radio, selectedId === teller._id ? styles.radioSelected : undefined)}>
                    {selectedId === teller._id && (
                      <svg width="14" height="14" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7" cy="7" r="5" />
                      </svg>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={styles.actionsHint}>
            <span style={styles.hintLabel}>Choose a teller</span>
            <span style={styles.hintSub}>Select someone to continue</span>
          </div>
        </div>
      </main>

      {/* Sticky bottom action bar — above safe area. */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerSelection}>
            <div style={mergeStyles(styles.footerMark, selectedId ? styles.footerMarkSelected : undefined)}>
              {selectedId ? <Check size={19} color="#FFFFFF" /> : <Users size={19} color="var(--purple-600)" />}
            </div>
            <div style={styles.footerSelectionCopy}>
              <span style={styles.footerSelectionTitle}>
                {selectedId ? selectedTeller?.name || "Choose a teller" : "Choose a teller"}
              </span>
              <span style={styles.footerNote}>
                {selectedId
                  ? `${selectedTeller?.serviceDesk} &middot; Counter ${selectedTeller?.counterNumber}`
                  : "Select someone to continue"}
              </span>
            </div>
          </div>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            disabled={!selectedId || isCreatingSession}
            loading={isCreatingSession}
            onPress={handleContinue}
            accessibilityLabel={selectedId ? `Connect with ${selectedTeller?.name}` : "Choose a teller to continue"}
            icon={<ArrowRight size={22} color="#FFFFFF" />}
          >
            {isCreatingSession ? "Connecting…" : selectedId ? `Connect with ${selectedTeller?.name.split(" ")[0]}` : "Choose a teller"}
          </TouchButton>
        </div>
      </footer>
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
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) 80px var(--space-4)",
    boxSizing: "border-box",
  } as React.CSSProperties,
  content: {
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } as React.CSSProperties,
  intro: { marginBottom: 4 } as React.CSSProperties,
  availabilityLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  } as React.CSSProperties,
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  } as React.CSSProperties,
  availabilityText: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "var(--purple-800)",
  } as React.CSSProperties,
  title: {
    margin: "4px 0 8px",
    fontSize: 26,
    fontWeight: 800,
    color: "var(--purple-800)",
  } as React.CSSProperties,
  subtitle: {
    margin: 0,
    fontSize: 16,
    color: "var(--ink)",
    lineHeight: 1.6,
  } as React.CSSProperties,
  loadingPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: 20,
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--border-soft)",
    background: "var(--cream-card)",
    width: "100%",
  } as React.CSSProperties,
  loadingSpinner: {
    width: 32,
    height: 32,
    border: "3px solid var(--border-soft)",
    borderTopColor: "var(--purple-600)",
    borderRadius: "50%",
    animation: "sn-spin 0.8s linear infinite",
  } as React.CSSProperties,
  loadingText: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ink)",
  } as React.CSSProperties,
  emptyPanel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--border-soft)",
    background: "var(--cream-card)",
    width: "100%",
  } as React.CSSProperties,
  emptyMark: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--warning-bg)",
    color: "var(--warning-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  } as React.CSSProperties,
  emptyCopy: { flex: 1, minWidth: 0 } as React.CSSProperties,
  emptyTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "var(--purple-800)",
    margin: "0 0 4px",
  } as React.CSSProperties,
  emptyBody: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--ink)",
    margin: 0,
  } as React.CSSProperties,
  errorPanel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-bg)",
    color: "var(--danger-text)",
    fontSize: 13,
    fontWeight: 600,
    width: "100%",
    opacity: 0,
    transform: "translateY(-8px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  } as React.CSSProperties,
  errorPanelVisible: {
    opacity: 1,
    transform: "translateY(0)",
  } as React.CSSProperties,
  errorIcon: {
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  } as React.CSSProperties,
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.5,
  } as React.CSSProperties,
  tellerList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } as React.CSSProperties,
  tellerCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: "var(--radius-card)",
    border: "2px solid var(--border-soft)",
    background: "transparent",
    cursor: "pointer",
    transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
    width: "100%",
    boxSizing: "border-box",
  } as React.CSSProperties,
  tellerCardSelected: {
    border: "2px solid var(--purple-600)",
    boxShadow: "0 0 0 3px rgba(var(--purple-600-rgb), 0.18)",
  } as React.CSSProperties,
  tellerCardHover: {
    border: "2px solid var(--purple-600)",
    transform: "translateY(-4px)",
    boxShadow: "var(--shadow)",
  } as React.CSSProperties,
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "var(--purple-600)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    textTransform: "uppercase",
    flexShrink: 0,
  } as React.CSSProperties,
  tellerDetails: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  tellerName: {
    fontWeight: 800,
    color: "var(--purple-800)",
    margin: 0,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    background: "var(--success-bg)",
    border: "1px solid var(--success-bg)",
    fontSize: 12,
    fontWeight: 800,
    color: "var(--success-text)",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  statusBadgeFree: {} as React.CSSProperties,
  tellerRole: {
    margin: "2px 0 0",
    fontSize: 13,
    color: "var(--ink)",
    fontWeight: 600,
  } as React.CSSProperties,
  serviceDeskRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  } as React.CSSProperties,
  serviceDesk: {
    fontSize: 13,
    color: "var(--ink)",
    fontWeight: 600,
  } as React.CSSProperties,
  tellerLanguages: {
    fontSize: 13,
    color: "var(--ink)",
    marginTop: 2,
  } as React.CSSProperties,
  radio: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "2px solid var(--border-ctl)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  radioSelected: {
    borderColor: "var(--purple-600)",
  } as React.CSSProperties,
  actionsHint: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 8,
  } as React.CSSProperties,
  hintLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "var(--purple-800)",
    textTransform: "uppercase",
    letterSpacing: 1,
  } as React.CSSProperties,
  hintSub: {
    fontSize: 12,
    color: "var(--ink)",
  } as React.CSSProperties,
  footer: {
    background: "var(--cream-card)",
    borderTop: "1px solid var(--border-soft)",
    padding: "calc(var(--space-4) + var(--safe-bottom)) var(--space-4) var(--safe-bottom)",
    boxShadow: "0 -8px 30px rgba(59, 26, 110, 0.08)",
    display: "flex",
    justifyContent: "center",
  } as React.CSSProperties,
  footerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
  } as React.CSSProperties,
  footerSelection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,
  footerMark: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "var(--lavender)",
    border: "1px solid var(--purple-600)",
    color: "var(--purple-600)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  footerMarkSelected: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
  } as React.CSSProperties,
  footerSelectionCopy: { display: "flex", flexDirection: "column" } as React.CSSProperties,
  footerSelectionTitle: {
    fontWeight: 800,
    color: "var(--purple-800)",
  } as React.CSSProperties,
  footerNote: {
    fontSize: 13,
    color: "var(--ink)",
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
