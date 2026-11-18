import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  Clock,
  HelpCircle,
  Keyboard,
  MessageSquare,
  PhoneOff,
  RotateCcw,
  Send,
  SquareCheck,
  X,
} from "lucide-react";
import { useSession } from "../context/SessionContext";
import { useViewport } from "../hooks/useViewport";
import { useHandRecorder } from "../hooks/useHandRecorder";
import { SIGN_CONFIG, USE_MODEL } from "../config";
import { CLIP_LEN } from "../model/preprocess";
import {
  loadModelMetadata,
  recogniseOnDevice,
  type ModelMetadata,
  type RecogniserResult,
} from "../model/recogniser";
import { drawHandOverlay } from "../components/live/handDrawing";
import { AnimationBlock } from "../components/AnimationBlock";
import type {
  HandInfo,
  HandLandmarksPerFrame,
  Message,
} from "../../../../shared/types/session";
import "./live-signing.css";

interface ReviewState extends RecogniserResult {
  capturedFrames: number;
  durationMs: number;
}

function formatClock(ms: number, compact: boolean): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (compact && hours === 0) return `${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hasAnyHand(frame: HandLandmarksPerFrame | null): boolean {
  return Boolean(
    frame?.handLandmarks.some(
      (hand) => hand?.landmarks && hand.landmarks.length > 0,
    ),
  );
}

function countHands(frame: HandLandmarksPerFrame | null): number {
  if (!frame) return 0;
  return frame.handLandmarks.reduce(
    (count, hand) => count + (hand?.landmarks?.length ? 1 : 0),
    0,
  );
}

function counterTitle(counterNumber: string): string {
  const raw = counterNumber.trim();
  if (!raw) return "Counter";
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? `Counter ${numeric}` : `Counter ${raw}`;
}

function counterMeta(counterNumber: string, serviceDesk: string): string {
  const raw = counterNumber.trim();
  const padded = raw ? raw.padStart(2, "0") : "01";
  return [`Counter ${padded}`, serviceDesk].filter(Boolean).join(" · ");
}

function staffInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "CI";
}

function deliveryLabel(state: "sending" | "sent" | "delivered" | "failed" | undefined): {
  text: string;
  className: string;
  icon: React.ReactNode;
} | null {
  if (!state) return null;
  if (state === "failed") {
    return {
      text: "Failed",
      className: "is-failed",
      icon: <AlertCircle size={11} strokeWidth={2.5} />,
    };
  }
  if (state === "delivered") {
    return {
      text: "Delivered",
      className: "is-delivered",
      icon: <CheckCheck size={12} strokeWidth={2.6} />,
    };
  }
  if (state === "sent") {
    return {
      text: "Sent",
      className: "",
      icon: <Check size={11} strokeWidth={2.6} />,
    };
  }
  return {
    text: "Sending",
    className: "",
    icon: <Clock size={11} strokeWidth={2.5} />,
  };
}

export function LiveSigningScreen() {
  const {
    staff,
    messages,
    goToStep,
    goBack,
    endSession,
    sessionId,
    sessionStatus,
    isConnected,
    joinedAt,
    handLandmarks,
    processFrame,
    initialiseLandmarker,
    isLandmarkerReady,
    isLandmarkerInitialising,
    landmarkerError,
    setFrameListener,
    setRecogniseResult,
    confirmAndSend,
    deliveryStates,
    accessibility,
    retryAnimation,
  } = useSession();

  const { width } = useViewport();
  const isMobileLayout = width < 768;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const frameRef = useRef<HandLandmarksPerFrame | null>(null);
  const handInfosRef = useRef<HandInfo[]>([]);
  const cameraOnRef = useRef(true);
  const activeRecordingRef = useRef(false);
  const firstFrameAtRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const capturedFramesRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const reviewRef = useRef<ReviewState | null>(null);
  const processingRef = useRef(false);
  const metadataRef = useRef<ModelMetadata | null>(null);
  const localStartRef = useRef(Date.now());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const mountedRef = useRef(true);

  const [cameraOn, setCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [recordingActive, setRecordingActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [draft, setDraft] = useState("");
  const [sendingReview, setSendingReview] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [connectingGrace, setConnectingGrace] = useState(true);
  const [, setStatusTick] = useState(0);

  cameraOnRef.current = cameraOn;
  reviewRef.current = review;
  processingRef.current = processing;

  const stableFrameCallback = useCallback(() => undefined, []);
  const stableStopCallback = useCallback(() => undefined, []);
  const {
    start: startRecording,
    stop: stopRecording,
    reset: resetRecording,
    pushFrame,
  } = useHandRecorder(stableFrameCallback, stableStopCallback);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!video || !video.videoWidth || !video.videoHeight) return;

    drawHandOverlay(ctx, frameRef.current, {
      cssWidth,
      cssHeight,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      mirrored: true,
    });
  }, []);

  const resetSequence = useCallback(
    (keepReview: boolean) => {
      activeRecordingRef.current = false;
      firstFrameAtRef.current = null;
      lastFrameAtRef.current = null;
      capturedFramesRef.current = 0;
      resetRecording();
      setRecordingActive(false);
      if (!keepReview) {
        setReview(null);
        setDraft("");
        setRecogniseResult(null);
      }
    },
    [resetRecording, setRecogniseResult],
  );

  useEffect(() => {
    setFrameListener((frame, infos) => {
      frameRef.current = frame;
      handInfosRef.current = infos;

      if (!cameraOnRef.current || processingRef.current || reviewRef.current) return;
      if (performance.now() < cooldownUntilRef.current) return;
      if (!hasAnyHand(frame)) return;

      if (!activeRecordingRef.current) {
        startRecording();
        activeRecordingRef.current = true;
        firstFrameAtRef.current = performance.now();
        lastFrameAtRef.current = firstFrameAtRef.current;
        capturedFramesRef.current = 0;
        setRecordingActive(true);
      }

      pushFrame(frame);
      capturedFramesRef.current = Math.min(
        CLIP_LEN,
        capturedFramesRef.current + 1,
      );
      lastFrameAtRef.current = performance.now();
    });

    return () => setFrameListener(() => undefined);
  }, [setFrameListener, startRecording, pushFrame]);

  useEffect(() => {
    void initialiseLandmarker();
  }, [initialiseLandmarker]);

  useEffect(() => {
    document.body.classList.add("sn-live-scrollable");
    return () => document.body.classList.remove("sn-live-scrollable");
  }, []);

  useEffect(() => {
    if (!cameraOn) return;

    let cancelled = false;
    let localStream: MediaStream | null = null;
    let frameHandle = 0;

    setCameraError(null);
    setCameraReady(false);
    frameRef.current = null;

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera access is not available in this browser. Use HTTPS or localhost, then try again.",
        );
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: isMobileLayout ? 720 : 1280 },
            height: { ideal: isMobileLayout ? 1280 : 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        };
        const media = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = media;

        const video = videoRef.current;
        if (!video) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = media;
        try {
          await video.play();
        } catch {
          if (cancelled) return;
        }

        if (cancelled) return;
        setCameraReady(true);

        const loop = (timestamp: number) => {
          if (cancelled) return;
          const activeVideo = videoRef.current;
          if (activeVideo && activeVideo.readyState >= 2) {
            processFrame(activeVideo, timestamp);
          }
          drawCanvas();
          frameHandle = requestAnimationFrame(loop);
        };
        frameHandle = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        setCameraReady(false);
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraError(
            "Camera permission was denied. Allow camera access in your browser settings, then try again.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCameraError(
            "No camera was found on this device. Connect a camera or continue with text.",
          );
        } else {
          setCameraError(
            (err as Error).message || "The camera could not be started. Try again.",
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      frameRef.current = null;
      clearCanvas();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      setCameraReady(false);
    };
  }, [
    cameraOn,
    cameraRetry,
    isMobileLayout,
    processFrame,
    drawCanvas,
    clearCanvas,
  ]);

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    if (isConnected) {
      setConnectingGrace(false);
      return;
    }
    if (
      sessionStatus !== "ACTIVE" &&
      sessionStatus !== "CONNECTING" &&
      sessionStatus !== null
    ) {
      setConnectingGrace(false);
      return;
    }
    setConnectingGrace(true);
    const handle = window.setTimeout(() => setConnectingGrace(false), 5000);
    return () => window.clearTimeout(handle);
  }, [isConnected, sessionStatus]);

  useEffect(() => {
    if (!recordingActive && !processing) return;
    const handle = window.setInterval(
      () => setStatusTick((value) => value + 1),
      200,
    );
    return () => window.clearInterval(handle);
  }, [recordingActive, processing]);

  useEffect(() => {
    const list = messagesEndRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, conversationOpen]);

  useEffect(() => {
    if (
      messages.length > previousMessageCountRef.current &&
      isMobileLayout &&
      !conversationOpen
    ) {
      setUnread(true);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length, isMobileLayout, conversationOpen]);

  useEffect(() => {
    if (conversationOpen) setUnread(false);
  }, [conversationOpen]);

  useEffect(() => {
    if (!isMobileLayout || !conversationOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileLayout, conversationOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmEnd) {
        setConfirmEnd(false);
        return;
      }
      if (conversationOpen) setConversationOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmEnd, conversationOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleToggleCamera = useCallback(() => {
    if (processingRef.current) return;
    if (cameraOnRef.current) {
      resetSequence(true);
      setActionError(null);
    }
    setCameraOn((value) => !value);
  }, [resetSequence]);

  const handleRetryCamera = useCallback(() => {
    setCameraError(null);
    setCameraOn(true);
    setCameraRetry((value) => value + 1);
  }, []);

  const handleRetryTracking = useCallback(() => {
    setActionError(null);
    void initialiseLandmarker();
  }, [initialiseLandmarker]);

  const handleRedo = useCallback(() => {
    if (processingRef.current) return;
    resetSequence(false);
    cooldownUntilRef.current = 0;
    setActionError(null);
  }, [resetSequence]);

  const handleDiscardReview = useCallback(() => {
    if (sendingReview) return;
    resetSequence(false);
    cooldownUntilRef.current = performance.now() + 700;
    setActionError(null);
  }, [resetSequence, sendingReview]);

  const handleDone = useCallback(async () => {
    if (processingRef.current || reviewRef.current) return;

    if (!activeRecordingRef.current) {
      setActionError(
        "No signing captured yet. Show your hands, sign, then tap Done signing.",
      );
      return;
    }

    activeRecordingRef.current = false;
    setRecordingActive(false);

    const capturedFrames = capturedFramesRef.current;
    const startedAt = firstFrameAtRef.current;
    const endedAt = lastFrameAtRef.current;
    const durationMs =
      startedAt && endedAt ? Math.max(0, endedAt - startedAt) : 0;
    const recording = stopRecording();

    if (!recording || capturedFrames < SIGN_CONFIG.MIN_FRAMES) {
      resetSequence(true);
      cooldownUntilRef.current = 0;
      setActionError(
        "Not enough signing captured. Keep your hands in view a little longer, then try again.",
      );
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setActionError(null);

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (!USE_MODEL) {
        throw new Error(
          "On-device sign recognition is disabled in this build. Enable VITE_USE_MODEL or use text input.",
        );
      }

      let metadata = metadataRef.current;
      if (!metadata) {
        metadata = await loadModelMetadata();
        metadataRef.current = metadata;
      }

      const result = await recogniseOnDevice(recording.sequence, metadata, false);
      if (!result) {
        throw new Error(
          "The on-device recognition model could not be loaded. Try again or use text.",
        );
      }

      const top = result.results[0];
      const next: ReviewState = {
        ...result,
        capturedFrames,
        durationMs,
      };
      setReview(next);
      setRecogniseResult({
        results: result.results,
        timingMs: result.timingMs,
      });
      setDraft(top && top.sign !== "unknown" ? top.sign : "");

      if (!top || top.sign === "unknown") {
        setActionError(
          "This sign was not mapped to a word. Edit the message below or tap Redo to sign again.",
        );
      }
    } catch (err) {
      resetSequence(true);
      cooldownUntilRef.current = 0;
      setActionError(
        (err as Error).message ||
          "Recognition failed. Try again or switch to text input.",
      );
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [resetSequence, setRecogniseResult, stopRecording]);

  const handleSendReview = useCallback(async () => {
    if (!review || sendingReview || !draft.trim()) return;
    if (!sessionId) {
      setActionError("You are not connected to a counter session.");
      return;
    }

    setSendingReview(true);
    setActionError(null);

    try {
      await confirmAndSend(draft.trim());
      resetSequence(false);
      cooldownUntilRef.current = performance.now() + 1400;
    } catch (err) {
      setActionError(
        (err as Error).message || "The message could not be sent. Try again.",
      );
    } finally {
      setSendingReview(false);
    }
  }, [
    review,
    sendingReview,
    draft,
    sessionId,
    confirmAndSend,
    resetSequence,
  ]);

  const handleEndSession = useCallback(async () => {
    setEnding(true);
    try {
      await endSession();
    } finally {
      if (mountedRef.current) setEnding(false);
    }
  }, [endSession]);

  const connectionState: "connected" | "connecting" | "disconnected" =
    sessionStatus === "ACTIVE" && isConnected
      ? "connected"
      : sessionStatus === "CONNECTING" ||
          sessionStatus === null ||
          (sessionStatus === "ACTIVE" && connectingGrace)
        ? "connecting"
        : "disconnected";

  const connectionLabel =
    connectionState === "connected"
      ? "Connected"
      : connectionState === "connecting"
        ? "Connecting"
        : "Disconnected";

  const counterName = counterTitle(staff.counterNumber ?? "");
  const meta = counterMeta(staff.counterNumber ?? "", staff.serviceDesk ?? "");
  const initials = staffInitials(staff.name ?? "");
  const timerStartedAt = joinedAt ?? localStartRef.current;
  const sessionElapsed = Math.max(0, now - timerStartedAt);

  const visibleHands =
    cameraOn && cameraReady && !cameraError
      ? countHands(handLandmarks)
      : 0;
  const capturedFrames = Math.min(capturedFramesRef.current, CLIP_LEN);
  const durationMs =
    firstFrameAtRef.current && lastFrameAtRef.current
      ? Math.max(0, lastFrameAtRef.current - firstFrameAtRef.current)
      : 0;
  const durationSeconds = durationMs / 1000;

  const leftInfo = handInfosRef.current.find(
    (info) => info.slot === 0 && info.landmarks?.length,
  );
  const rightInfo = handInfosRef.current.find(
    (info) => info.slot === 1 && info.landmarks?.length,
  );

  const cameraProblem = Boolean(cameraError);
  const trackingProblem = Boolean(landmarkerError);
  const trackingStarting =
    (!isLandmarkerReady && !trackingProblem) ||
    isLandmarkerInitialising;
  const showReview = review !== null;
  const signingStatus =
    capturedFrames > 0 && !showReview && !processing;

  const primaryPill = !cameraOn
    ? "Camera off"
    : cameraProblem
      ? "Camera unavailable"
      : !cameraReady
        ? "Starting camera…"
        : trackingProblem
          ? "Hand tracking unavailable"
          : trackingStarting
            ? "Starting hand tracking…"
            : visibleHands === 0
              ? "Show your hands to begin signing"
              : `${visibleHands} hand${visibleHands === 1 ? "" : "s"} detected`;

  const statusPill = processing
    ? "Recognising sign…"
    : showReview
      ? "Sign recognised — review and send"
      : signingStatus
        ? visibleHands > 0
          ? `Signing · ${durationSeconds.toFixed(1)} s · ${capturedFrames} frames`
          : `Signing paused · ${capturedFrames} frames`
        : visibleHands > 0
          ? "Ready to sign"
          : "Waiting for hands";

  const mobilePill = !cameraOn
    ? "Camera off"
    : cameraProblem
      ? "Camera unavailable"
      : !cameraReady
        ? "Starting camera…"
        : trackingProblem
          ? "Hand tracking unavailable"
          : trackingStarting
            ? "Starting hand tracking…"
            : processing
              ? "Recognising sign…"
              : showReview
                ? "Sign recognised — review and send"
                : signingStatus
                  ? visibleHands > 0
                    ? `${visibleHands} hand${visibleHands === 1 ? "" : "s"} · Signing ${durationSeconds.toFixed(1)} s`
                    : `${capturedFrames} frames saved · show hands or tap Done`
                  : visibleHands > 0
                    ? "Ready — start signing"
                    : "Show your hands to begin signing";

  const pillTone = cameraProblem || trackingProblem
    ? "sn-camera__pill--error"
    : cameraOn &&
        cameraReady &&
        (visibleHands > 0 || signingStatus || processing || showReview)
      ? "sn-camera__pill--hands"
      : "sn-camera__pill--idle";

  const statusDot = cameraProblem || trackingProblem
    ? "sn-camera__dot sn-camera__dot--idle"
    : processing
      ? "sn-camera__dot sn-camera__dot--processing"
      : signingStatus && visibleHands > 0
        ? "sn-camera__dot sn-camera__dot--recording"
        : visibleHands > 0
          ? "sn-camera__dot"
          : "sn-camera__dot sn-camera__dot--idle";

  const signedSigns = messages.filter(
    (message) => message.sender === "user" && message.method === "sign",
  );
  const latestMessage = messages[messages.length - 1];
  const latestSender = latestMessage
    ? latestMessage.sender === "staff"
      ? counterName
      : latestMessage.method === "sign"
        ? "You (signed)"
        : "You"
    : "";
  const liveBadgeLabel =
    connectionState === "connected"
      ? "Live"
      : connectionState === "connecting"
        ? "Reconnecting"
        : "Offline";
  const reduceMotion = accessibility?.reduceMotion ?? false;
  const dataSaver = accessibility?.dataSaver ?? false;
  const topResult = review?.results[0];
  const confidencePercent = topResult
    ? Math.round(topResult.probability * 100)
    : 0;
  const lowConfidence =
    !topResult ||
    topResult.sign === "unknown" ||
    topResult.probability < SIGN_CONFIG.LOW_CONFIDENCE_THRESHOLD;

  const renderConfidence = (
    info: HandInfo | undefined,
    label: "Left hand" | "Right hand",
  ) => {
    if (!info || !info.landmarks?.length) return null;
    return (
      <span className="sn-camera__confidence">
        {label} <strong>{Math.round(info.score * 100)}%</strong>
      </span>
    );
  };

  const renderMessage = (message: Message) => {
    const isStaff = message.sender === "staff";
    const delivery = deliveryLabel(deliveryStates[message.id]);
    return (
      <div
        key={message.id}
        className={`sn-msg ${isStaff ? "sn-msg--staff" : "sn-msg--user"}`}
      >
        <span className="sn-msg__label">
          {isStaff
            ? counterName
            : message.method === "sign"
              ? "You (signed)"
              : "You"}
        </span>
        <span className="sn-msg__bubble">{message.text}</span>
        {isStaff && message.animation ? (
          <div className="sn-msg__animation">
            <AnimationBlock
              messageId={message.id}
              text={message.text}
              animation={message.animation}
              dataSaver={dataSaver}
              reduceMotion={reduceMotion}
              onRetry={(messageId) =>
                void retryAnimation(sessionId ?? "", messageId)
              }
            />
          </div>
        ) : null}
        <span className="sn-msg__meta">
          {formatMessageTime(message.timestamp)}
          {!isStaff && delivery ? (
            <span className={`sn-msg__status ${delivery.className}`}>
              {delivery.icon}
              {delivery.text}
            </span>
          ) : null}
        </span>
      </div>
    );
  };

  return (
    <div className="sn-live">
      <div className="sn-live-shell">
        <header className="sn-live-header">
          <div className="sn-live-header__identity">
            <button
              type="button"
              className="sn-live-header__back"
              onClick={goBack}
              aria-label="Go back"
            >
              <ArrowLeft size={20} strokeWidth={2.4} />
            </button>
            <div className="sn-live-logo" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
                <path d="M11 11.5V4.5a1.5 1.5 0 0 1 3 0V12" />
                <path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v6" />
                <path d="M17 11.5V8a1.5 1.5 0 0 1 3 0v6.5a7.5 7.5 0 0 1-7.5 7.5H10a6 6 0 0 1-4.8-2.4L2.7 15.2a1.6 1.6 0 0 1 2.4-2.1L8 16" />
              </svg>
            </div>
            <div className="sn-live-header__text">
              <span className="sn-live-header__counter">{counterName}</span>
              <span className="sn-live-header__meta">{meta}</span>
            </div>
          </div>

          <div className="sn-live-header__session">
            <span className={`sn-live-connection is-${connectionState}`}>
              <span
                className="sn-live-connection__dot"
                aria-hidden="true"
              />
              {connectionLabel}
            </span>
            <span className="sn-live-timer" aria-label="Session duration">
              {formatClock(sessionElapsed, isMobileLayout)}
            </span>
          </div>

          <div className="sn-live-header__actions">
            <button
              type="button"
              className="sn-live-header__action"
              onClick={() => goToStep("settings")}
              aria-label="Accessibility settings"
            >
              <Accessibility size={19} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              className="sn-live-header__action"
              onClick={() => goToStep("help")}
              aria-label="Help and guidance"
            >
              <HelpCircle size={19} strokeWidth={2.1} />
            </button>
          </div>
        </header>

        <div className="sn-live-body">
          <main className="sn-live-main">
            <section
              className="sn-camera"
              aria-label="Live camera and hand tracking"
            >
              <div className="sn-camera__stage">
                <video
                  ref={videoRef}
                  className="sn-camera__video"
                  autoPlay
                  playsInline
                  muted
                  aria-label="Live camera feed"
                />
                <canvas
                  ref={canvasRef}
                  className="sn-camera__canvas"
                  aria-label="Hand landmark overlay"
                />

                {!cameraOn || cameraProblem || !cameraReady ? (
                  <div className="sn-camera__placeholder">
                    <svg
                      className="sn-camera__silhouette"
                      viewBox="0 0 240 220"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="120" cy="58" r="40" />
                      <ellipse cx="120" cy="214" rx="104" ry="92" />
                    </svg>
                    <div className="sn-camera__placeholderInner">
                      <div className="sn-camera__placeholderIcon">
                        {cameraOn ? (
                          <Camera size={26} strokeWidth={2} />
                        ) : (
                          <CameraOff size={26} strokeWidth={2} />
                        )}
                      </div>
                      <p className="sn-camera__placeholderTitle">
                        {!cameraOn
                          ? "Camera is off"
                          : cameraProblem
                            ? "Camera unavailable"
                            : "Starting camera…"}
                      </p>
                      <p className="sn-camera__placeholderText">
                        {!cameraOn
                          ? "Turn the camera back on to continue signing."
                          : cameraProblem
                            ? cameraError
                            : "Allow camera access when your browser asks."}
                      </p>
                      {cameraOn && cameraProblem ? (
                        <button
                          type="button"
                          className="sn-camera__placeholderAction"
                          onClick={handleRetryCamera}
                        >
                          Try camera again
                        </button>
                      ) : null}
                      {!cameraOn ? (
                        <button
                          type="button"
                          className="sn-camera__placeholderAction"
                          onClick={handleToggleCamera}
                        >
                          Turn camera on
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {processing ? (
                  <div
                    className="sn-camera__processing"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="sn-camera__processingCard">
                      <span className="sn-live-spinner" />
                      <p className="sn-camera__processingTitle">
                        Recognising your sign…
                      </p>
                      <p className="sn-camera__processingText">
                        Processing {capturedFrames} captured frames
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="sn-camera__top">
                  <div className="sn-camera__pills">
                    {isMobileLayout ? (
                      <span
                        className={`sn-camera__pill ${pillTone}`}
                        role="status"
                      >
                        <span className={statusDot} aria-hidden="true" />
                        <span className="sn-camera__pillText">
                          {mobilePill}
                        </span>
                      </span>
                    ) : (
                      <>
                        <span
                          className={`sn-camera__pill ${
                            cameraProblem || trackingProblem
                              ? "sn-camera__pill--error"
                              : cameraOn && cameraReady
                                ? visibleHands > 0
                                  ? "sn-camera__pill--hands"
                                  : "sn-camera__pill--idle"
                                : "sn-camera__pill--idle"
                          }`}
                          role="status"
                        >
                          <span
                            className={
                              visibleHands > 0
                                ? "sn-camera__dot"
                                : "sn-camera__dot sn-camera__dot--idle"
                            }
                            aria-hidden="true"
                          />
                          {primaryPill}
                        </span>
                        {cameraOn &&
                        cameraReady &&
                        !cameraProblem &&
                        !trackingProblem &&
                        !trackingStarting ? (
                          <span className="sn-camera__pill">
                            <span
                              className={statusDot}
                              aria-hidden="true"
                            />
                            {statusPill}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <span className="sn-camera__counter">
                    <span className="sn-camera__avatar" aria-hidden="true">
                      {initials}
                    </span>
                    {counterName}
                  </span>
                </div>

                <div className="sn-camera__bottom">
                  {cameraOn && cameraReady
                    ? renderConfidence(leftInfo, "Left hand")
                    : null}
                  {cameraOn && cameraReady
                    ? renderConfidence(rightInfo, "Right hand")
                    : null}
                </div>
              </div>
            </section>

            {trackingProblem && cameraOn && cameraReady ? (
              <div className="sn-live-alert" role="alert">
                <AlertCircle size={17} strokeWidth={2.3} />
                <span>
                  Hand tracking could not start. {landmarkerError}
                </span>
                <button
                  type="button"
                  className="sn-live-alert__action"
                  onClick={handleRetryTracking}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {actionError ? (
              <div className="sn-live-alert" role="alert">
                <AlertCircle size={17} strokeWidth={2.3} />
                <span>{actionError}</span>
              </div>
            ) : null}

            <section className="sn-signs" aria-label="Signs so far">
              <span className="sn-signs__title">Signs so far</span>
              <span className="sn-signs__hint">
                Signs you accept appear here.
              </span>
              <div className="sn-signs__chips">
                {signedSigns.length === 0 ? (
                  <span className="sn-signs__empty">
                    No signs accepted yet.
                  </span>
                ) : (
                  signedSigns.slice(-12).map((message) => (
                    <span key={message.id} className="sn-signs__chip">
                      {message.text}
                    </span>
                  ))
                )}
              </div>
            </section>

            {review ? (
              <section className="sn-review" aria-label="Review recognised sign">
                <div className="sn-review__head">
                  <span className="sn-review__eyebrow">
                    Recognised sign
                  </span>
                  <span
                    className={`sn-review__confidence ${
                      lowConfidence ? "is-low" : ""
                    }`}
                  >
                    {topResult && topResult.sign !== "unknown"
                      ? `${confidencePercent}% match`
                      : "Not recognised"}
                  </span>
                </div>
                <textarea
                  className="sn-review__input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type or edit the recognised message"
                  aria-label="Recognised message"
                  rows={2}
                  maxLength={300}
                />
                {lowConfidence ? (
                  <p className="sn-review__note">
                    Low confidence. Edit the text so it matches what you
                    meant, or tap Redo to sign again.
                  </p>
                ) : null}
                <div className="sn-review__actions">
                  <button
                    type="button"
                    className="sn-review__send"
                    onClick={() => void handleSendReview()}
                    disabled={
                      sendingReview || !draft.trim() || !sessionId
                    }
                  >
                    {sendingReview ? (
                      <span className="sn-live-spinner sn-live-spinner--purple" />
                    ) : (
                      <Send size={16} strokeWidth={2.4} />
                    )}
                    {sendingReview ? "Sending…" : "Send to counter"}
                  </button>
                  <button
                    type="button"
                    className="sn-review__discard"
                    onClick={handleDiscardReview}
                    disabled={sendingReview}
                  >
                    Discard
                  </button>
                </div>
              </section>
            ) : null}

            <section className="sn-controls" aria-label="Signing controls">
              <div className="sn-controls__primary">
                <button
                  type="button"
                  className="sn-done"
                  onClick={() => void handleDone()}
                  disabled={processing || showReview}
                >
                  <span className="sn-done__icon" aria-hidden="true">
                    <SquareCheck size={19} strokeWidth={2.4} />
                  </span>
                  <span className="sn-done__text">
                    <strong>Done signing</strong>
                    <small>
                      {processing
                        ? "Processing your sign…"
                        : showReview
                          ? "Review and send your message"
                          : "Tap when you finish the sign"}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="sn-redo"
                  onClick={handleRedo}
                  disabled={processing}
                >
                  <RotateCcw size={18} strokeWidth={2.3} />
                  Redo
                </button>
              </div>

              <div className="sn-controls__secondary">
                <button
                  type="button"
                  className={`sn-round ${cameraOn ? "" : "is-off"}`}
                  onClick={handleToggleCamera}
                  aria-pressed={cameraOn}
                  disabled={processing}
                >
                  <span className="sn-round__icon" aria-hidden="true">
                    {cameraOn ? (
                      <Camera size={23} strokeWidth={2} />
                    ) : (
                      <CameraOff size={23} strokeWidth={2} />
                    )}
                  </span>
                  <span>Camera</span>
                </button>
                <button
                  type="button"
                  className="sn-round"
                  onClick={() => goToStep("text")}
                >
                  <span className="sn-round__icon" aria-hidden="true">
                    <Keyboard size={23} strokeWidth={2} />
                  </span>
                  <span>{isMobileLayout ? "Text" : "Use text"}</span>
                </button>
                <button
                  type="button"
                  className="sn-round sn-round--danger"
                  onClick={() => setConfirmEnd(true)}
                >
                  <span className="sn-round__icon" aria-hidden="true">
                    <PhoneOff size={22} strokeWidth={2.2} />
                  </span>
                  <span>{isMobileLayout ? "End" : "End session"}</span>
                </button>
              </div>
            </section>
          </main>

          <aside
            className={`sn-convo ${
              isMobileLayout
                ? conversationOpen
                  ? "is-open"
                  : "is-collapsed"
                : ""
            }`}
            aria-label="Conversation with counter"
          >
            {isMobileLayout ? (
              <button
                type="button"
                className="sn-convo__handle"
                onClick={() => setConversationOpen((value) => !value)}
                aria-label={
                  conversationOpen
                    ? "Collapse conversation"
                    : "Expand conversation"
                }
                aria-expanded={conversationOpen}
              >
                <span />
              </button>
            ) : null}

            <header className="sn-convo__header">
              <h2 className="sn-convo__title">
                Conversation
                {unread ? (
                  <span className="sn-convo__unread" aria-label="New message" />
                ) : null}
              </h2>
              <span
                className={`sn-convo__live ${
                  connectionState === "connected"
                    ? ""
                    : connectionState === "connecting"
                      ? "is-connecting"
                      : "is-offline"
                }`}
              >
                <span
                  className="sn-convo__liveDot"
                  aria-hidden="true"
                />
                {liveBadgeLabel}
              </span>
              {isMobileLayout ? (
                <button
                  type="button"
                  className="sn-convo__close"
                  onClick={() => setConversationOpen(false)}
                  aria-label="Close conversation"
                >
                  <X size={18} strokeWidth={2.3} />
                </button>
              ) : null}
            </header>

            <div
              className="sn-convo__messages"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              ref={messagesEndRef}
            >
              {messages.length === 0 ? (
                <div className="sn-convo__empty">
                  <MessageSquare
                    size={28}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <p className="sn-convo__emptyTitle">No messages yet</p>
                  <p className="sn-convo__emptyText">
                    Messages from {counterName} and your confirmed signs will
                    appear here.
                  </p>
                </div>
              ) : (
                messages.map(renderMessage)
              )}
            </div>

            {isMobileLayout && !conversationOpen ? (
              <button
                type="button"
                className="sn-convo__preview"
                onClick={() => setConversationOpen(true)}
                aria-label="Open conversation"
              >
                {latestMessage ? (
                  <span className="sn-convo__previewText">
                    <span>{latestSender}:</span> {latestMessage.text}
                  </span>
                ) : (
                  <span className="sn-convo__previewEmpty">
                    No messages yet.
                  </span>
                )}
              </button>
            ) : null}
          </aside>
        </div>
      </div>

      {isMobileLayout && conversationOpen ? (
        <div
          className="sn-convo__backdrop"
          onClick={() => setConversationOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {confirmEnd ? (
        <div
          className="sn-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sn-end-title"
          onClick={() => {
            if (!ending) setConfirmEnd(false);
          }}
        >
          <div className="sn-modal__card" onClick={(event) => event.stopPropagation()}>
            <h2 className="sn-modal__title" id="sn-end-title">
              End session?
            </h2>
            <p className="sn-modal__text">
              This will close the conversation with {counterName} and free the
              counter for the next person.
            </p>
            <div className="sn-modal__actions">
              <button
                type="button"
                className="sn-modal__cancel"
                onClick={() => setConfirmEnd(false)}
                disabled={ending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sn-modal__end"
                onClick={() => void handleEndSession()}
                disabled={ending}
              >
                {ending ? "Ending…" : "End session"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
