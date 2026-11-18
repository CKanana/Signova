import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  Download,
  EllipsisVertical,
  Plus,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import "./../styles/install-prompt.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

declare global {
  interface Window {
    __signovaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface InstallPromptProps {
  suppressed?: boolean;
}

type Platform = "ios" | "android" | "chrome-desktop" | "safari-desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Chrome|Chromium|Edg/i.test(ua)) return "chrome-desktop";
  if (/Safari/i.test(ua)) return "safari-desktop";
  return "other";
}

function standaloneNow(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = "signova-install-dismissed-at";
const DISMISS_DAYS = 3;

function dismissedRecently(): boolean {
  try {
    const value = Number(localStorage.getItem(DISMISS_KEY));
    if (!Number.isFinite(value) || value <= 0) return false;
    return Date.now() - value < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt({ suppressed = false }: InstallPromptProps) {
  const [installed, setInstalled] = useState(() => standaloneNow());
  const [canOffer, setCanOffer] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [platform] = useState<Platform>(() => detectPlatform());
  const closeTimerRef = useRef<number | null>(null);

  const storeDismissed = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      return;
    }
  }, []);

  const acceptPrompt = useCallback((event: BeforeInstallPromptEvent) => {
    setPromptEvent(event);
    setCanOffer(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem("signova-installed");
    } catch {
      void 0;
    }

    if (standaloneNow()) {
      setInstalled(true);
      return;
    }

    const savedPrompt = window.__signovaInstallPrompt;
    if (savedPrompt) acceptPrompt(savedPrompt);

    const onPromptAvailable = () => {
      const event = window.__signovaInstallPrompt;
      if (event) acceptPrompt(event);
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      window.__signovaInstallPrompt = prompt;
      acceptPrompt(prompt);
    };

    const onInstalled = () => {
      setInstalled(true);
      setCanOffer(false);
      setManualOpen(false);
      setJustInstalled(true);
      setPromptEvent(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        void 0;
      }
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(
        () => setJustInstalled(false),
        2600,
      );
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (standaloneNow()) {
        setInstalled(true);
        setCanOffer(false);
      }
    };

    window.addEventListener("signova-install-available", onPromptAvailable);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setTimeout(() => {
      if (standaloneNow() || dismissedRecently()) return;
      setCanOffer(true);
    }, 1700);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("signova-install-available", onPromptAvailable);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVisibility);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [acceptPrompt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setManualOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleInstall = useCallback(async () => {
    if (installing) return;

    if (promptEvent) {
      setInstalling(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        setPromptEvent(null);
        window.__signovaInstallPrompt = null;

        if (choice?.outcome === "accepted") {
          setInstalled(true);
          setCanOffer(false);
          setJustInstalled(true);
          window.setTimeout(() => setJustInstalled(false), 2600);
        } else {
          setCanOffer(false);
          storeDismissed();
        }
      } catch {
        setPromptEvent(null);
        window.__signovaInstallPrompt = null;
        setManualOpen(true);
      } finally {
        setInstalling(false);
      }
      return;
    }

    setManualOpen(true);
  }, [installing, promptEvent, storeDismissed]);

  const dismiss = useCallback(() => {
    setCanOffer(false);
    setManualOpen(false);
    storeDismissed();
  }, [storeDismissed]);

  if (installed) {
    return justInstalled ? (
      <div className="sn-install-toast" role="status">
        <Check size={18} strokeWidth={2.6} />
        Signova installed
      </div>
    ) : null;
  }

  if (!canOffer || suppressed) return null;

  return (
    <>
      <section className="sn-install" aria-label="Install Signova">
        <span className="sn-install__icon" aria-hidden="true">
          <Download size={20} strokeWidth={2.3} />
        </span>
        <div className="sn-install__copy">
          <strong>Install Signova</strong>
          <span>Add it to your home screen for one-tap access.</span>
        </div>
        <button
          type="button"
          className="sn-install__cta"
          onClick={() => void handleInstall()}
          disabled={installing}
        >
          {installing ? <span className="sn-install__spinner" /> : null}
          {installing ? "Opening…" : "Install"}
        </button>
        <button
          type="button"
          className="sn-install__dismiss"
          onClick={dismiss}
          aria-label="Not now"
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      </section>

      {manualOpen ? (
        <div
          className="sn-install-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sn-install-title"
          onClick={() => setManualOpen(false)}
        >
          <div
            className="sn-install-modal__card"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sn-install-modal__header">
              <img
                className="sn-install-modal__appIcon"
                src="/icons/android-chrome-192x192.png"
                alt=""
                aria-hidden="true"
              />
              <div>
                <h2 className="sn-install-modal__title" id="sn-install-title">
                  Install Signova
                </h2>
                <p className="sn-install-modal__subtitle">
                  Add Signova to your home screen and open it like an app.
                </p>
              </div>
              <button
                type="button"
                className="sn-install-modal__close"
                onClick={() => setManualOpen(false)}
                aria-label="Close install instructions"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </header>

            <div className="sn-install-modal__body">
              {platform === "ios" ? (
                <>
                  <Step
                    icon={<Share size={18} />}
                    title="Tap the Share button"
                    text="Open this page in Safari and tap the Share icon in the toolbar."
                  />
                  <Step
                    icon={<Plus size={18} />}
                    title="Choose Add to Home Screen"
                    text="Scroll the share sheet and tap Add to Home Screen."
                  />
                  <Step
                    icon={<Check size={18} />}
                    title="Tap Add"
                    text="Signova will appear on your home screen like an app."
                  />
                </>
              ) : platform === "android" ? (
                <>
                  <Step
                    icon={<EllipsisVertical size={18} />}
                    title="Open the browser menu"
                    text="In Chrome, tap the three-dot menu in the top-right corner."
                  />
                  <Step
                    icon={<Download size={18} />}
                    title="Choose Install app"
                    text="Tap Install app or Add to Home screen."
                  />
                  <Step
                    icon={<Check size={18} />}
                    title="Confirm"
                    text="Signova will be added to your home screen."
                  />
                </>
              ) : platform === "safari-desktop" ? (
                <>
                  <Step
                    icon={<Share size={18} />}
                    title="Open the File menu"
                    text="In Safari on macOS, open File in the menu bar."
                  />
                  <Step
                    icon={<Plus size={18} />}
                    title="Choose Add to Dock"
                    text="Signova will appear in your Dock and open in its own window."
                  />
                </>
              ) : (
                <>
                  <Step
                    icon={<Download size={18} />}
                    title="Use the browser install control"
                    text="Click the install icon in the address bar, or open the browser menu and choose Install Signova."
                  />
                  <Step
                    icon={<EllipsisVertical size={18} />}
                    title="Or use the app menu"
                    text="Chrome and Edge: menu → Apps → Install this site as an app."
                  />
                  <Step
                    icon={<Smartphone size={18} />}
                    title="On a phone"
                    text="Use Add to Home Screen from your browser menu."
                  />
                </>
              )}
            </div>

            <div className="sn-install-modal__note">
              {window.isSecureContext
                ? "App installation is handled by your browser. No download is required."
                : "Installation needs HTTPS or localhost. Open Signova on a secure address to enable it."}
            </div>

            <div className="sn-install-modal__actions">
              <button
                type="button"
                className="sn-install-modal__primary"
                onClick={() => setManualOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Step({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="sn-install-step">
      <span className="sn-install-step__icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
