import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { AlertCircle, Check, RotateCcw } from "lucide-react";
import { USE_MODEL } from "../config";

export function ModelSelfTestScreen() {
  const { goBack, isRecognising, recogniseResult, recogniseError, recognitionBackend } = useSession();

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button aria-label="Back" onClick={() => goBack()} style={styles.backButton}>
          <span style={styles.backLabel}>←</span>
        </button>
        <h2 style={styles.title}>Model self-test</h2>
      </div>
      <div style={styles.content}>
        <div style={styles.card}>
          <p style={styles.q}>On-device ASL recognition</p>
          <p style={styles.a}>
            Backend: {USE_MODEL ? "LiteRT.js (browser)" : "Mock placeholder"}<br />
            Runtime status: {recognitionBackend === "model" ? "model loaded" : recognitionBackend === "mock" ? "mock (model disabled)" : "checking…"}
          </p>
          {recogniseResult && (
            <div style={styles.result}>
              <Check size={18} color="var(--signova-success)" />
              <span style={styles.resultText}>Test inference OK — {recogniseResult.timingMs.toFixed(0)} ms</span>
            </div>
          )}
          {recogniseError && (
            <div style={styles.error}>
              <AlertCircle size={18} color="var(--signova-danger)" />
              <span style={styles.errorText}>{recogniseError}</span>
            </div>
          )}
        </div>
        <div style={styles.actions}>
          <TouchButton variant="primary" size="touch" fullWidth disabled={isRecognising} onPress={() => {}} icon={<RotateCcw size={18} color="#FFFFFF" />}>
            Run self-test
          </TouchButton>
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
  result: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 } as React.CSSProperties,
  resultText: { fontSize: 14, color: "var(--signova-success)", fontWeight: 700, margin: 0 } as React.CSSProperties,
  error: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 } as React.CSSProperties,
  errorText: { fontSize: 14, color: "var(--signova-danger)", margin: 0 } as React.CSSProperties,
  actions: { width: "100%" } as React.CSSProperties,
};
