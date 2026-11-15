import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineScreen() {
  const { goToStep } = useSession();
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconBox}>
          <WifiOff size={48} color="var(--signova-muted-text)" />
        </div>
        <h2 style={styles.title}>You're offline</h2>
        <p style={styles.body}>
          Sign recognition still works on your device, but sending and receiving messages needs an
          internet connection.
        </p>
        <div style={styles.actions}>
          <TouchButton variant="outline" size="md" onPress={() => goToStep("welcome")} icon={<RefreshCw size={18} color="var(--signova-primary)" />}>
            Try reconnecting
          </TouchButton>
          <TouchButton variant="ghost" size="touch" onPress={() => goToStep("welcome")}>Return home</TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 460, width: "100%" } as React.CSSProperties,
  iconBox: { width: 80, height: 80, borderRadius: "50%", background: "rgba(104,99,107,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  title: { margin: "0 0 10px", fontSize: 24, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  body: { margin: "0 0 22px", fontSize: 16, color: "var(--signova-muted-text)", lineHeight: 1.6 } as React.CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
};
