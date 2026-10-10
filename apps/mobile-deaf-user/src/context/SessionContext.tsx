import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import {
  Step,
  CommunicationMethod,
  Message,
  StaffInfo,
  OrganisationInfo,
  AccessibilitySettings,
  SessionContextValue,
} from "../../../../shared/types/session";
import { Teller, TranslateResponse } from "../../../../shared/types/mobile";
import { api, ApiError, setAuthToken, getAuthToken } from "../services/api";
import { connectSocket, disconnectSocket, isConnected as socketIsConnected } from "../services/socket";
import { getDeviceId } from "../services/deviceId";
import { requestTranslation } from "../services/translation";
import type { Translation } from "../../../../shared/types/translation";

const DEFAULT_ORG_PLACEHOLDER: OrganisationInfo = {
  name: "Signova",
  shortName: "S",
  welcomeMessage: "",
  serviceName: "",
  counterLabel: "",
};

/* -------------------------------------------------------------------------- */
/* Local UI types                                                              */
/* -------------------------------------------------------------------------- */

// The old SessionContext used local "Message" (sender: "user"|"staff"). We keep
// that UI shape but populate it from the backend's MessageRecord.
type UiMessage = Message;

// StaffInfo previously carried name/role/serviceDesk/counterNumber. We now
// derive it from the selected Teller so existing screens keep working unchanged.
function staffFromTeller(teller: Teller | null): StaffInfo {
  if (!teller) {
    return { name: "", role: "", serviceDesk: "", counterNumber: "", isAvailable: false };
  }
  return {
    name: teller.name,
    role: teller.serviceLabel,
    serviceDesk: teller.serviceDesk,
    counterNumber: teller.counterNumber,
    isAvailable: teller.status === "FREE",
  };
}

// OrganisationInfo previously had a fixed shape; the backend returns more.
function orgFromBackend(o: any): OrganisationInfo {
  return {
    name: o.name,
    shortName: o.shortName,
    welcomeMessage: o.welcomeMessage,
    serviceName: o.serviceName,
    counterLabel: o.counterLabel,
    primaryColor: o.colors?.primary,
    backgroundColor: o.colors?.background,
    logoUrl: o.logoUrl,
  };
}

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  captions: true,
  visualAlerts: true,
  reduceMotion: false,
  language: "English / KSL",
};

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // --- Navigation / step machine (unchanged 18-step flow) ---
  const [step, setStep] = useState<Step>("splash");
  const [previousStep, setPreviousStep] = useState<Step | null>(null);

  // --- Communication method ---
  const [method, setMethodState] = useState<CommunicationMethod>("sign");

  // --- Real backend data ---
  const [organisation, setOrganisation] = useState<OrganisationInfo | null>(null);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [currentTeller, setCurrentTeller] = useState<Teller | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [currentDraft, setCurrentDraft] = useState<string>("");
  const [detectedGloss, setDetectedGlossState] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [isHandsDetected, setIsHandsDetected] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // --- Async status flags for loading/empty/error states ---
  const [isLoadingOrg, setIsLoadingOrg] = useState<boolean>(false);
  const [isLoadingTellers, setIsLoadingTellers] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guard so we only bootstrap once.
  const bootstrapped = useRef(false);

  /* -------- Derived values (existing screens read these) -------- */
  const staff = staffFromTeller(currentTeller);
  const accessibility = DEFAULT_ACCESSIBILITY;

  /* ---------------------------------------------------------------------- */
  /* Step machine — preserved exactly as before                              */
  /* ---------------------------------------------------------------------- */
  const goToStep = useCallback((nextStep: Step) => {
    setPreviousStep(step);
    setStep(nextStep);
  }, [step]);

  const goBack = useCallback(() => {
    if (step === "settings" || step === "help") {
      setStep(previousStep ?? "welcome");
      return;
    }
    switch (step) {
      case "welcome": break;
      case "method": goToStep("welcome"); break;
      case "tellers": goToStep("method"); break;
      case "text": goToStep("method"); break;
      case "connecting": goToStep(method === "sign" ? "tellers" : "method"); break;
      case "permission": goToStep("method"); break;
      case "ready": goToStep("method"); break;
      case "live": goToStep("tellers"); break;
      case "translating": goToStep("live"); break;
      case "confirm":
      case "uncertain": goToStep("live"); break;
      case "sent": goToStep("conversation"); break;
      case "response": goToStep("conversation"); break;
      case "conversation": goToStep("welcome"); break;
      case "complete":
      case "offline": goToStep("welcome"); break;
      default: goToStep("welcome");
    }
  }, [step, previousStep, goToStep, method]);

  /* ---------------------------------------------------------------------- */
  /* Backend actions                                                         */
  /* ---------------------------------------------------------------------- */

  const loadOrganisation = useCallback(async () => {
    setIsLoadingOrg(true);
    setError(null);
    try {
      const { organization } = await api.getOrganisation();
      setOrganisation(orgFromBackend(organization));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoadingOrg(false);
    }
  }, []);

  const loadTellers = useCallback(async () => {
    setIsLoadingTellers(true);
    setError(null);
    try {
      const { tellers } = await api.getTellers();
      // Backend is the source of truth for availability.
      setTellers(tellers);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoadingTellers(false);
    }
  }, []);

  /**
   * Select a teller and create the real session. On success we hold the
   * device-scoped access token and move to "connecting". The backend rejects
   * creation (409) if the teller became BUSY since the list was fetched — we
   * surface that as an error and keep the user on the teller screen.
   */
  const selectTeller = useCallback(
    async (teller: Teller): Promise<boolean> => {
      setIsCreatingSession(true);
      setError(null);
      try {
        const deviceId = await getDeviceId();
        const { session, accessToken, teller: freshTeller } = await api.createSession({
          tellerId: teller._id,
          method,
          deviceId,
        });
        setAuthToken(accessToken);
        setSessionId(session._id);
        setCurrentTeller(freshTeller ?? teller);
        setMessages([]);
        setCurrentDraft("");
        setDetectedGlossState("");
        setConfidence(0);
        goToStep("connecting");
        return true;
      } catch (err) {
        setError(describeError(err));
        return false;
      } finally {
        setIsCreatingSession(false);
      }
    },
    [method, goToStep],
  );

  /**
   * Establish the real Socket.IO connection for the active session.
   * On "session:connected" we advance to "live"; on socket failure we fall
   * back to the offline screen. Staff replies arrive via "staff:message".
   */
  const connectToSession = useCallback(() => {
    if (!sessionId) return;
    const token = getAuthToken();
    if (!token) {
      setError("No session token available.");
      return;
    }
    connectSocket(token, sessionId, {
      onSessionConnected: () => {
        setIsConnected(true);
        goToStep("live");
      },
      onStaffMessage: (m) => {
        setMessages((prev) => [...prev, mapBackendMessage(m)]);
        goToStep("response");
      },
      onSessionEnded: () => {
        setIsConnected(false);
        goToStep("complete");
      },
      onError: (e) => setError(e.message),
      onConnectionChange: (connected) => setIsConnected(connected),
    });

    // If the socket can't connect within a few seconds, show the offline screen.
    setTimeout(() => {
      if (!socketIsConnected()) {
        setError("Could not connect to the service.");
        goToStep("offline");
      }
    }, 6000);
  }, [sessionId, goToStep]);

  /** Request a translation through the model-agnostic seam. */
  const requestTranslationResult = useCallback(async (): Promise<TranslateResponse | null> => {
    if (!sessionId) return null;
    setIsTranslating(true);
    setError(null);
    try {
      const result = await requestTranslation(sessionId, null);
      setDetectedGlossState(result.translation.gloss);
      setCurrentDraft(result.translation.gloss);
      setConfidence(result.translation.confidence);
      // Branch on the server's low-confidence flag.
      goToStep(result.lowConfidence ? "uncertain" : "confirm");
      return result;
    } catch (err) {
      setError(describeError(err));
      goToStep("offline");
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [sessionId, goToStep]);

  /** Confirm the current translation and send it to staff. */
  const confirmAndSend = useCallback(
    async (text: string): Promise<void> => {
      if (!sessionId) return;
      setError(null);
      try {
        const { message } = await api.sendMessage(sessionId, {
          sender: "USER",
          text,
          method,
          confidence: confidence || undefined,
          isConfirmed: true,
        });
        setMessages((prev) => [...prev, mapBackendMessage(message)]);
        goToStep("sent");
      } catch (err) {
        setError(describeError(err));
      }
    },
    [sessionId, method, confidence, goToStep],
  );

  /** Send a typed message (no translation). */
  const sendTextMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!sessionId) return;
      setError(null);
      try {
        const { message } = await api.sendMessage(sessionId, {
          sender: "USER",
          text,
          method: "text",
        });
        setMessages((prev) => [...prev, mapBackendMessage(message)]);
        goToStep("sent");
      } catch (err) {
        setError(describeError(err));
      }
    },
    [sessionId, goToStep],
  );

  /** End the session on the backend and free the teller. */
  const endSession = useCallback(async (): Promise<void> => {
    if (sessionId) {
      try {
        await api.endSession(sessionId);
      } catch {
        // Even if the network call fails, clean up locally.
      }
    }
    disconnectSocket();
    setAuthToken(null);
    setIsConnected(false);
    goToStep("complete");
  }, [sessionId, goToStep]);

  const resetSession = useCallback(() => {
    disconnectSocket();
    setAuthToken(null);
    setSessionId(null);
    setCurrentTeller(null);
    setMessages([]);
    setCurrentDraft("");
    setDetectedGlossState("");
    setConfidence(0);
    setIsHandsDetected(false);
    setIsConnected(false);
    setError(null);
    goToStep("welcome");
  }, [goToStep]);

  /* ---------------------------------------------------------------------- */
  /* Existing API kept for backward-compatible screens                       */
  /* ---------------------------------------------------------------------- */

  const setMethod = useCallback((newMethod: CommunicationMethod) => {
    setMethodState(newMethod);
  }, []);

  const setStaff = useCallback((info: StaffInfo) => {
    // Legacy setter: reflect onto currentTeller so staff.* keeps working.
    setCurrentTeller((prev) =>
      prev
        ? { ...prev, name: info.name, serviceDesk: info.serviceDesk, counterNumber: info.counterNumber }
        : prev,
    );
  }, []);

  const setDetectedGloss = useCallback((gloss: string, conf = 0) => {
    setDetectedGlossState(gloss);
    setCurrentDraft(gloss);
    setConfidence(conf);
  }, []);

  const setHandsDetectedFn = useCallback((detected: boolean) => {
    setIsHandsDetected(detected);
  }, []);

  // Legacy synchronous senders kept so any un-migrated screen still compiles;
  // they delegate to the async versions.
  const sendMessage = useCallback(
    (text: string, sendMethod: "sign" | "text" = "sign") => {
      if (sendMethod === "text") {
        void sendTextMessage(text);
      } else {
        void confirmAndSend(text);
      }
    },
    [sendTextMessage, confirmAndSend],
  );

  const receiveStaffMessage = useCallback((text: string) => {
    // Retained for compatibility; real staff messages arrive via the socket.
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: "staff",
        text,
        timestamp: nowTime(),
        method: "speech",
      },
    ]);
  }, []);

  const updateAccessibility = useCallback(() => {
    // Accessibility preferences are local for now (no backend endpoint yet).
  }, []);

  const updateOrganisation = useCallback(() => {
    // Admin-only on the backend; no-op on the kiosk.
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Bootstrap: load org + tellers on first mount                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadOrganisation();
    void loadTellers();
  }, [loadOrganisation, loadTellers]);

  /* ---------------------------------------------------------------------- */
  /* Context value                                                           */
  /* ---------------------------------------------------------------------- */
  const value: SessionContextValue = {
    step,
    previousStep,
    method,
    messages,
    currentDraft,
    detectedGloss,
    confidence,
    isHandsDetected,
    isConnected,
    staff,
    organisation: organisation ?? DEFAULT_ORG_PLACEHOLDER,
    accessibility,
    goToStep,
    goBack,
    setMethod,
    setStaff,
    setCurrentDraft,
    setDetectedGloss,
    setHandsDetected: setHandsDetectedFn,
    sendMessage,
    receiveStaffMessage,
    updateAccessibility,
    updateOrganisation,
    resetSession,
    // Phase 2 backend actions
    loadOrganisation,
    loadTellers,
    tellers,
    selectTeller,
    connectToSession,
    requestTranslation: requestTranslationResult,
    confirmAndSend,
    sendTextMessage,
    endSession,
    isCreatingSession,
    isTranslating,
    isLoadingOrg,
    isLoadingTellers,
    error,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function mapBackendMessage(m: {
  id?: string;
  _id?: string;
  sessionId?: string;
  session?: string;
  sender: "USER" | "STAFF";
  text: string;
  method: string;
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
}): UiMessage {
  return {
    id: (m.id ?? m._id) as string,
    sender: m.sender === "USER" ? "user" : "staff",
    text: m.text,
    timestamp: m.timestamp,
    method: m.method as UiMessage["method"],
    confidence: m.confidence,
  };
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "That teller just became unavailable. Please pick another.";
    if (err.status === 0) return "Can't reach the Signova service. Check your connection.";
    return err.message;
  }
  return (err as Error)?.message ?? "Something went wrong.";
}
