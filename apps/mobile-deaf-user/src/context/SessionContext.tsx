import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Platform } from "react-native";
import {
  Step,
  CommunicationMethod,
  Message,
  StaffInfo,
  OrganisationInfo,
  AccessibilitySettings,
  SessionContextValue,
} from "../../../../shared/types/session";
import { api, ApiError, setAuthToken, getAuthToken } from "../services/api";
import { connectSocket, disconnectSocket, isConnected as socketIsConnected } from "../services/socket";
import { getDeviceId } from "../services/deviceId";
import { requestTranslation } from "../services/translation";
import type { Teller, TranslateResponse } from "../../../../shared/types/mobile";
import {
  loadOnDeviceRecognizer,
  loadModelMetadata,
  recogniseOnDevice,
  RecogniserBackend,
  type ModelMetadata,
} from "../model/recogniser";
import { useHandRecorder, type HandLandmarksPerFrame } from "../hooks/useHandRecorder";
import { useHandLandmarker } from "../hooks/useHandLandmarker";

/** Toggle: on-device model (true) or the existing mock placeholder (false). */
export const USE_MODEL = process.env.EXPO_PUBLIC_USE_MODEL === "true";

/** Read the config flag for the UI layer; kept separate to avoid an import
 *  cycle between session context (which uses the recogniser) and the screens. */
export const USE_MODEL_FOR_UI = USE_MODEL;

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

  // --- On-device recognition state (M4b) ---
  const [recognitionBackend, setRecognitionBackend] = useState<RecogniserBackend>("mock");
  const [isRecognising, setIsRecognising] = useState<boolean>(false);
  const [recogniseResult, setRecogniseResult] = useState<
    | { results: { sign: string; probability: number }[]; timingMs: number; top1: string }
    | null
  >(null);
  const [recogniseError, setRecogniseError] = useState<string | null>(null);

  // Recorder: collects frames while in "live"/"perform" and hands the Float32Array
  // to the recogniser on stop. Only active when on-device recognition is in use.
  const {
    isRecording,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecorder,
    recording: frames,
    pushFrame,
  } = useHandRecorder(
    (frame) => {
      // Called by pushFrame. Tracks whether hands are currently visible.
      setIsHandsDetected(!!frame.handLandmarks?.length);
    },
    () => {
      // The stop action fires. Finish the clip, run the model, and hand the
      // top-5 to the Validate screen. This is deliberately async-safe so the
      // UI never blocks the existing stop action.
      void runRecogniseOnStop();
    },
  );

  // Hand landmarker: feeds MediaPipe detections into the recorder buffer.
  // On platforms where the native module is unavailable (web, iOS, Expo Go),
  // this is a no-op and the session falls back to zero-frame inference.
  const {
    isReady: isLandmarkerReady,
    isUnavailable: isLandmarkerUnavailable,
    initialise: initialiseLandmarker,
    destroy: destroyLandmarker,
  } = useHandLandmarker({
    // Wire: native hand detection → recorder ring buffer
    onFrame: pushFrame,
  });

  // Holds the loaded recogniser + metadata so the stop handler can run them.
  const runModelRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recogniser: any;
    metadata: ModelMetadata;
  } | null>(null);

  // --- On-device recognition lifecycle ---
  // Eagerly loads the model once EXPO_PUBLIC_USE_MODEL=true so the first
  // inference doesn't pay the load latency. Falls back to mock on any error.
  useEffect(() => {
    if (!USE_MODEL) return;

    let cancelled = false;

    const init = async () => {
      setRecogniseError(null);

      try {
        if (Platform.OS === "web") {
          setRecognitionBackend("mock");
          return;
        }

        const recogniser = await loadOnDeviceRecognizer();
        if (cancelled) return;

        if (!recogniser) {
          setRecognitionBackend("mock");
          return;
        }

        setRecognitionBackend("model");
        const metadata = await loadModelMetadata();
        if (cancelled) return;
        runModelRef.current = { recogniser, metadata };
      } catch (err) {
        if (!cancelled) {
          setRecognitionBackend("mock");
          setRecogniseError(
            `On-device recognition not available in this build: ${(err as Error).message}`,
          );
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [USE_MODEL]);

  /** Runs the on-device model on the clip captured by the recorder. */
  const runRecogniseOnStop = useCallback(async () => {
    if (!USE_MODEL) return;

    try {
      const model = runModelRef.current;
      if (!model) {
        setRecogniseError("Model stack not initialised.");
        setRecognitionBackend("mock");
        setIsRecognising(false);
        return;
      }
      const { recogniser: _recogniser, metadata } = model;
      setRecogniseResult(null);

      // The recorder hook already tail-padded to 60 frames.
      const sequence: Float32Array = frames?.sequence ?? new Float32Array(60 * 126);

      // MODEL CONTRACT: signova_model.tflite already applies softmax —
      // pass shouldApplySoftmax=false. Do NOT apply softmax again.
      const result = await recogniseOnDevice(
        sequence,
        metadata,
        /* shouldApplySoftmax */ false,
      );
      if (!result) {
        setRecogniseError("On-device inference returned no result.");
        setRecognitionBackend("mock");
        setIsRecognising(false);
        return;
      }

      setRecogniseResult({
        results: result.results,
        timingMs: result.timingMs,
        top1: result.results[0]?.sign ?? "unknown",
      });
      setIsRecognising(false);
    } catch (err) {
      setRecogniseError(`On-device inference failed: ${(err as Error).message}`);
      setRecognitionBackend("mock");
      setIsRecognising(false);
    }
  }, [USE_MODEL, frames]);

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
      case "connecting": goToStep("tellers"); break;
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
      if (typeof document !== "undefined" && organization?.colors) {
        if (organization.colors.primary) {
          document.documentElement.style.setProperty("--signova-primary", organization.colors.primary);
        }
        if (organization.colors.background) {
          document.documentElement.style.setProperty("--signova-background", organization.colors.background);
        }
      }
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

    // Capture the method at the time of connecting so the closure is stable.
    const currentMethod = method;

    connectSocket(token, sessionId, {
      onSessionConnected: () => {
        setIsConnected(true);
        // Navigation is deferred to "session:active" so the Deaf user is not
        // shunted to the live/text screen while their request is still
        // pending (status CONNECTING). "session:active" fires only after an
        // authorized teller accepts.
      },
      onSessionActive: () => {
        setIsConnected(true);
        // Advance to the real conversation screen only after the server
        // commits CONNECTING -> ACTIVE.
        goToStep(currentMethod === "text" ? "conversation" : "live");
        // Start the MediaPipe hand detector when the live session begins.
        // No-op if the native module is unavailable.
        if (currentMethod !== "text") {
          void initialiseLandmarker();
        }
      },
      onStaffMessage: (m) => {
        setMessages((prev) => [...prev, mapBackendMessage(m)]);
        // For text sessions, show inline in conversation rather than full-screen response
        setStep((currentStep) => {
          if (currentStep === "conversation" || currentStep === "text") {
            return "conversation";
          }
          return "response";
        });
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
  }, [sessionId, method, goToStep, initialiseLandmarker]);

  /** Request a translation through the model-agnostic seam.
   *
   * When EXPO_PUBLIC_USE_MODEL=true AND on-device recognition has already run
   * (recogniseResult is populated from the recorder's stop callback), we use
   * the on-device top-1 result directly and skip the server call.
   *
   * When the model is disabled or unavailable, falls back to the server's
   * placeholder translation endpoint — preserving the existing mock path.
   */
  const requestTranslationResult = useCallback(async (): Promise<TranslateResponse | null> => {
    if (!sessionId) return null;

    // --- On-device path ---
    if (USE_MODEL && recogniseResult && recogniseResult.results.length > 0) {
      const top1 = recogniseResult.results[0];
      // Treat top-1 probability < 0.4 as low confidence so the user can
      // correct via the UncertainFallback screen before sending.
      const isLowConfidence = top1.probability < 0.4;
      setDetectedGlossState(top1.sign);
      setCurrentDraft(top1.sign);
      setConfidence(top1.probability);
      goToStep(isLowConfidence ? "uncertain" : "confirm");
      // Return a synthetic TranslateResponse that matches the expected shape.
      const syntheticResponse: TranslateResponse = {
        translation: {
          gloss: top1.sign,
          confidence: top1.probability,
          alternatives: recogniseResult.results.slice(1).map(r => ({
            gloss: r.sign,
            confidence: r.probability,
          })),
        },
        latencyMs: recogniseResult.timingMs,
        lowConfidence: isLowConfidence,
      };
      return syntheticResponse;
    }

    // --- Server (mock/placeholder) path ---
    setIsTranslating(true);
    setError(null);
    try {
      const result = await requestTranslation(sessionId, null);
      setDetectedGlossState(result.translation.gloss);
      setCurrentDraft(result.translation.gloss);
      setConfidence(result.translation.confidence);
      goToStep(result.lowConfidence ? "uncertain" : "confirm");
      return result;
    } catch (err) {
      setError(describeError(err));
      goToStep("offline");
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [sessionId, goToStep, recogniseResult]);

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
        // Emit over socket first for immediate real-time delivery to staff
        const { emitMessage } = await import("../services/socket");
        emitMessage(sessionId, { text, method: "text", isConfirmed: true });

        // Also persist via REST so the message is stored even if socket drops
        const { message } = await api.sendMessage(sessionId, {
          sender: "USER",
          text,
          method: "text",
          isConfirmed: true,
        });
        setMessages((prev) => {
          // Avoid duplicate if the socket already echoed it back
          const alreadyAdded = prev.some((m) => m.id === ((message as any).id ?? (message as any)._id));
          if (alreadyAdded) return prev;
          return [...prev, mapBackendMessage(message as any)];
        });
        goToStep("conversation");
      } catch (err) {
        setError(describeError(err));
      }
    },
    [sessionId, goToStep],
  );

  /** End the session on the backend and free the teller. */
  const endSession = useCallback(async (): Promise<void> => {
    void destroyLandmarker();
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
    void destroyLandmarker();
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
    // M4b on-device recognition
    recognitionBackend,
    isRecognising,
    recogniseResult,
    recogniseError,
    startRecording,
    resetRecorder,
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
