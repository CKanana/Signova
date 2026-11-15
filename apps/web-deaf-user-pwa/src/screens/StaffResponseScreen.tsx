import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { User, Send, ArrowLeft } from "lucide-react";

export function StaffResponseScreen() {
  const { messages, goToStep } = useSession();
  const lastStaff = [...messages].reverse().find((m) => m.sender === "staff");
  const text = lastStaff?.text ?? "No response yet.";

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <button aria-label="Back" onClick={() => goToStep("conversation")} style={styles.backButton}>
            <ArrowLeft size={20} color="var(--signova-text)" />
          </button>
          <div style={styles.staffBadge}>
            <User size={20} color="var(--signova-primary)" />
            <span style={styles.staffLabel}>Staff response</span>
          </div>
        </div>
        <div style={styles.messageCard}>
          <span style={styles.messageText}>{text}</span>
        </div>
        <div style={styles.actions}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => goToStep("conversation")} icon={<Send size={18} color="#FFFFFF" />}>
            Reply
          </TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)" } as React.CSSProperties,
  content: { padding: 20, maxWidth: 560, margin: "0 auto", boxSizing: "border-box", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } as React.CSSProperties,
  backButton: { background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "inherit" } as React.CSSProperties,
  staffBadge: { display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  staffLabel: { fontSize: 16, fontWeight: 700, color: "var(--signova-text)" } as React.CSSProperties,
  messageCard: { padding: 20, borderRadius: 20, background: "var(--signova-surface)", border: "1px solid var(--signova-border)", marginBottom: 18 } as React.CSSProperties,
  messageText: { fontSize: 20, color: "var(--signova-text)", lineHeight: 1.6, margin: 0 } as React.CSSProperties,
  actions: { width: "100%" } as React.CSSProperties,
};
