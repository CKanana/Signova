import React, { useEffect, useRef, useState } from "react";
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
import { InstallPrompt } from "./components/InstallPrompt";

function AppShell() {
  const { step } = useSession();
  const { goToStep } = useSession();
  const [isOnline, _isOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

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
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineText}>You're offline — sign recognition still works; messaging needs a connection.</span>
        </div>
      )}
      <div style={styles.screenArea}>{renderScreen(step)}</div>
      <InstallPrompt suppressed={step === "live" || step === "text"} />
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
  offlineBanner: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
    padding: "6px 16px", background: "rgba(104,99,107,0.9)", color: "#FFFFFF",
    fontSize: 13, textAlign: "center", fontWeight: 600,
  } as React.CSSProperties,
  offlineText: { margin: 0 } as React.CSSProperties,
  screenArea: { minHeight: "100vh", width: "100%" } as React.CSSProperties,
};
