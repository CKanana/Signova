import React from "react";
import { useSession } from "../context/SessionContext";

export function HelpScreen() {
  const { goBack } = useSession();
  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button aria-label="Back" onClick={() => goBack()} style={styles.backButton}>
          <span style={styles.backLabel}>←</span>
        </button>
        <h2 style={styles.title}>Help &amp; guidance</h2>
      </div>
      <div style={styles.content}>
        <div style={styles.card}>
          <p style={styles.q}>How does Signova work?</p>
          <p style={styles.a}>
            Sign into the camera, choose sign language or text, and communicate with a staff member in real
            time. Your signs are recognised on your device and shown to you for review before sending.
          </p>
        </div>
        <div style={styles.card}>
          <p style={styles.q}>Is my video stored?</p>
          <p style={styles.a}>
            No. Landmarks are processed on-device and session data is cleared when you end the session.
          </p>
        </div>
        <div style={styles.card}>
          <p style={styles.q}>What if recognition is unsure?</p>
          <p style={styles.a}>
            You can retry signing, switch to text, or confirm and send anyway.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)" } as React.CSSProperties,
  topBar: { display: "flex", alignItems: "center", gap: 10, padding: 16, borderBottom: "1px solid var(--signova-border)" } as React.CSSProperties,
  backButton: { background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "inherit", fontSize: 18 } as React.CSSProperties,
  backLabel: { color: "var(--signova-muted-text)" } as React.CSSProperties,
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: "var(--signova-text)", flex: 1 } as React.CSSProperties,
  content: { padding: 20, maxWidth: 560, margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 } as React.CSSProperties,
  card: { padding: 16, borderRadius: 16, background: "var(--signova-surface)", border: "1px solid var(--signova-border)" } as React.CSSProperties,
  q: { margin: "0 0 6px", fontWeight: 700, color: "var(--signova-primary)" } as React.CSSProperties,
  a: { margin: 0, fontSize: 15, color: "var(--signova-text)", lineHeight: 1.6 } as React.CSSProperties,
};
