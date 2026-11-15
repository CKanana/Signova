import React, { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";

export function SplashScreen() {
  const { goToStep } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      goToStep("welcome");
    }, 1200);
    return () => clearTimeout(timer);
  }, [goToStep]);

  return (
    <div style={styles.container}>
      <div style={styles.iconBox}>
        <img src="/assets/signova-app-icon.png" alt="Signova" style={styles.iconImage} />
      </div>
      <h1 style={styles.title}>Signova</h1>
      <p style={styles.tagline}>Communication without barriers.</p>
      <div style={styles.dots}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              ...styles.dot,
              ...(mounted ? styles.dotAnim : {}),
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "var(--signova-primary)",
    color: "var(--signova-on-primary)",
    fontFamily: "var(--signova-font-family)",
    textAlign: "center",
  } as React.CSSProperties,
  iconBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: 24,
    background: "var(--signova-on-primary)",
    marginBottom: 20,
    animation: "sn-bounce 2s ease-in-out infinite",
  } as React.CSSProperties,
  iconImage: { width: 56, height: 56, objectFit: "contain" } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: 0.5,
  } as React.CSSProperties,
  tagline: {
    margin: "8px 0 0",
    fontSize: 16,
    opacity: 0.9,
  } as React.CSSProperties,
  dots: { display: "flex", gap: 8, marginTop: 28 } as React.CSSProperties,
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.55)",
    animation: "sn-dot 1.4s ease-in-out infinite both",
  } as React.CSSProperties,
  dotAnim: {
    opacity: 0.2,
  } as React.CSSProperties,
};
