import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { Send, RotateCcw, Keyboard } from "lucide-react";

export function ConfirmSignScreen() {
  const { currentDraft, confirmAndSend, goToStep, accessibility, confidence } = useSession();
  const isLargeText = accessibility?.largeText ?? false;
  const messageText = currentDraft;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <p style={styles.eyebrow}>WE UNDERSTOOD:</p>
        <div style={styles.messageCard}>
          <span style={mergeStyles(styles.messageText, isLargeText && styles.messageTextLarge)}>“{messageText}”</span>
        </div>
        <div style={styles.confidencePill}>
          <span style={styles.confidenceLabel}>Confidence</span>
          <span style={styles.confidenceValue}>{(Math.round((confidence || 0) * 100))}%</span>
        </div>
        <div style={styles.buttonStack}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => void confirmAndSend(messageText)} icon={<Send size={22} color="#FFFFFF" />}>
            Send message
          </TouchButton>
          <div style={styles.secondaryRow}>
            <TouchButton variant="outline" size="touch" style={styles.halfBtn} onPress={() => goToStep("live")} icon={<RotateCcw size={20} color="var(--signova-text)" />}>
              Try again
            </TouchButton>
            <TouchButton variant="ghost" size="touch" style={styles.halfBtn} onPress={() => goToStep("text")} icon={<Keyboard size={22} color="var(--signova-text)" />}>
              Edit text
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
  eyebrow: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, color: "var(--signova-primary)", margin: "0 0 18px" } as React.CSSProperties,
  messageCard: { padding: 22, borderRadius: 20, background: "var(--signova-surface)", border: "1px solid var(--signova-border)", marginBottom: 18 } as React.CSSProperties,
  messageText: { fontSize: 26, fontWeight: 700, color: "var(--signova-text)", margin: 0, lineHeight: 1.4 } as React.CSSProperties,
  messageTextLarge: { fontSize: 32 } as React.CSSProperties,
  confidencePill: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 } as React.CSSProperties,
  confidenceLabel: { fontSize: 13, color: "var(--signova-muted-text)", fontWeight: 700 } as React.CSSProperties,
  confidenceValue: { fontSize: 15, fontWeight: 800, color: "var(--signova-success)" } as React.CSSProperties,
  buttonStack: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
  secondaryRow: { display: "flex", gap: 8 } as React.CSSProperties,
  halfBtn: { flex: 1 } as React.CSSProperties,
};
