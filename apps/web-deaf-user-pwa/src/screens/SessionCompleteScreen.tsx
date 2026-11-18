import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { Check, ArrowRight } from "lucide-react";

export function SessionCompleteScreen() {
  const {
    organisation,
    resetSession,
    goToStep,
    accessibility,
    endedByStaffWhileWaiting,
  } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const handleNewConversation = () => {
    resetSession();
    goToStep("method");
  };
  const handleReturnHome = () => {
    resetSession();
    goToStep("welcome");
  };

  const isRejected = endedByStaffWhileWaiting;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={mergeStyles(styles.iconCircle, isRejected ? styles.iconCircleRejected : undefined)}>
          {isRejected ? (
            <ArrowRight size={44} color="#FFFFFF" />
          ) : (
            <Check size={44} color="#FFFFFF" />
          )}
        </div>
        <h2 style={mergeStyles(styles.title, isLargeText ? styles.titleLarge : undefined)}>
          {isRejected ? "Session ended" : "Communication complete"}
        </h2>
        <p style={mergeStyles(styles.body, isLargeText ? styles.bodyLarge : undefined)}>
          {isRejected
            ? `The staff member ended the session before accepting. Please choose another teller or return home.`
            : `Thank you for using ${organisation?.name || "Kenyatta National Hospital"}’s communication service.`}
        </p>
        {isRejected ? (
          <>
            <div style={styles.buttonStack}>
              <TouchButton
                variant="primary"
                size="touch"
                fullWidth
                onPress={handleNewConversation}
                icon={<ArrowRight size={22} color="#FFFFFF" />}
              >
                Choose another teller
              </TouchButton>
              <TouchButton
                variant="outline"
                size="lg"
                fullWidth
                onPress={handleReturnHome}
              >
                Return home
              </TouchButton>
            </div>
          </>
        ) : (
          <>
            <div style={styles.privacyPill}>
              <span style={styles.privacyIcon}>🛡️</span>
              <span style={styles.privacyText}>
                Session data and camera memory have been wiped securely.
              </span>
            </div>
            <div style={styles.buttonStack}>
              <TouchButton variant="primary" size="touch" fullWidth onPress={handleNewConversation}>
                Start new conversation
              </TouchButton>
              <TouchButton variant="outline" size="lg" fullWidth onPress={handleReturnHome}>
                Return home
              </TouchButton>
            </div>
          </>
        )}
      </div>
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
    alignItems: "center",
    justifyContent: "center",
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  content: {
    textAlign: "center",
    maxWidth: 480,
    width: "100%",
  } as React.CSSProperties,
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "var(--purple-600)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20",
    boxShadow: "var(--shadow)",
  } as React.CSSProperties,
  iconCircleRejected: {
    background: "var(--danger-bg)",
  } as React.CSSProperties,
  title: {
    margin: "0 0 10px",
    fontSize: 24,
    fontWeight: 800,
    color: "var(--purple-800)",
  } as React.CSSProperties,
  titleLarge: { fontSize: 28 } as React.CSSProperties,
  body: {
    margin: "0 0 20px",
    fontSize: 17,
    color: "var(--text-2)",
    lineHeight: 1.6,
  } as React.CSSProperties,
  bodyLarge: { fontSize: 20 } as React.CSSProperties,
  privacyPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    background: "var(--lavender)",
    border: "1px solid var(--border-soft)",
    marginBottom: 22,
  } as React.CSSProperties,
  privacyIcon: { fontSize: 16 } as React.CSSProperties,
  privacyText: {
    fontSize: 14,
    color: "var(--purple-800)",
    fontWeight: 600,
  } as React.CSSProperties,
  buttonStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
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
