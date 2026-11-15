import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { Check } from "lucide-react";

export function SessionCompleteScreen() {
  const { organisation, resetSession, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const handleNewConversation = () => {
    resetSession();
    goToStep("method");
  };
  const handleReturnHome = () => {
    resetSession();
    goToStep("welcome");
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconCircle}>
          <Check size={44} color="var(--signova-success)" />
        </div>
        <h2 style={mergeStyles(styles.title, isLargeText && styles.titleLarge)}>Communication complete</h2>
        <p style={mergeStyles(styles.body, isLargeText && styles.bodyLarge)}>
          Thank you for using {organisation?.name || "Kenyatta National Hospital"}’s communication service.
        </p>
        <div style={styles.privacyPill}>
          <span style={styles.privacyIcon}>🛡️</span>
          <span style={styles.privacyText}>Session data and camera memory have been wiped securely.</span>
        </div>
        <div style={styles.buttonStack}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={handleNewConversation}>Start new conversation</TouchButton>
          <TouchButton variant="outline" size="lg" fullWidth onPress={handleReturnHome}>Return home</TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 480, width: "100%" } as React.CSSProperties,
  iconCircle: { width: 80, height: 80, borderRadius: "50%", background: "rgba(27,117,72,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  title: { margin: "0 0 10px", fontSize: 24, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  titleLarge: { fontSize: 28 } as React.CSSProperties,
  body: { margin: "0 0 20px", fontSize: 17, color: "var(--signova-muted-text)", lineHeight: 1.6 } as React.CSSProperties,
  bodyLarge: { fontSize: 20 } as React.CSSProperties,
  privacyPill: { display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, background: "rgba(91,42,134,0.12)", border: "1px solid rgba(91,42,134,0.3)", marginBottom: 22 } as React.CSSProperties,
  privacyIcon: { fontSize: 16 } as React.CSSProperties,
  privacyText: { fontSize: 14, color: "var(--signova-primary)", fontWeight: 600 } as React.CSSProperties,
  buttonStack: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
};
