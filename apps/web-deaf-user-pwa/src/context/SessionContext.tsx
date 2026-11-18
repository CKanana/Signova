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
  HandLandmarksPerFrame,
  HandInfo,
  SignLatencyEntry,
} from "../../../../shared/types/session";
import { api, ApiError, setAuthToken, getAuthToken } from "../services/api";
import { connectSocket, disconnectSocket, isConnected as socketIsConnected } from "../services/socket";
import { getDeviceId } from "../services/deviceId";
import { requestTranslation } from "../services/translation";
import type { Teller, TranslateResponse } from "../../../../shared/types/mobile";
import {
  loadOnDeviceRecognizer,
  loadModelMetadata,
  RecogniserBackend,
  type ModelMetadata,
} from "../model/recogniser";
import { useHandLandmarker } from "../hooks/useHandLandmarker";

export const USE_MODEL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_MODEL === "true");
export const USE_MODEL_FOR_UI = USE_MODEL;

const DEFAULT_ORG_PLACEHOLDER: OrganisationInfo = {
  name: "Signova",
  shortName: "S",
  welcomeMessage: "",
  serviceName: "",
  counterLabel: "",
};

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
  dataSaver: false,
};

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
const [accessibility, setAccessibility] = useState<AccessibilitySettings>(DEFAULT_ACCESSIBILITY);

  const [recognitionBackend, setRecognitionBackend] = useState<RecogniserBackend>("mock");
  const [isRecognising] = useState<boolean>(false);
  const [recogniseResult, setRecogniseResultState] = useState<
    | { results: { sign: string; probability: number }[]; timingMs: number }
    | null
  >(null);
  const [recogniseError, setRecogniseError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [deliveryStates, setDeliveryStates] = useState<
    Record<string, "sending" | "sent" | "delivered" | "failed">
  >({});

  const [endedByStaffWhileWaiting] = useState<boolean>(false);

  const [handLandmarks, setHandLandmarks] = useState<HandLandmarksPerFrame | null>(null);

  const frameListenerRef = useRef<((frame: HandLandmarksPerFrame, handInfos: HandInfo[]) => void) | null>(null);

  const latencyLogRef = useRef<SignLatencyEntry[]>([]);
  const debugStatsRef = useRef<{
    fps: number;
    detectMs: number;
    inferMs: number;
    bufferLen: number;
    top5: { sign: string; probability: number }[];
  }>({ fps: 0, detectMs: 0, inferMs: 0, bufferLen: 0, top5: [] });

  const fpsTimesRef = useRef<number[]>([]);
  const detectTimesRef = useRef<number[]>([]);

  useEffect(() => {
    setDebugMode(typeof location !== "undefined" && location.search.includes("debug=1"));
  }, []);

  const setFrameListener = useCallback((cb: (frame: HandLandmarksPerFrame, handInfos: HandInfo[]) => void) => {
    frameListenerRef.current = cb;
  }, []);

  const recordDebugFrame = useCallback((detectMs: number) => {
    const now = performance.now();
    fpsTimesRef.current.push(now);
    detectTimesRef.current.push(detectMs);
    const cutoff = now - 1000;
    while (fpsTimesRef.current.length && fpsTimesRef.current[0] < cutoff) fpsTimesRef.current.shift();
    while (detectTimesRef.current.length && detectTimesRef.current[0] < cutoff) detectTimesRef.current.shift();
    debugStatsRef.current.fps = fpsTimesRef.current.length;
    debugStatsRef.current.detectMs =
      detectTimesRef.current.length > 0
        ? detectTimesRef.current.reduce((a, b) => a + b, 0) / detectTimesRef.current.length
        : 0;
  }, []);

  const recordSignLatency = useCallback((entry: Omit<SignLatencyEntry, "ts">) => {
    latencyLogRef.current.push({ ts: Date.now(), ...entry });
    if (latencyLogRef.current.length > 500) latencyLogRef.current.splice(0, latencyLogRef.current.length - 500);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-any
      (window as any).__signovaLatencyLog = latencyLogRef.current.slice();
    }
  }, []);

  const markLastLatencyAccepted = useCallback((method: "accept" | "chip" | "typed") => {
    const last = latencyLogRef.current[latencyLogRef.current.length - 1];
    if (last) {
      last.accepted = true;
      last.acceptMethod = method;
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-any
        (window as any).__signovaLatencyLog = latencyLogRef.current.slice();
      }
    }
  }, []);

  const exportLatencyCsv = useCallback((): string => {
    const rows = latencyLogRef.current;
    const header =
      "ts,sessionId,state,framesRecorded,handFrames,top1Label,top1Prob,top2Label,top2Prob,top3Label,top3Prob,accepted,acceptMethod,model,signMs,preprocessMs,inferMs,renderMs,resultLatencyMs,valid";
    if (!rows.length) return header + "\n";
    const line = (e: SignLatencyEntry) =>
      [
        e.ts,
        e.sessionId ?? "",
        e.state,
        e.framesRecorded,
        e.handFrames,
        JSON.stringify(e.top1Label ?? ""),
        e.top1Prob ?? "",
        JSON.stringify(e.top2Label ?? ""),
        e.top2Prob ?? "",
        JSON.stringify(e.top3Label ?? ""),
        e.top3Prob ?? "",
        e.accepted ? 1 : 0,
        e.acceptMethod ?? "",
        e.model,
        e.signMs ?? "",
        e.preprocessMs ?? "",
        e.inferMs ?? "",
        e.renderMs ?? "",
        e.resultLatencyMs ?? "",
        e.valid ? 1 : 0,
      ].join(",");
    return [header, ...rows.map(line)].join("\n") + "\n";
  }, []);

  const {
    initialise: initialiseLandmarker,
    destroy: destroyLandmarker,
    isReady: isLandmarkerReady,
    isInitialising: isLandmarkerInitialising,
    error: landmarkerError,
    processFrame,
  } = useHandLandmarker({
    onFrame: (frame, handInfos) => {
      frameListenerRef.current?.(frame, handInfos);
      setHandLandmarks(frame);

      const hands = frame.handLandmarks ?? [];
      const present = hands.some((h) => h !== null && h.landmarks && h.landmarks.length > 0);
      setIsHandsDetected(present);
    },
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

  const setRecogniseResult = useCallback(
    (result: { results: { sign: string; probability: number }[]; timingMs: number } | null) => {
      setRecogniseResultState(result);
    },
    [],
  );

  const acceptSigned = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      setError(null);
      try {
        const confidence = recogniseResult?.results?.[0]?.probability ?? 0;
        const { message } = await api.sendMessage(sessionId, {
          sender: "USER",
          text,
          method: "sign",
          confidence,
          isConfirmed: true,
          inputMethod: "sign",
        });
        const ui = mapBackendMessage(message);
        setMessages((prev) => (prev.some((m) => m.id === ui.id) ? prev : [...prev, ui]));
        setDeliveryStates((prev) => ({ ...prev, [ui.id]: "sent" }));
        setTimeout(() => {
          setDeliveryStates((prev) => ({ ...prev, [ui.id]: "delivered" }));
        }, 800);
        setRecogniseResult(null);
      } catch (err) {
        setError((err as Error).message ?? "Failed to send the signed message.");
        setRecogniseResult(null);
      }
    },
    [sessionId, recogniseResult],
  );

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
        try {
          localStorage.setItem("signova.session", JSON.stringify({
            sessionId: session._id,
            tellerId: teller._id,
            method,
            createdAt: Date.now(),
          }));
          if (accessToken) {
            localStorage.setItem("signova.accessToken", accessToken);
          }
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
      onStaffMessage: (m) => {
        setMessages((prev) => {
          const alreadyAdded = prev.some((pm) => pm.id === m.id);
          if (alreadyAdded) return prev;
          return [...prev, mapBackendMessage(m)];
        });
        setStep((currentStep) => {
          if (currentStep === "live") {
            return "live";
          }
          if (currentStep === "conversation" || currentStep === "text") {
            return "conversation";
          }
          return m.sender === "STAFF" ? "response" : "sent";
        });
      },
      onNewMessage: (m) => {
        setMessages((prev) => {
          const alreadyAdded = prev.some((pm) => pm.id === m.id);
          if (alreadyAdded) return prev;
          return [...prev, mapBackendMessage(m)];
        });
        setStep((currentStep) => {
          if (currentStep === "live") {
            return "live";
          }
          if (currentStep === "conversation" || currentStep === "text") {
            return "conversation";
          }
          return m.sender === "STAFF" ? "response" : "sent";
        });
      },
      onAnimation: (p) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId
              ? {
                  ...m,
                  animation: {
                    status: p.status,
                    url: p.url,
                    durationMs: p.durationMs,
                    requestedAt: m.animation?.requestedAt ?? null,
                    readyAt: m.animation?.readyAt ?? null,
                    error: m.animation?.error ?? null,
                  },
                }
              : m,
          ),
        );
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
        const confidenceValue =
          recogniseResult?.results?.[0]?.probability ?? confidence;
        const { message } = await api.sendMessage(sessionId, {
          sender: "USER",
          text,
          method,
          confidence: confidenceValue || undefined,
          isConfirmed: true,
          inputMethod: method === "text" ? "text" : "sign",
        });
        const ui = mapBackendMessage(message);
        setMessages((prev) => (prev.some((m) => m.id === ui.id) ? prev : [...prev, ui]));
        setDeliveryStates((prev) => ({ ...prev, [ui.id]: "sent" }));
        setTimeout(() => {
          setDeliveryStates((prev) => ({ ...prev, [ui.id]: "delivered" }));
        }, 800);
        goToStep("live");
      } catch (err) {
        setError(describeError(err));
        throw err;
      }
    },
    [sessionId, method, confidence, recogniseResult, goToStep],
  );

  const sendTextMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!sessionId) return;
      setError(null);
      try {
        const { emitMessage } = await import("../services/socket");
        emitMessage(sessionId, { text, method: "text", isConfirmed: true });
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
    try { localStorage.removeItem("signova.session"); } catch { /* noop */ }
    try { localStorage.removeItem("signova.accessToken"); } catch { /* noop */ }
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
    try { localStorage.removeItem("signova.session"); } catch { /* noop */ }
    try { localStorage.removeItem("signova.accessToken"); } catch { /* noop */ }
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

  const restoreCurrentSession = useCallback(async () => {
    const deviceId = await getDeviceId().catch(() => null);
    if (!deviceId) return;
    try {
      const { session } = await api.getCurrentSession();
      if (!session) return;
      setSessionId(session._id);
      setSessionStatus(session.status as "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED");
      setSessionOwnerId(session.deafUser.toString());
      const restoredStart = new Date(session.startedAt).getTime();
      if (Number.isFinite(restoredStart)) {
        setJoinedAt(restoredStart);
      }
      const tellersResp = await api.getTellers();
      const teller = tellersResp.tellers.find(
        (t) => String(t._id) === String(session.teller),
      );
      if (teller) setCurrentTeller(teller);
      const { messages: records } = await api.getMessages(session._id);
      const ui = records.map((r: any) => mapBackendMessage(r));
      setMessages(ui);
      if (session.status === "ACTIVE") {
        goToStep(method === "text" ? "text" : "live");
        const token = getAuthToken();
        if (token) {
          connectSocket(token, session._id, {
            onSessionConnected: () => {
              setIsConnected(true);
              if (method !== "text") {
                void initialiseLandmarker();
              }
            },
            onStaffMessage: (m) => {
              setMessages((prev) => {
                const alreadyAdded = prev.some((pm) => pm.id === m.id);
                if (alreadyAdded) return prev;
                return [...prev, mapBackendMessage(m)];
              });
              setStep((currentStep) => {
                if (currentStep === "live") {
                  return "live";
                }
                if (currentStep === "conversation" || currentStep === "text") {
                  return "conversation";
                }
                return m.sender === "STAFF" ? "response" : "sent";
              });
            },
            onNewMessage: (m) => {
              setMessages((prev) => {
                const alreadyAdded = prev.some((pm) => pm.id === m.id);
                if (alreadyAdded) return prev;
                return [...prev, mapBackendMessage(m)];
              });
            },
            onAnimation: (p) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === p.messageId
                    ? {
                        ...m,
                        animation: {
                          status: p.status,
                          url: p.url,
                          durationMs: p.durationMs,
                          requestedAt: m.animation?.requestedAt ?? null,
                          readyAt: m.animation?.readyAt ?? null,
                          error: m.animation?.error ?? null,
                        },
                      }
                    : m,
                ),
              );
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
        goToStep("waiting");
      }
    } catch (err) {
      try {
        const raw = localStorage.getItem("signova.session");
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored.sessionId && stored.tellerId && stored.method) {
            setSessionId(stored.sessionId);
            setSessionStatus("CONNECTING");
            setSessionOwnerId(stored.sessionId);
            setMethod(stored.method);
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

  const retryAnimation = useCallback(async (sessionId: string, messageId: string) => {
    await api.retryAnimation(sessionId, messageId);
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

  const updateAccessibility = useCallback((settings: Partial<AccessibilitySettings>) => {
    setAccessibility((prev) => ({ ...prev, ...settings }));
  }, []);

  const updateOrganisation = useCallback(() => {
    // Accessibility preferences are local for now.
  }, []);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    try {
      const storedToken = localStorage.getItem("signova.accessToken");
      if (storedToken) setAuthToken(storedToken);
    } catch { /* localStorage unavailable */ }
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
    handLandmarks,
    isConnected,
    sessionId,
    sessionStatus,
    sessionOwnerId,
    staff: staffFromTeller(currentTeller),
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
    retryAnimation,
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
    debugMode,
    debugStats: debugStatsRef.current,
    setFrameListener,
    recordDebugFrame,
    exportLatencyCsv,
    recordSignLatency,
    markLastLatencyAccepted,
    setRecogniseResult,
    deliveryStates,
    acceptSigned,
    endedByStaffWhileWaiting,
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
  animationUrl?: string | null;
  generationStatus?: "pending" | "generating" | "completed" | "failed";
  animation?: {
    status: "pending" | "ready" | "failed" | "skipped";
    url: string | null;
    durationMs: number | null;
    requestedAt: string | null;
    readyAt: string | null;
    error: string | null;
  } | null;
}): UiMessage {
  return {
    id: (m.id ?? m._id) as string,
    sender: m.sender === "USER" ? "user" : "staff",
    text: m.text,
    timestamp: m.timestamp,
    method: m.method as UiMessage["method"],
    confidence: m.confidence,
    animationUrl: m.animationUrl ?? null,
    generationStatus: m.generationStatus ?? "pending",
    animation:
      m.animation ??
      (m.animationUrl
        ? {
            status:
              m.generationStatus === "failed"
                ? "failed"
                : m.generationStatus === "pending" ||
                    m.generationStatus === "generating"
                  ? "pending"
                  : "ready",
            url: m.animationUrl,
            durationMs: null,
            requestedAt: null,
            readyAt: null,
            error: null,
          }
        : null),
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
