import React, { useEffect, useState, useCallback } from "react";
import { SessionProvider, useSession } from "./context/SessionContext";
import {
  SplashScreen,
  WelcomeScreen,
  MethodSelectScreen,
  TellerSelectionScreen,
  TextMessageScreen,
  ConnectingScreen,
  CameraPermissionScreen,
  ReadyToSignScreen,
  LiveSigningScreen,
  TranslatingScreen,
  ConfirmSignScreen,
  UncertainFallbackScreen,
  MessageSentScreen,
  ConversationScreen,
  StaffResponseScreen,
  SessionCompleteScreen,
  AccessibilitySettingsScreen,
  HelpScreen,
  OfflineScreen,
  WaitingScreen,
} from "./screens";
import { TouchButton } from "./components/ui/TouchButton";

function AppShell() {
  const { step } = useSession();
  const [isOnline, _isOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [manualInstructionsVisible, setManualInstructionsVisible] = useState(false);

  // Installed state: true only when the PWA is running as a standalone
  // application (display-mode: standalone, or iOS Safari web-app-mode), OR
  // when a prior install was confirmed via `appinstalled`.
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      (localStorage.getItem("signova-installed") === "1");
  });

  // Re-evaluate installed state whenever the page becomes visible or
  // visibility/standalone conditions change, so a fresh install is always
  // possible after uninstalling.
  useEffect(() => {
    const checkInstalled = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const installed = standalone || ((navigator as Navigator & { standalone?: boolean }).standalone === true);
      // Prefer `appinstalled` results; if the app was previously confirmed
      // installed via our own flag, keep it until we get a removal signal.
      const previouslyInstalled = localStorage.getItem("signova-installed") === "1";
      setIsInstalled(installed || previouslyInstalled);
    };

    checkInstalled();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInstalled();
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem("signova-installed", "1");
      setManualInstructionsVisible(false);
      setDeferredPrompt(null);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Native prompt is now available: show the install banner.
      setManualInstructionsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("load", checkInstalled);

    // Ensure re-evaluation on every visibility change (uninstall cleared the
    // flag, then the page becomes visible again).
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;
    // Only call prompt() after the user explicitly clicks Install.
    if ((deferredPrompt as any).prompt) {
      await (deferredPrompt as any).prompt();
      const choice = (deferredPrompt as any).userChoice;
      await choice;
      if (choice === "accepted") {
        setDeferredPrompt(null);
        setIsInstalled(true);
        localStorage.setItem("signova-installed", "1");
        setManualInstructionsVisible(false);
      } else {
        // Dismissed: do NOT hide our own install option.
        setManualInstructionsVisible(true);
      }
    }
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setManualInstructionsVisible(false);
  }, []);

  useEffect(() => {
    // Native prompt unavailable: keep the Install button visible and surface
    // browser-specific installation instructions.
    setManualInstructionsVisible(true);
  }, []);

  const renderScreen = (step: string) => {
    switch (step) {
      case "splash": return <SplashScreen />;
      case "welcome": return <WelcomeScreen />;
      case "method": return <MethodSelectScreen />;
      case "tellers": return <TellerSelectionScreen />;
      case "text": return <TextMessageScreen />;
      case "connecting": return <ConnectingScreen />;
      case "permission": return <CameraPermissionScreen />;
      case "ready": return <ReadyToSignScreen />;
      case "live": return <LiveSigningScreen />;
      case "translating": return <TranslatingScreen />;
      case "confirm": return <ConfirmSignScreen />;
      case "uncertain": return <UncertainFallbackScreen />;
      case "sent": return <MessageSentScreen />;
      case "conversation": return <ConversationScreen />;
      case "response": return <StaffResponseScreen />;
      case "complete": return <SessionCompleteScreen />;
      case "waiting": return <WaitingScreen />;
      case "settings": return <AccessibilitySettingsScreen />;
      case "help": return <HelpScreen />;
      case "offline": return <OfflineScreen />;
      default: return <WelcomeScreen />;
    }
  };

  return (
    <div className="sn-app">
      {/* Always-visible install option when the app is NOT installed. */}
      {!isInstalled && (
        <div style={styles.installBanner}>
          <span style={styles.installText}>Install Signova as an app?</span>
          <TouchButton variant="primary" size="sm" onPress={installApp}>
            Install
          </TouchButton>
          {manualInstructionsVisible && (
            <button
              type="button"
              style={styles.manualHint}
              onClick={dismissInstallBanner}
              aria-label="Dismiss installation instructions"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineText}>You're offline — sign recognition still works; messaging needs a connection.</span>
        </div>
      )}
      <div style={styles.screenArea}>{renderScreen(step)}</div>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

const styles = {
  installBanner: {
    position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)",
    zIndex: 1000, display: "flex", alignItems: "center", gap: 8,
    padding: "8px 14px", borderRadius: 12, background: "var(--signova-primary)",
    color: "#FFFFFF", boxShadow: "0 4px 12px rgba(0,0,0,0.25)", fontSize: 14,
  } as React.CSSProperties,
  installText: { fontSize: 13, fontWeight: 600 } as React.CSSProperties,
  manualHint: {
    fontSize: 12, fontWeight: 400, color: "#FFFFFF", background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "2px 8px", cursor: "pointer",
  } as React.CSSProperties,
  offlineBanner: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
    padding: "6px 16px", background: "rgba(104,99,107,0.9)", color: "#FFFFFF",
    fontSize: 13, textAlign: "center", fontWeight: 600,
  } as React.CSSProperties,
  offlineText: { margin: 0 } as React.CSSProperties,
  screenArea: { minHeight: "100vh", width: "100%" } as React.CSSProperties,
};
