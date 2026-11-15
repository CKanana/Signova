import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { Camera, Shield } from "lucide-react";

export function CameraPermissionScreen() {
  const { goToStep, goBack } = useSession();
  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button aria-label="Back" onClick={() => goBack()} style={styles.backButton}>
          <span style={styles.backLabel}>←</span>
        </button>
        <h2 style={styles.title}>Camera permission</h2>
      </div>
      <div style={styles.content}>
        <div style={styles.iconBox}>
          <Camera size={48} color="var(--signova-primary)" />
        </div>
        <h3 style={styles.heading}>Camera access needed</h3>
        <p style={styles.body}>
          Signova needs the camera to recognise your signs. Everything is processed on your device — no
          video leaves your phone.
        </p>
        <div style={styles.actions}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => goToStep("live")} icon={<Shield size={18} color="#FFFFFF" />}>
            I understand — continue
          </TouchButton>
        </div>
        <p style={styles.hint}>
          If you blocked the camera, enable it in your browser settings (site permissions) and refresh.
        </p>
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
  content: { padding: 24, maxWidth: 520, margin: "0 auto", boxSizing: "border-box", textAlign: "center" } as React.CSSProperties,
  iconBox: { width: 72, height: 72, borderRadius: "50%", background: "rgba(91,42,134,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  heading: { margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  body: { margin: "0 0 24px", fontSize: 16, color: "var(--signova-muted-text)", lineHeight: 1.6 } as React.CSSProperties,
  actions: { width: "100%" } as React.CSSProperties,
  hint: { margin: "16px 0 0", fontSize: 13, color: "var(--signova-muted-text)" } as React.CSSProperties,
};
