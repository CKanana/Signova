import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { Loader2 } from "lucide-react";

export function TranslatingScreen() {
  const { goToStep, requestTranslation, isTranslating, error, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  useEffect(() => {
    void requestTranslation();
  }, [requestTranslation]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconCircle}>
          <Loader2 size={44} color="var(--signova-primary)" style={{ animation: "sn-spin 0.8s linear infinite" }} />
        </div>
        <h2 style={mergeStyles(styles.title, isLargeText && styles.titleLarge)}>Translating your sign…</h2>
        <p style={mergeStyles(styles.body, isLargeText && styles.bodyLarge)}>Keep your hands still for a moment.</p>
        <div style={styles.progressTrack}>
          {isTranslating && <div style={styles.progressPulse} />}
        </div>
        {error && !isTranslating && (
          <div style={styles.errorWrap}>
            <span style={styles.errorText}>{error}</span>
            <TouchButton variant="outline" size="md" onPress={() => void requestTranslation()}>Try again</TouchButton>
          </div>
        )}
        {!isTranslating && !error && (
          <TouchButton variant="primary" size="lg" fullWidth onPress={() => goToStep("confirm")} icon={<span style={styles.checkIcon}>✓</span>}>
            Translation complete
          </TouchButton>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 420, width: "100%" } as React.CSSProperties,
  iconCircle: { width: 80, height: 80, borderRadius: "50%", background: "rgba(91,42,134,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  title: { margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  titleLarge: { fontSize: 26 } as React.CSSProperties,
  body: { margin: "0 0 22px", fontSize: 16, color: "var(--signova-muted-text)" } as React.CSSProperties,
  bodyLarge: { fontSize: 19 } as React.CSSProperties,
  progressTrack: { height: 8, background: "rgba(91,42,134,0.15)", borderRadius: 4, overflow: "hidden", marginBottom: 26 } as React.CSSProperties,
  progressPulse: { height: "100%", width: "0%", background: "var(--signova-primary)", animation: "sn-progress 1.4s ease-in-out infinite" } as React.CSSProperties,
  errorWrap: { margin: "14px 0 0", textAlign: "center" } as React.CSSProperties,
  errorText: { fontSize: 14, color: "var(--signova-danger)", display: "block", marginBottom: 8 } as React.CSSProperties,
  checkIcon: { marginRight: 6 } as React.CSSProperties,
};
