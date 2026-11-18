import React, { useEffect, useState, useCallback, useRef } from "react";
import { SessionProvider, useSession } from "./context/SessionContext";
import { ReplyRouterProvider } from "./context/ReplyRouterContext";

// Step → URL path mapping so every page has its own URL for debugging.
const STEP_PATHS: Record<string, string> = {
  splash: "/",
  welcome: "/welcome",
  method: "/method",
  tellers: "/tellers",
  text: "/text",
  connecting: "/connecting",
  permission: "/permission",
  ready: "/ready",
  live: "/live",
  translating: "/translating",
  confirm: "/confirm",
  uncertain: "/uncertain",
  sent: "/sent",
  conversation: "/conversation",
  response: "/response",
  complete: "/complete",
  waiting: "/waiting",
  settings: "/settings",
  help: "/help",
  offline: "/offline",
};

const PATH_STEPS: Record<string, string> = {};
Object.entries(STEP_PATHS).forEach(([step, path]) => {
  PATH_STEPS[path] = step;
});
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
  const { goToStep } = useSession();
  const [isOnline, _isOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [manualInstructionsVisible, setManualInstructionsVisible] = useState(false);
  const [installBannerVisible, setInstallBannerVisible] = useState(false);

  // Installed state: true only when the PWA is running as a standalone
  // application (display-mode: standalone, or iOS Safari web-app-mode), OR
  // when a prior install was confirmed via `appinstalled`.
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      (localStorage.getItem("signova-installed") === "1");
  });

  // Detect iOS Safari for Add to Home Screen instructions.
  const isIOS = typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.platform);
  const isIOSStandalone = typeof window !== "undefined" && (navigator as Navigator & { standalone?: boolean }).standalone === true;

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
      if (installed || previouslyInstalled) {
        setInstallBannerVisible(false);
        setManualInstructionsVisible(false);
      }
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
      setInstallBannerVisible(false);
      setManualInstructionsVisible(false);
      setDeferredPrompt(null);
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Native prompt is now available: show the install banner.
      setInstallBannerVisible(true);
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

  // ---- URL routing: keep step in sync with the browser URL ----
  const isPopStateRef = useRef(false);

  // When step changes, update the URL.
  useEffect(() => {
    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }
    const path = STEP_PATHS[step];
    if (path && window.location.pathname !== path) {
      window.history.pushState({ step }, "", path);
    }
  }, [step]);

  // When the user navigates (back/forward or direct URL), update the step.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const stepFromState = (e.state as { step?: string })?.step;
      const path = window.location.pathname;
      const targetStep = stepFromState ?? PATH_STEPS[path];
      if (targetStep && targetStep !== step) {
        isPopStateRef.current = true;
        goToStep(targetStep as any);
      }
    };
    window.addEventListener("popstate", onPopState);

    // Initialise step from the URL on first load (e.g. opening /waiting
    // directly). Browsers do not fire popstate here, so we read the URL.
    const initialTargetStep = PATH_STEPS[window.location.pathname];
    if (initialTargetStep && initialTargetStep !== step) {
      goToStep(initialTargetStep as any);
    }

    return () => window.removeEventListener("popstate", onPopState);
  }, [step, goToStep]);

  const installApp = useCallback(async () => {
    if (deferredPrompt && (deferredPrompt as any).prompt) {
      // Chrome/Edge: fire the native install prompt.
      await (deferredPrompt as any).prompt();
      const choice = await (deferredPrompt as any).userChoice;
      if (choice === "accepted") {
        setIsInstalled(true);
        localStorage.setItem("signova-installed", "1");
        setInstallBannerVisible(false);
        setManualInstructionsVisible(false);
        setDeferredPrompt(null);
      } else {
        // Dismissed: keep banner visible so user can try again later.
        setManualInstructionsVisible(true);
      }
      return;
    }

    if (isIOS && !isIOSStandalone) {
      // iOS Safari: no beforeinstallprompt — show manual instructions.
      setManualInstructionsVisible(true);
      setInstallBannerVisible(false);
      return;
    }

    // Fallback for browsers without beforeinstallprompt: show manual steps.
    setManualInstructionsVisible(true);
    setInstallBannerVisible(false);
  }, [deferredPrompt, isIOS, isIOSStandalone]);

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerVisible(false);
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
      {/* Install banner: shown when the browser offers a native install prompt,
         or when the user has clicked Install and needs manual fallback steps.
         Hidden while a session (live signing or text chat) is active so it
         never sits in or over the header. */}
      {!isInstalled && step !== "live" && step !== "text" && installBannerVisible && (
        <div style={styles.installBanner}>
          <span style={styles.installText}>Install Signova as an app?</span>
          <TouchButton variant="primary" size="sm" onPress={installApp}>
            Install
          </TouchButton>
          {manualInstructionsVisible && (
            <div style={styles.manualInstructions}>
              <p style={styles.manualTitle}>Install manually:</p>
              <ul style={styles.manualList}>
                <li style={styles.manualItem}>
                  <strong>Chrome / Edge:</strong> click the ⋮ (or ⋯) menu →{" "}
                  <strong>Install Signova as an app</strong> / <strong>Apps → Install this site as an app</strong>
                </li>
                {isIOS ? (
                  <li style={styles.manualItem}>
                    <strong>iOS Safari:</strong> tap the Share (⎋) button → <strong>Add to Home Screen</strong>
                  </li>
                ) : (
                  <li style={styles.manualItem}>
                    <strong>Safari (Mac):</strong> File → <strong>Add to Dock</strong>
                  </li>
                )}
              </ul>
              <p style={styles.manualNote}>
                PWA install requires HTTPS in production; on localhost use the
                browser menu option above.
              </p>
              <button
                type="button"
                style={styles.dismissHint}
                onClick={dismissInstallBanner}
                aria-label="Dismiss installation instructions"
              >
                Dismiss
              </button>
            </div>
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
    <ReplyRouterProvider>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </ReplyRouterProvider>
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
  manualInstructions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 8,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: "#FFFFFF",
  } as React.CSSProperties,
  manualTitle: {
    fontSize: 12,
    fontWeight: 800,
    margin: "0 0 4px",
    color: "#FFFFFF",
  } as React.CSSProperties,
  manualList: {
    margin: "0 0 6px",
    paddingLeft: 18,
    color: "rgba(255,255,255,0.95)",
    lineHeight: 1.5,
  } as React.CSSProperties,
  manualItem: {
    margin: "0 0 3px",
  } as React.CSSProperties,
  manualNote: {
    fontSize: 10,
    margin: 0,
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
  } as React.CSSProperties,
  dismissHint: {
    alignSelf: "flex-end",
    fontSize: 11,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 6,
    padding: "2px 8px",
    cursor: "pointer",
  } as React.CSSProperties,
  offlineBanner: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
    padding: "6px 16px", background: "rgba(104,99,107,0.9)", color: "#FFFFFF",
    fontSize: 13, textAlign: "center", fontWeight: 600,
  } as React.CSSProperties,
  offlineText: { margin: 0 } as React.CSSProperties,
  screenArea: { minHeight: "100vh", width: "100%" } as React.CSSProperties,
};
