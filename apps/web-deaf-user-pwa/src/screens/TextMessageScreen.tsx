import React, { useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { Edit2, Send } from "lucide-react";

export function TextMessageScreen() {
  const { goToStep, confirmAndSend } = useSession();
  const [text, setText] = useState("");

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <button aria-label="Back" onClick={() => goToStep("method")} style={styles.backButton}>
            <span style={styles.backLabel}>←</span>
          </button>
          <h2 style={styles.title}>Type your message</h2>
        </div>
        <div style={styles.card}>
          <label style={styles.label}>Message</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type what you would like to say…"
            style={styles.textarea}
          />
        </div>
        <p style={styles.hint}>Your message will be sent to the staff member exactly as written.</p>
        <div style={styles.actions}>
          <TouchButton variant="outline" size="md" onPress={() => goToStep("method")} icon={<Edit2 size={18} color="var(--signova-text)" />}>
            Cancel
          </TouchButton>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => void confirmAndSend(text)} icon={            <Send size={18} color="#FFFFFF" />}>
            Send message
          </TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)" } as React.CSSProperties,
  content: { padding: 24, maxWidth: 520, margin: "0 auto", boxSizing: "border-box", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } as React.CSSProperties,
  backButton: { background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "inherit", fontSize: 18, lineHeight: 1 } as React.CSSProperties,
  backLabel: { color: "var(--signova-muted-text)" } as React.CSSProperties,
  title: { margin: 0, fontSize: 24, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  card: { padding: 22, borderRadius: 20, background: "var(--signova-surface)", border: "1px solid var(--signova-border)", marginBottom: 18 } as React.CSSProperties,
  label: { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--signova-muted-text)", letterSpacing: 0.6 } as React.CSSProperties,
  textarea: { width: "100%", minHeight: 140, padding: 12, borderRadius: 12, border: "1px solid var(--signova-border)", background: "var(--signova-background)", color: "var(--signova-text)", fontFamily: "inherit", fontSize: 16, resize: "vertical" } as React.CSSProperties,
  hint: { margin: 0, fontSize: 14, color: "var(--signova-muted-text)" } as React.CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
};
