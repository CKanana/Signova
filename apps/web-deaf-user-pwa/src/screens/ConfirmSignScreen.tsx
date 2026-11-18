import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
import { useLiveSigning } from "../context/LiveSigningContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { Send, RotateCcw, Keyboard, AlertCircle } from "lucide-react";

export function ConfirmSignScreen() {
  const {
    currentDraft,
    confirmAndSend,
    goToStep,
    goBack,
    error,
    confidence,
    accessibility,
    recognitionBackend,
  } = useSession();
  const { liveSigns, setPendingDraft, resetLiveSigning } = useLiveSigning();
  const isLargeText = accessibility?.largeText ?? false;

  const [text, setText] = useState(currentDraft);
  const [sending, setSending] = useState<boolean>(false);

  useEffect(() => setText(currentDraft), [currentDraft]);

  const lastSign = liveSigns[liveSigns.length - 1];

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await confirmAndSend(text);
    } catch {
      setSending(false);
    }
  }, [text, sending, confirmAndSend]);

  const handleContinue = useCallback(() => {
    setPendingDraft(text);
    goBack();
  }, [text, setPendingDraft]);

  const handleTryAgain = useCallback(() => {
    setPendingDraft(null);
    resetLiveSigning();
    goToStep("live");
  }, [resetLiveSigning, setPendingDraft]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !sending) {
      e.preventDefault();
      void handleSend();
    }
  };

  const confidencePercent = lastSign ? Math.round(lastSign.confidence * 100) : Math.round((confidence || 0) * 100);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <p style={styles.eyebrow}>Review your message</p>
        <h2 style={styles.title}>Confirm and send</h2>
        <p style={styles.subtitle}>
          Check the recognised text below. You can edit it before it goes to the staff member.
        </p>

        <div style={styles.messageCard}>
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Your message…"
            rows={4}
            style={mergeStyles(styles.messageText, isLargeText && styles.messageTextLarge)}
            aria-label="Recognised message — edit before sending"
            spellCheck
          />
        </div>

        <div style={styles.chipsBlock}>
          <span style={styles.chipsLabel}>Recognised signs</span>
          <div style={styles.chipRow}>
            {liveSigns.length === 0 ? (
              <span style={styles.chipEmpty}>None</span>
            ) : (
              liveSigns.map((s) => (
                <span
                  key={`${s.sign}-${s.ts}`}
                  style={mergeStyles(styles.chip, s === lastSign ? styles.chipActive : {})}
                  title={`${s.sign} (${Math.round(s.confidence * 100)}%)`}
                >
                  {s.sign}
                </span>
              ))
            )}
          </div>
        </div>

        <div style={styles.confidencePill}>
          <span style={styles.confidenceLabel}>Confidence</span>
          <span style={styles.confidenceValue}>{confidencePercent}%</span>
          {recognitionBackend !== "model" && (
            <span style={styles.confidenceNote}>on-device model unavailable — recognition limited</span>
          )}
        </div>

        {error && (
          <div style={styles.errorBanner} role="alert" aria-live="assertive">
            <AlertCircle size={16} color="var(--danger-text)" />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}
        <div style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            loading={sending}
            disabled={!text.trim() || sending}
            onPress={handleSend}
            icon={<Send size={22} color="#FFFFFF" />}
          >
            Confirm and send
          </TouchButton>
          <div style={styles.secondaryRow}>
            <TouchButton
              variant="outline"
              size="touch"
              style={styles.halfBtn}
              onPress={handleContinue}
              icon={<RotateCcw size={20} color="var(--signova-text)" />}
            >
              Continue signing
            </TouchButton>
            <TouchButton
              variant="outline"
              size="touch"
              style={styles.halfBtn}
              onPress={handleTryAgain}
              icon={<Keyboard size={22} color="var(--signova-text)" />}
            >
              Try again
            </TouchButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    width: "100%",
    background: "var(--signova-background)",
    fontFamily: "var(--signova-font-family)",
    color: "var(--signova-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "calc(var(--space-4) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 460, width: "100%" } as React.CSSProperties,
  eyebrow: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, color: "var(--signova-primary)", margin: "0 0 12px" } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 800, color: "var(--signova-text-strong)", margin: "0 0 8px" } as React.CSSProperties,
  subtitle: { fontSize: 15, color: "var(--signova-muted-text)", margin: "0 0 22px", lineHeight: 1.6 } as React.CSSProperties,
  messageCard: {
    padding: 18,
    borderRadius: 16,
    background: "var(--signova-surface)",
    border: "1px solid var(--signova-border)",
    marginBottom: 16,
    textAlign: "left",
  } as React.CSSProperties,
  messageText: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--signova-text)",
    margin: 0,
    lineHeight: 1.5,
    width: "100%",
    minHeight: 110,
    resize: "vertical",
    fontFamily: "inherit",
    padding: "12px 14px",
    border: "1px solid var(--signova-border)",
    borderRadius: 12,
    background: "var(--signova-background)",
  } as React.CSSProperties,
  messageTextLarge: { fontSize: 26 } as React.CSSProperties,
  chipsBlock: {
    marginBottom: 16,
    textAlign: "left",
  } as React.CSSProperties,
  chipsLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "var(--text-2)",
    display: "block",
    marginBottom: 6,
  } as React.CSSProperties,
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  } as React.CSSProperties,
  chip: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 12px",
    borderRadius: "var(--radius-pill)",
    border: "2px solid var(--border-soft)",
    background: "var(--cream-card)",
    color: "var(--ink)",
    flexShrink: 0,
  } as React.CSSProperties,
  chipActive: {
    background: "var(--purple-600)",
    borderColor: "var(--purple-600)",
    color: "#FFFFFF",
  } as React.CSSProperties,
  chipEmpty: { fontSize: 12, color: "var(--text-2)" } as React.CSSProperties,
  confidencePill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
    padding: "8px 14px",
    borderRadius: "var(--radius-pill)",
    background: "var(--lavender)",
    border: "1px solid var(--border-soft)",
    width: "fit-content",
    marginLeft: "auto",
    marginRight: "auto",
  } as React.CSSProperties,
  confidenceLabel: { fontSize: 13, color: "var(--signova-muted-text)", fontWeight: 700 } as React.CSSProperties,
  confidenceValue: { fontSize: 15, fontWeight: 800, color: "var(--signova-success)" } as React.CSSProperties,
  confidenceNote: { fontSize: 12, color: "var(--text-2)", fontWeight: 600 } as React.CSSProperties,
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-bg)",
    color: "var(--danger-text)",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  } as React.CSSProperties,
  errorText: { margin: 0 } as React.CSSProperties,
  buttonStack: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
  secondaryRow: { display: "flex", gap: 8 } as React.CSSProperties,
  halfBtn: { flex: 1 } as React.CSSProperties,
} as const;
