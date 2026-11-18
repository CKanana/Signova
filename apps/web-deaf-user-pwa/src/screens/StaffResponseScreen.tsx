import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { ArrowLeft, Send } from "lucide-react";

export function StaffResponseScreen() {
  const { messages, goToStep } = useSession();
  const lastStaff = [...messages].reverse().find((m) => m.sender === "staff");
  const text = lastStaff?.text ?? "No response yet.";

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          type="button"
          aria-label="Back"
          onClick={() => goToStep("conversation")}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </button>
        <div style={styles.staffBadge}>
          <span style={styles.staffBadge}>Staff response</span>
        </div>
        <div style={styles.headerSpacer} />
      </header>
      <main style={styles.content}>
        <div style={styles.messageCard}>
          <span style={styles.messageText}>{text}</span>
        </div>
        <div style={styles.actions}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={() => goToStep("live")}
            icon={<Send size={18} color="#FFFFFF" />}
          >
            Reply
          </TouchButton>
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
    flexShrink: 0,
  } as React.CSSProperties,
  backButton: {
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
    flexShrink: 0,
  } as React.CSSProperties,
  staffBadge: {
    fontSize: 16,
    fontWeight: 700,
    color: "#FFFFFF",
  } as React.CSSProperties,
  headerSpacer: { flex: 1 } as React.CSSProperties,
  content: {
    flex: 1,
    minHeight: 0,
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  } as React.CSSProperties,
  messageCard: {
    padding: 20,
    borderRadius: "var(--radius-card)",
    background: "var(--cream-card)",
    border: "1px solid var(--border-soft)",
    marginBottom: 18,
    boxShadow: "var(--shadow)",
  } as React.CSSProperties,
  messageText: {
    fontSize: 20,
    color: "var(--ink)",
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  actions: {
    width: "100%",
    maxWidth: 420,
  } as React.CSSProperties,
};
