/// <reference types="vite/client" />

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
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
import { landmarksToFloat32 } from "../model/preprocess";
import { useHandRecorder } from "../hooks/useHandRecorder";
import { useHandLandmarker } from "../hooks/useHandLandmarker";

/** Toggle: on-device model (true) or the existing mock placeholder (false). */
export const USE_MODEL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_MODEL === "true");

/** Read the config flag for the UI layer. */
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

type UiMessage = Message;

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
  const [step, setStep] = useState<Step>("splash");
  const [previousStep, setPreviousStep] = useState<Step | null>(null);

  const [method, setMethodState] = useState<CommunicationMethod>("sign");

  const [organisation, setOrganisation] = useState<OrganisationInfo | null>(null);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [currentTeller, setCurrentTeller] = useState<Teller | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED" | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [currentDraft, setCurrentDraft] = useState<string>("");
  const [detectedGloss, setDetectedGlossState] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [isHandsDetected, setIsHandsDetected] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);
  const [joinedTellerId, setJoinedTellerId] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);

  const [isLoadingOrg, setIsLoadingOrg] = useState<boolean>(false);
  const [isLoadingTellers, setIsLoadingTellers] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [recognitionBackend, setRecognitionBackend] = useState<RecogniserBackend>("mock");
  const [isRecognising, setIsRecognising] = useState<boolean>(false);
  const [recogniseResult, setRecogniseResult] = useState<
    | { results: { sign: string; probability: number }[]; timingMs: number; top1: string }
    | null
  >(null);
  const [recogniseError, setRecogniseError] = useState<string | null>(null);

  const {
    isRecording,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecorder,
    pushFrame,
    stop,
  } = useHandRecorder(
    (frame) => {
      // Called each time the pipeline supplies a frame. Track whether any hand
      // is present so the UI can show a real detection state while the user is
      // in the live signing step (not only once recording has started).
      setIsHandsDetected(!!frame.handLandmarks?.length);
    },
    async () => {
      // The stop action fires. Finalise the clip (stop() builds the
      // Float32Array[60,126] from the actual per-frame landmarks), run the
      // model, and hand the top-5 to the confirm/uncertain screens.
      // Async-safe so the UI never blocks the existing stop action.
      const rec = stop();
      void runRecogniseOnStop(rec ? rec.sequence : null);
    },
  );

  const {
    initialise: initialiseLandmarker,
    destroy: destroyLandmarker,
    isReady: isLandmarkerReady,
    isInitialising: isLandmarkerInitialising,
    error: landmarkerError,
    processFrame,
  } = useHandLandmarker({
    onFrame: pushFrame,
  });

  const runModelRef = useRef<{
    recogniser: any;
    metadata: ModelMetadata;
  } | null>(null);

  useEffect(() => {
    if (!USE_MODEL) return;

    let cancelled = false;

    const init = async () => {
      setRecogniseError(null);
      try {
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

  const runRecogniseOnStop = useCallback(
    async (clipSequence: Float32Array | null) => {
      if (!USE_MODEL) return;

      try {
        const model = runModelRef.current;
        if (!model) {
          setRecogniseError("Model stack not initialised.");
          setRecognitionBackend("mock");
          setIsRecognising(false);
          return;
        }
        const { metadata } = model;
        setRecogniseResult(null);

        // Use the real clip captured by the recorder. `clipSequence` is the
        // Float32Array produced by the recorder's stop() from the actual
        // per-frame landmarks; it has the exact `[1, 60, 126]` contract and
        // is 7560 values long. Do NOT infer on a zero-filled placeholder.
        const sequence =
          clipSequence ??
          landmarksToFloat32([]); // only falls back to an all-zero clip if never recorded
        const result = await recogniseOnDevice(sequence, metadata, false);

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
    },
    [USE_MODEL],
  );

  const bootstrapped = useRef(false);

  const staff = staffFromTeller(currentTeller);
  const accessibility = DEFAULT_ACCESSIBILITY;

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
      case "waiting": break;
      default: goToStep("welcome");
    }
  }, [step, previousStep, goToStep, method]);

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
      setTellers(tellers);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoadingTellers(false);
    }
  }, []);

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
        setSessionStatus(session.status as "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED");
        setSessionOwnerId((session.deafUser as { toString: () => string }).toString());
        setCurrentTeller(freshTeller ?? teller);
        setMessages([]);
        setCurrentDraft("");
        setDetectedGlossState("");
        setConfidence(0);
        // Bug 3: persist session so it survives reloads.
        try {
          localStorage.setItem("signova.session", JSON.stringify({
            sessionId: session._id,
            tellerId: teller._id,
            method,
            createdAt: Date.now(),
          }));
        } catch { /* localStorage unavailable */ }
        goToStep("waiting");
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

  const connectToSession = useCallback(() => {
    if (!sessionId) return;
    const token = getAuthToken();
    if (!token) {
      setError("No session token available.");
      return;
    }

    const currentMethod = method;

    connectSocket(token, sessionId, {
      onSessionConnected: (payload) => {
        setIsConnected(true);
        const status = (payload.status as "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED") ?? null;
        setSessionStatus(status);
        if (status === "ACTIVE") {
          setJoinedTellerId(currentTeller?._id ?? null);
          setJoinedAt(Date.now());
          try { navigator.vibrate?.(100); } catch { /* vibrate not supported */ }
          // Auto-route after ~2 seconds; WaitingScreen also shows a Continue button.
          setTimeout(() => {
            if (joinedTellerId && step === "waiting") {
              goToStep(currentMethod === "text" ? "text" : "live");
              if (currentMethod !== "text") {
                void initialiseLandmarker();
              }
            }
          }, 2000);
        }
      },
      onSessionActive: () => {
        setIsConnected(true);
        setSessionStatus("ACTIVE");
        setJoinedTellerId(currentTeller?._id ?? null);
        setJoinedAt(Date.now());
        try { navigator.vibrate?.(100); } catch { /* vibrate not supported */ }
        setTimeout(() => {
          if (joinedTellerId && step === "waiting") {
            goToStep(currentMethod === "text" ? "text" : "live");
            if (currentMethod !== "text") {
              void initialiseLandmarker();
            }
          }
        }, 2000);
      },
      onSessionRejected: () => {
        setIsConnected(false);
        setSessionStatus("CANCELLED");
        setSessionId(null);
        setCurrentTeller(null);
        setSessionOwnerId(null);
        goToStep("waiting");
      },
      onNewMessage: (m) => {
        setMessages((prev) => {
          const alreadyAdded = prev.some((pm) => pm.id === m.id);
          if (alreadyAdded) return prev;
          return [...prev, mapBackendMessage(m)];
        });
        setStep((currentStep) => {
          if (currentStep === "conversation" || currentStep === "text") {
            return "conversation";
          }
          return m.sender === "STAFF" ? "response" : "sent";
        });
      },
      onSessionEnded: () => {
        setIsConnected(false);
        setSessionStatus("ENDED");
        setSessionId(null);
        setCurrentTeller(null);
        setSessionOwnerId(null);
        goToStep("complete");
      },
      onError: (e) => setError(e.message),
      onConnectionChange: (connected) => setIsConnected(connected),
    });

    setTimeout(() => {
      if (!socketIsConnected()) {
        setError("Could not connect to the service.");
        goToStep("offline");
      }
    }, 6000);
  }, [sessionId, method, goToStep, initialiseLandmarker]);

  /* ------------------------------------------------------------------ */
  /* Auto-connect on entering "waiting", with a fallback poller         */
  /* ------------------------------------------------------------------ */
  const waitingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const WAITING_POLL_MS = 5000;

  const clearWaitingPoll = useCallback(() => {
    if (waitingPollRef.current) {
      clearInterval(waitingPollRef.current);
      waitingPollRef.current = null;
    }
  }, []);

  const checkWaitingStatus = useCallback(async () => {
    if (step !== "waiting" || !sessionId) return;
    try {
      const { session } = await api.getCurrentSession();
      if (session && session.status === "ACTIVE") {
        setSessionStatus("ACTIVE");
        setIsConnected(true);
        goToStep(method === "text" ? "text" : "live");
        if (method !== "text") {
          void initialiseLandmarker();
        }
        clearWaitingPoll();
      }
    } catch {
      /* transient — next poll or socket event will recover */
    }
  }, [step, sessionId, method, goToStep, initialiseLandmarker, clearWaitingPoll]);

  // Connect the socket when we enter "waiting" with a sessionId.
  useEffect(() => {
    if (sessionId && step === "waiting") {
      connectToSession();
      void checkWaitingStatus();
      waitingPollRef.current = setInterval(checkWaitingStatus, WAITING_POLL_MS);
    } else {
      clearWaitingPoll();
    }
    return () => clearWaitingPoll();
  }, [sessionId, step, connectToSession, checkWaitingStatus, clearWaitingPoll]);

  // Re-check session status when the tab regains focus (missed socket event).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && step === "waiting") {
        void checkWaitingStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [step, checkWaitingStatus]);

  const requestTranslationResult = useCallback(async (): Promise<TranslateResponse | null> => {
    if (!sessionId) return null;

    if (USE_MODEL && recogniseResult && recogniseResult.results.length > 0) {
      const top1 = recogniseResult.results[0];
      // A placeholder class mapped to "unknown" is not a real translation,
      // regardless of its softmax probability. Always treat it as uncertain.
      const isUnmapped = top1.sign === "unknown";
      const isLowConfidence = isUnmapped || top1.probability < 0.4;
      setDetectedGlossState(top1.sign);
      setCurrentDraft(top1.sign);
      setConfidence(top1.probability);
      goToStep(isLowConfidence ? "uncertain" : "confirm");
      const syntheticResponse: TranslateResponse = {
        translation: {
          gloss: top1.sign,
          confidence: top1.probability,
          alternatives: recogniseResult.results.slice(1).map((r) => ({
            gloss: r.sign,
            confidence: r.probability,
          })),
        },
        latencyMs: recogniseResult.timingMs,
        lowConfidence: isLowConfidence,
      };
      return syntheticResponse;
    }

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

  const sendTextMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!sessionId) return;
      setError(null);
      try {
        const { emitMessage } = await import("../services/socket");
        emitMessage(sessionId, { text, method: "text", isConfirmed: true });
        // Optimistic add; the server echoes it back via message:new to the
        // session room, which the onStaffMessage-style confirmation handles.
        setMessages((prev) => [...prev, mapBackendMessage({ _id: `opt-${Date.now()}`, session: sessionId, sender: "USER", text, method: "text", confidence: undefined, isConfirmed: true, timestamp: new Date().toISOString() })]);
        goToStep("conversation");
      } catch (err) {
        setError(describeError(err));
      }
    },
    [sessionId, goToStep],
  );

  const endSession = useCallback(async (): Promise<void> => {
    void destroyLandmarker();
    // Bug 3: clear stored session so it does not resume after End.
    try { localStorage.removeItem("signova.session"); } catch { /* noop */ }
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
    // Bug 3: clear stored session on reset.
    try { localStorage.removeItem("signova.session"); } catch { /* noop */ }
    disconnectSocket();
    setAuthToken(null);
    setSessionId(null);
    setSessionStatus(null);
    setSessionOwnerId(null);
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

  /**
   * Restore the Deaf user's existing session on initialization / refresh.
   *
   * Fetches the latest CONNECTING/ACTIVE session from the backend
   * (GET /api/sessions/current). All state comes from the backend — never
   * from localStorage or React component state — so a page refresh resumes
   * the correct session without creating a duplicate.
   */
  const restoreCurrentSession = useCallback(async () => {
    const deviceId = await getDeviceId().catch(() => null);
    if (!deviceId) return;

    // Ensure a Deaf-user identity exists for this device so the backend can
    // correlate the token with the session.
    try {
      const { session } = await api.getCurrentSession();
      if (!session) return;

      setSessionId(session._id);
      setSessionStatus(session.status as "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED");
      setSessionOwnerId(session.deafUser.toString());

      // Re-fetch teller so the UI can show who the session is with.
      const tellersResp = await api.getTellers();
      const teller = tellersResp.tellers.find(
        (t) => String(t._id) === String(session.teller),
      );
      if (teller) setCurrentTeller(teller);

      // Load persisted messages.
      const { messages: records } = await api.getMessages(session._id);
      const ui = records.map((r: any) => mapBackendMessage(r));
      setMessages(ui);

      if (session.status === "ACTIVE") {
        goToStep(method === "text" ? "text" : "live");
        // Reconnect the socket to the existing session room.
        const token = getAuthToken();
        if (token) {
          connectSocket(token, session._id, {
            onSessionConnected: () => {
              setIsConnected(true);
              if (method !== "text") {
                void initialiseLandmarker();
              }
            },
            onNewMessage: (m) => {
              setMessages((prev) => {
                const alreadyAdded = prev.some((pm) => pm.id === m.id);
                if (alreadyAdded) return prev;
                return [...prev, mapBackendMessage(m)];
              });
            },
            onSessionEnded: () => {
              setIsConnected(false);
              setSessionStatus("ENDED");
              setSessionId(null);
              setCurrentTeller(null);
              setSessionOwnerId(null);
              goToStep("complete");
            },
            onError: (e) => setError(e.message),
            onConnectionChange: (connected) => setIsConnected(connected),
          });
        }
      } else {
        // CONNECTING — waiting for staff to accept.
        goToStep("waiting");
      }
    } catch (err) {
      // Non-fatal: recovery is best-effort. The user can always start a new
      // session from the welcome screen. Try localStorage fallback (Bug 3).
      try {
        const raw = localStorage.getItem("signova.session");
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored.sessionId && stored.tellerId && stored.method) {
            setSessionId(stored.sessionId);
            setSessionStatus("CONNECTING");
            setSessionOwnerId(stored.sessionId);
            setMethod(stored.method);
            // Teller will be re-fetched when the server is back.
          }
        }
      } catch { /* localStorage unavailable or corrupt */ }
      setError(describeError(err));
    }
  }, [method, goToStep, initialiseLandmarker]);

  const setMethod = useCallback((newMethod: CommunicationMethod) => {
    setMethodState(newMethod);
  }, []);

  const setStaff = useCallback((info: StaffInfo) => {
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
    // Accessibility preferences are local for now.
  }, []);

  const updateOrganisation = useCallback(() => {
    // Admin-only on the backend; no-op on the kiosk.
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadOrganisation();
    void loadTellers();
    void restoreCurrentSession();
  }, [loadOrganisation, loadTellers, restoreCurrentSession]);

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
    sessionStatus,
    sessionOwnerId,
    staff,
    joinedTellerId,
    joinedAt,
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
    restoreCurrentSession,
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
    recognitionBackend,
    isRecognising,
    recogniseResult,
    recogniseError,
    isLandmarkerReady,
    isLandmarkerInitialising,
    landmarkerError,
    initialiseLandmarker,
    destroyLandmarker,
    processFrame,
    startRecording,
    stopRecording,
    isRecording,
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
