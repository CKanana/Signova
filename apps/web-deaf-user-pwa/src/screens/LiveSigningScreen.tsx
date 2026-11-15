import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { CameraOff, Play, StopCircle, Shield, RotateCcw, CheckCircle, XCircle, Users, HelpCircle, Phone } from "lucide-react";
import { useViewport } from "../hooks/useViewport";
import { USE_MODEL } from "../config";

export function LiveSigningScreen() {
  const {
    staff,
    messages,
    sendMessage,
    goToStep,
    goBack,
    isRecording,
    startRecording,
    stopRecording,
    resetRecorder,
    isHandsDetected,
    recognitionBackend,
    recogniseResult,
    isConnected,
    endSession,
  } = useSession();

  const { isTablet } = useViewport();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [lowLight, setLowLight] = useState(false);
  const [handsNotDetected, setHandsNotDetected] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const tellerName = staff?.name ?? "Staff member";
  const counterNumber = staff?.counterNumber ?? "1";

  // ---- Camera ----
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve();
          void videoRef.current.play();
        } else resolve();
      });
      setIsCameraReady(true);
      setSessionStartTime(Date.now());
    } catch (err) {
      setCameraError("Camera access is required to sign. Please allow camera access and refresh.");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraReady(false);
    };
  }, [startCamera]);

  useEffect(() => {
    if (!isCameraReady || !videoRef.current) return;
    startTimeRef.current = performance.now();
    const tick = (now: number) => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Frame processing handled by SessionContext's useHandRecorder
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isCameraReady]);

  // ---- Timer ----
  const timerText = sessionStartTime
    ? new Date(Date.now() - sessionStartTime).toISOString().substr(11, 8)
    : "00:00:00";

  const handleToggleCamera = () => {
    setIsPaused((p) => !p);
  };

  const handleSwitchCamera = () => {
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 500);
  };

  const handleStartRecord = useCallback(() => {
    resetRecorder();
    startRecording();
  }, [resetRecorder, startRecording]);

  const handleStopRecord = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const recordLabel = isRecording ? "Stop recording" : "Start recording";
  const recordIcon = isRecording ? <StopCircle size={26} color="#FFFFFF" /> : <Play size={26} color="#FFFFFF" />;

  // Show controls briefly on mount, then hide (tap to show would need touch handler)
  useEffect(() => {
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* Header — solid purple bar, teller name, connection status, timer. */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            type="button"
            aria-label="Back to waiting"
            onClick={() => goToStep("waiting")}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>
          <div style={styles.tellerInfo}>
            <span style={styles.tellerName}>{tellerName}</span>
            <span style={styles.tellerCounter}>Counter {counterNumber}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.connectionStatus}>
            {isConnected ? "Connected" : "Connecting…"}
          </span>
          <span style={styles.timer}>{timerText}</span>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            aria-label="Accessibility settings"
            style={styles.iconButton}
          >
            <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 18H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
              <circle cx="11" cy="13" r="6" />
              <path d="M9 7h6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Help and guidance"
            style={styles.iconButton}
          >
            <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 18" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Camera hero — fills viewport. */}
      <div style={mergeStyles(styles.cameraWrapper, isTablet && styles.cameraWrapperTablet)}>
        {/* Desktop: centred rounded frame with purple border. */}
        {!isTablet && (
          <div style={styles.mobileCameraFrame}>
            <div style={mergeStyles(styles.cameraFrame, { height: "100%" })}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
            </div>
          </div>
        )}
        {isTablet && (
          <div style={mergeStyles(styles.cameraFrame, { height: "100%" })}>
            <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
          </div>
        )}

        {/* Teller PiP — small, never covers signing area. */}
        <div style={styles.pip}>
          <div style={styles.pipAvatar}>
            {tellerName.split(" ").map((p) => p[0]).join("")}
          </div>
          <span style={styles.pipName}>{tellerName}</span>
        </div>

        {/* Overlay — hands indicator + status. */}
        <div style={styles.cameraOverlay}>
          <div style={styles.handsRow}>
            <div style={mergeStyles(styles.statusDot, isHandsDetected && styles.statusDotActive)} />
            <span style={mergeStyles(styles.handsText, isHandsDetected && styles.handsTextActive)}>
              {isHandsDetected ? "Hands detected" : "Position your hands"}
            </span>
          </div>
        </div>

        {/* Camera error / placeholder. */}
        {cameraError && (
          <div style={styles.cameraErrorBanner}>
            <Shield size={20} color="var(--danger-text)" />
            <span style={styles.cameraErrorText}>{cameraError}</span>
            <TouchButton variant="outline" size="sm" onPress={() => setCameraError(null)} style={styles.errorDismiss}>
              Dismiss
            </TouchButton>
          </div>
        )}
        {!cameraError && !isCameraReady && (
          <div style={styles.cameraPlaceholder}>
            <CameraOff size={56} color="var(--text-2)" />
            <span style={styles.cameraPlaceholderText}>Starting camera…</span>
          </div>
        )}

        {/* State banners. */}
        {reconnecting && (
          <div style={mergeStyles(styles.stateBanner, styles.stateBannerReconnect)}>
            <Users size={18} color="var(--warning-text)" />
            <span style={styles.stateBannerText}>Reconnecting…</span>
          </div>
        )}
        {!reconnecting && lowLight && (
          <div style={mergeStyles(styles.stateBanner, styles.stateBannerLowLight)}>
            <Phone size={18} color="var(--warning-text)" />
            <span style={styles.stateBannerText}>Low light detected — move to a brighter area.</span>
          </div>
        )}
        {!reconnecting && !lowLight && handsNotDetected && !isHandsDetected && (
          <div style={mergeStyles(styles.stateBanner, styles.stateBannerHands)}>
            <Users size={18} color="var(--purple-600)" />
            <span style={styles.stateBannerText}>Position your hands in the frame.</span>
          </div>
        )}

        {/* Recognition feedback — subtle glow ring. */}
        {recogniseResult?.results[0] && !isRecording && (
          <div style={styles.recognitionFeedback}>
            <span className="sn-glow-ring" aria-hidden={true} />
            <span style={styles.recognitionText}>
              “{recogniseResult.results[0].sign}”
              {recogniseResult.results[0].probability < 0.4 && (
                <span style={styles.recognitionConfidence}>
                  &middot; {Math.round(recogniseResult.results[0].probability * 100)}% confidence
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Caption / conversation panel — cream card, 20px+ ink text, auto-scroll. */}
      <div style={styles.captionPanel}>
        <div style={styles.captionHeader}>
          <span style={styles.captionTitle}>Conversation</span>
          {isHandsDetected && !isRecording && (
            <span style={mergeStyles(styles.statusDot, styles.statusDotActive)} />
          )}
        </div>
        <div style={styles.messages}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={mergeStyles(
                styles.bubble,
                m.sender === "user" && styles.bubbleUser,
                m.sender === "staff" && styles.bubbleStaff,
              )}
            >
              <span style={mergeStyles(styles.bubbleText, m.sender === "staff" && styles.bubbleStaffText)}>
                {m.text}
              </span>
            </div>
          ))}
          {recogniseResult?.results[0] && !isRecording && (
            <div style={mergeStyles(styles.bubble, styles.bubbleUser)}>
              <span style={styles.bubbleText}>
                “{recogniseResult.results[0].sign}”
              </span>
              <span style={styles.meta}>
                Detected &middot; {Math.round(recogniseResult.results[0].probability * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control dock — 56px buttons, icon + text. */}
      <div style={mergeStyles(styles.controls, showControls ? styles.controlsVisible : styles.controlsHidden)}>
        <div style={styles.controlRow}>
          <TouchButton
            variant="outline"
            size="touch"
            onPress={handleToggleCamera}
            disabled={!isCameraReady}
            aria-label={isPaused ? "Resume camera" : "Pause camera"}
            style={mergeStyles(styles.controlPill, styles.controlPillMuted)}
          >
            <Users size={18} />
            <span style={styles.controlLabel}>{isPaused ? "Resume camera" : "Mute camera"}</span>
          </TouchButton>
          <TouchButton
            variant="outline"
            size="touch"
            onPress={handleSwitchCamera}
            disabled={!isCameraReady}
            aria-label="Switch camera"
            style={mergeStyles(styles.controlPill, styles.controlPillMuted)}
          >
            <CameraOff size={18} />
            <span style={styles.controlLabel}>Switch camera</span>
          </TouchButton>
        </div>
        <div style={styles.controlRow}>
          <TouchButton
            variant={isRecording ? "danger" : "primary"}
            size="touch"
            onPress={isRecording ? handleStopRecord : handleStartRecord}
            disabled={!isCameraReady}
            accessibilityLabel={recordLabel}
            leftIcon={recordIcon}
            style={styles.recordButton}
          >
            {recordLabel}
          </TouchButton>
          {isRecording && (
            <TouchButton
              variant="danger"
              size="touch"
              onPress={handleStopRecord}
              disabled={!isCameraReady}
              rightIcon={<XCircle size={18} color="#FFFFFF" />}
              style={styles.stopSendButton}
            >
              Stop &amp; send
            </TouchButton>
          )}
        </div>
        <div style={styles.controlRow}>
          <TouchButton
            variant="danger"
            size="touch"
            onPress={() => void endSession()}
            disabled={!isCameraReady}
            aria-label="End session"
            style={mergeStyles(styles.controlPill, styles.controlPillDanger)}
          >
            <Shield size={18} color="#FFFFFF" />
            <span style={styles.controlLabel}>End session</span>
          </TouchButton>
          <TouchButton
            variant="outline"
            size="touch"
            onPress={() => goToStep("text")}
            disabled={!isCameraReady}
            aria-label="Switch to text"
            style={mergeStyles(styles.controlPill, styles.controlPillMuted)}
          >
            <HelpCircle size={18} />
            <span style={styles.controlLabel}>Switch to text</span>
          </TouchButton>
          <TouchButton
            variant="outline"
            size="touch"
            onPress={() => goToStep("help")}
            disabled={!isCameraReady}
            aria-label="Help and guidance"
            style={mergeStyles(styles.controlPill, styles.controlPillMuted)}
          >
            <HelpCircle size={18} />
            <span style={styles.controlLabel}>Help</span>
          </TouchButton>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--cornsilk)",
    fontFamily: "var(--font-family)",
    color: "var(--ink)",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
  } as React.CSSProperties,
  header: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
    padding: "calc(var(--space-2) + var(--safe-top)) var(--space-4)",
    borderBottom: "1px solid var(--border-ctl)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexShrink: 0,
  } as React.CSSProperties,
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  backButton: {
    background: "rgba(255,255,255,0.15)",
    border: "2px solid rgba(255,255,255,0.35)",
    borderRadius: "var(--radius-control)",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#FFFFFF",
    flexShrink: 0,
  } as React.CSSProperties,
  tellerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  tellerName: {
    fontSize: 16,
    fontWeight: 800,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  tellerCounter: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  } as React.CSSProperties,
  connectionStatus: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--success-dot)",
  } as React.CSSProperties,
  timer: {
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    fontFamily: '"Courier New", monospace',
  } as React.CSSProperties,
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  } as React.CSSProperties,
  iconButton: {
    background: "rgba(255,255,255,0.15)",
    border: "2px solid rgba(255,255,255,0.35)",
    borderRadius: "var(--radius-control)",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#FFFFFF",
    transition: "background 0.15s, border-color 0.15s",
  } as React.CSSProperties,

  // Camera wrapper.
  cameraWrapper: {
    position: "relative",
    width: "100%",
    flex: 1,
    minHeight: 0,
    background: "var(--cornsilk)",
    overflow: "hidden",
  } as React.CSSProperties,
  cameraWrapperTablet: {
    padding: "0 var(--space-5)",
  } as React.CSSProperties,
  mobileCameraFrame: {
    width: "100%",
    height: "100%",
    background: "#000000",
  } as React.CSSProperties,
  cameraFrame: {
    position: "relative",
    width: "100%",
    height: "100%",
    background: "#000000",
    borderRadius: "var(--radius-card)",
    border: "3px solid var(--purple-600)",
    overflow: "hidden",
    boxShadow: "var(--shadow)",
    margin: "0 auto",
    maxWidth: 720,
    maxHeight: 640,
  } as React.CSSProperties,

  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  } as React.CSSProperties,

  pip: {
    position: "absolute",
    top: "var(--safe-top)",
    right: "var(--safe-right)",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,
  pipAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--purple-600)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 12,
    textTransform: "uppercase",
    flexShrink: 0,
  } as React.CSSProperties,
  pipName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "0 1px 4px rgba(0,0,0,0.45)",
  } as React.CSSProperties,

  cameraOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-4)",
    pointerEvents: "none",
    zIndex: 5,
  } as React.CSSProperties,
  handsRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--border-soft)",
    flexShrink: 0,
  } as React.CSSProperties,
  statusDotActive: {
    background: "var(--success-dot)",
    boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.35)",
  } as React.CSSProperties,
  handsText: {
    fontSize: 13,
    fontWeight: 800,
    color: "var(--text-2)",
  } as React.CSSProperties,
  handsTextActive: {
    color: "var(--success-dot)",
  } as React.CSSProperties,

  // State banners.
  stateBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: "var(--radius-control)",
    background: "var(--lavender)",
    border: "1px solid var(--border-soft)",
    color: "var(--ink)",
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 12,
  } as React.CSSProperties,
  stateBannerReconnect: {
    background: "var(--warning-bg)",
    borderColor: "var(--warning-bg)",
    color: "var(--warning-text)",
  } as React.CSSProperties,
  stateBannerLowLight: {
    background: "var(--warning-bg)",
    borderColor: "var(--warning-bg)",
    color: "var(--warning-text)",
  } as React.CSSProperties,
  stateBannerHands: {
    background: "var(--lavender)",
    borderColor: "var(--border-soft)",
    color: "var(--ink)",
  } as React.CSSProperties,
  stateBannerText: {
    margin: 0,
  } as React.CSSProperties,

  // Recognition feedback.
  recognitionFeedback: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: "var(--radius-pill)",
    background: "rgba(var(--purple-600-rgb), 0.10)",
    border: "1px solid var(--purple-600)",
    color: "var(--purple-600)",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    maxWidth: 300,
    alignSelf: "center",
    marginBottom: 12,
  } as React.CSSProperties,
  recognitionText: {
    fontWeight: 700,
    color: "var(--ink)",
  } as React.CSSProperties,
  recognitionConfidence: {
    fontWeight: 700,
    color: "var(--warning-text)",
  } as React.CSSProperties,

  // Error / placeholder.
  cameraErrorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-bg)",
    color: "var(--danger-text)",
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 420,
    alignSelf: "center",
    marginBottom: 12,
  } as React.CSSProperties,
  cameraErrorText: {
    flex: 1,
    margin: 0,
  } as React.CSSProperties,
  errorDismiss: {
    fontSize: 12,
    marginLeft: 8,
  } as React.CSSProperties,
  cameraPlaceholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#000000",
    zIndex: 2,
  } as React.CSSProperties,
  cameraPlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: "var(--text-2)",
    fontWeight: 500,
  } as React.CSSProperties,

  // Caption panel.
  captionPanel: {
    flex: 1,
    minHeight: 0,
    background: "var(--cream-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow)",
    margin: "0 var(--space-4) var(--space-5) var(--space-4)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } as React.CSSProperties,
  captionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-soft)",
    background: "var(--lavender)",
  } as React.CSSProperties,
  captionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--purple-800)",
    margin: 0,
  } as React.CSSProperties,
  messages: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "12px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } as React.CSSProperties,
  bubble: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxWidth: "85%",
    padding: "4px 0",
  } as React.CSSProperties,
  bubbleUser: { alignSelf: "flex-end" } as React.CSSProperties,
  bubbleStaff: { alignSelf: "flex-start" } as React.CSSProperties,
  bubbleText: {
    padding: "9px 13px",
    borderRadius: 14,
    fontSize: 16,
    lineHeight: 1.5,
    wordBreak: "break-word",
  } as React.CSSProperties,
  bubbleUserText: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
    marginLeft: "auto",
    borderRadius: "14px 14px 14px 4px",
  } as React.CSSProperties,
  bubbleStaffText: {
    background: "var(--cream-card)",
    color: "var(--ink)",
    border: "1px solid var(--border-soft)",
    marginRight: "auto",
    borderRadius: "14px 14px 4px 14px",
  } as React.CSSProperties,
  meta: {
    fontSize: 11,
    color: "var(--text-2)",
    alignSelf: "flex-end",
    marginTop: 2,
  } as React.CSSProperties,

  // Control dock.
  controls: {
    position: "relative",
    background: "var(--cream-card)",
    borderTop: "1px solid var(--border-soft)",
    padding: "12px var(--space-4) calc(var(--space-4) + var(--safe-bottom))",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
    zIndex: 20,
    transition: "transform 0.3s ease, opacity 0.3s ease",
  } as React.CSSProperties,
  controlsVisible: {
    transform: "translateY(0)",
    opacity: 1,
  } as React.CSSProperties,
  controlsHidden: {
    transform: "translateY(100%)",
    opacity: 0,
    pointerEvents: "none",
  } as React.CSSProperties,
  controlRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  } as React.CSSProperties,
  controlPill: {
    minHeight: 56,
    borderRadius: "var(--radius-pill)",
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  controlPillMuted: {
    background: "var(--surface)",
    border: "2px solid var(--border-ctl)",
    color: "var(--purple-600)",
  } as React.CSSProperties,
  controlPillDanger: {
    background: "var(--danger-bg)",
    color: "var(--danger-text)",
  } as React.CSSProperties,
  controlLabel: {
    fontSize: 14,
    fontWeight: 700,
  } as React.CSSProperties,
  recordButton: {
    minHeight: 56,
    borderRadius: "var(--radius-pill)",
  } as React.CSSProperties,
  stopSendButton: {
    minHeight: 56,
    borderRadius: "var(--radius-pill)",
  } as React.CSSProperties,
};

function mergeStyles<T extends Record<string, any>>(
  ...styles: (T | undefined | null)[]
): T {
  const result: Partial<T> = {};
  for (const s of styles) {
    if (s) Object.assign(result, s);
  }
  return result as T;
}
