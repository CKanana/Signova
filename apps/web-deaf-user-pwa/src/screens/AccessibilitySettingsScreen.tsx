import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { Type, Shield, Smartphone, Monitor } from "lucide-react";

export function AccessibilitySettingsScreen() {
  const { goBack, accessibility, updateAccessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;
  const isDataSaver = accessibility?.dataSaver ?? false;

  const toggleDataSaver = () => {
    updateAccessibility({ dataSaver: !isDataSaver });
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button aria-label="Back" onClick={() => goBack()} style={styles.backButton}>
          <span style={styles.backLabel}>←</span>
        </button>
        <h2 style={styles.title}>Accessibility</h2>
      </div>
      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.rowLabel}>
              <Type size={20} color="var(--signova-primary)" />
              <span>Larger text</span>
            </div>
            <TouchButton variant={isLargeText ? "primary" : "outline"} size="md" onPress={() => {}} style={styles.toggle}>
              {isLargeText ? "On" : "Off"}
            </TouchButton>
          </div>
          <p style={styles.rowHint}>Increases text size across the app.</p>
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.rowLabel}>
              <Monitor size={20} color="var(--signova-primary)" />
              <span>Data-saver for animations</span>
            </div>
            <TouchButton variant={isDataSaver ? "primary" : "outline"} size="md" onPress={toggleDataSaver} style={styles.toggle}>
              {isDataSaver ? "On" : "Off"}
            </TouchButton>
          </div>
          <p style={styles.rowHint}>When on, animations wait for you to tap "Play animation" instead of loading automatically.</p>
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.rowLabel}>
              <Shield size={20} color="var(--signova-primary)" />
              <span>Visual alerts</span>
            </div>
            <span style={styles.chip}>On</span>
          </div>
          <p style={styles.rowHint}>Important events are shown visually as well as in text.</p>
        </div>
        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.rowLabel}>
              <Smartphone size={20} color="var(--signova-primary)" />
              <span>Camera permission</span>
            </div>
            <TouchButton variant="outline" size="md" onPress={() => {}}>Manage</TouchButton>
          </div>
          <p style={styles.rowHint}>Required to sign into the camera.</p>
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
  content: { padding: 20, maxWidth: 560, margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 } as React.CSSProperties,
  card: { padding: 16, borderRadius: 16, background: "var(--signova-surface)", border: "1px solid var(--signova-border)" } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 } as React.CSSProperties,
  rowLabel: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  rowHint: { margin: "6px 0 0", fontSize: 13, color: "var(--signova-muted-text)" } as React.CSSProperties,
  toggle: { minWidth: 52 } as React.CSSProperties,
  chip: { padding: "2px 8px", borderRadius: 9999, fontSize: 12, fontWeight: 700, color: "var(--signova-success)", background: "rgba(27,117,72,0.12)" } as React.CSSProperties,
};
