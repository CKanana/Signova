import React, { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { Check, ChevronRight } from "lucide-react";

export function MessageSentScreen() {
  const { messages, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;
  const lastUserMessage = [...messages].reverse().find((m) => m.sender === "user");
  const messageText = lastUserMessage?.text ?? "";

  useEffect(() => {
    const timer = setTimeout(() => {
      goToStep("conversation");
    }, 2200);
    return () => clearTimeout(timer);
  }, [goToStep]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.iconCircle}>
          <Check size={44} color="var(--signova-success)" />
        </div>
        <h2 style={mergeStyles(styles.title, isLargeText && styles.titleLarge)}>Message sent</h2>
        <p style={mergeStyles(styles.body, isLargeText && styles.bodyLarge)}>“{messageText}”</p>
        <div style={styles.buttonContainer}>
          <TouchButton variant="primary" size="touch" fullWidth onPress={() => goToStep("conversation")} icon={<ChevronRight size={22} color="#FFFFFF" />}>
            View conversation
          </TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" } as React.CSSProperties,
  content: { textAlign: "center", maxWidth: 460, width: "100%" } as React.CSSProperties,
  iconCircle: { width: 80, height: 80, borderRadius: "50%", background: "rgba(27,117,72,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20" } as React.CSSProperties,
  title: { margin: "0 0 10px", fontSize: 24, fontWeight: 800, color: "var(--signova-text)" } as React.CSSProperties,
  titleLarge: { fontSize: 28 } as React.CSSProperties,
  body: { margin: "0 0 22px", fontSize: 18, color: "var(--signova-muted-text)" } as React.CSSProperties,
  bodyLarge: { fontSize: 22 } as React.CSSProperties,
  buttonContainer: { width: "100%" } as React.CSSProperties,
};
