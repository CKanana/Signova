import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { Play } from "lucide-react";

export function ReadyToSignScreen() {
  const { goToStep } = useSession();
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconCircle}>
          <Play size={44} color="var(--signova-primary)" />
        </div>
        <h2 style={styles.title}>Ready to sign</h2>
        <p style={styles.body}>
          Position yourself so both hands are visible in the frame, then press start. You can review and
          confirm every sign before it’s sent to staff.
        </p>
        <div style={styles.actions}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => goToStep("live")} icon={<Play size={22} color="#FFFFFF" />}>
            Start signing
          </TouchButton>
          <TouchButton variant="outline" size="md" onPress={() => goToStep("method")}>Back to method</TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 460, width: "100%" } as React.CSSProperties,
  iconCircle: { width: 80, height: 80, borderRadius: "50%", background: "rgba(91,42,134,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  title: { margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  body: { margin: "0 0 22px", fontSize: 16, color: "var(--signova-muted-text)", lineHeight: 1.6 } as React.CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
};
