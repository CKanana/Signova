import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { AlertTriangle, RotateCcw, Keyboard } from "lucide-react";

export function UncertainFallbackScreen() {
  const { currentDraft, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;
  const detectedText = currentDraft || "I need…";

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <p style={styles.eyebrow}>WE’RE NOT COMPLETELY SURE ABOUT THIS SIGN</p>
        <div style={styles.warningBanner}>
          <AlertTriangle size={22} color="#D97706" />
          <span style={styles.warningText}>Please check the message before sending to staff.</span>
        </div>
        <div style={styles.messageCard}>
          <span style={mergeStyles(styles.messageText, isLargeText && styles.messageTextLarge)}>“{detectedText}”</span>
        </div>
        <div style={styles.buttonStack}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => goToStep("live")} icon={<RotateCcw size={20} color="#FFFFFF" />}>
            Try signing again
          </TouchButton>
          <div style={styles.secondaryRow}>
            <TouchButton variant="outline" size="touch" style={styles.halfBtn} onPress={() => goToStep("text")} icon={<Keyboard size={20} color="var(--signova-text)" />}>
              Edit text
            </TouchButton>
            <TouchButton variant="ghost" size="touch" style={styles.halfBtn} onPress={() => goToStep("confirm")}>
              Continue anyway
            </TouchButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 460, width: "100%" } as React.CSSProperties,
  eyebrow: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, color: "var(--signova-text)", margin: "0 0 16px" } as React.CSSProperties,
  warningBanner: { display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, background: "#FDF3E3", border: "1px solid #E5C794", marginBottom: 18 } as React.CSSProperties,
  warningText: { fontSize: 14, color: "#8A5A00", margin: 0 } as React.CSSProperties,
  messageCard: { padding: 20, borderRadius: 20, background: "var(--signova-surface)", border: "1px solid var(--signova-border)", marginBottom: 20 } as React.CSSProperties,
  messageText: { fontSize: 26, fontWeight: 700, color: "var(--signova-text)", margin: 0, lineHeight: 1.4 } as React.CSSProperties,
  messageTextLarge: { fontSize: 32 } as React.CSSProperties,
  buttonStack: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
  secondaryRow: { display: "flex", gap: 8 } as React.CSSProperties,
  halfBtn: { flex: 1 } as React.CSSProperties,
};
