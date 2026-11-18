import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RefreshCcw, Expand, Minimize2, AlertCircle, Loader2 } from "lucide-react";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../services/api";

export type AnimationStatus = "pending" | "ready" | "failed" | "skipped";

interface AnimationBlockProps {
  messageId: string;
  text: string;
  captionText?: string;
  animation: {
    status: AnimationStatus;
    url: string | null;
    durationMs: number | null;
    error: string | null;
  } | null;
  dataSaver: boolean;
  reduceMotion: boolean;
  onRetry?: (messageId: string) => void;
}

const SPINNER = (
  <Loader2 size={20} strokeWidth="2.5" style={{ animation: "sn-spin 0.9s linear infinite" }} />
);

function styleVideo(url: string | null) {
  return url ? `${API_BASE_URL}${url}` : null;
}

export function AnimationBlock({
  messageId,
  text,
  captionText,
  animation,
  dataSaver,
  reduceMotion,
  onRetry,
}: AnimationBlockProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [errorShown, setErrorShown] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hasPlayedRef = useRef(false);
  const playbackRateRef = useRef(1);

  const status = animation?.status ?? null;
  const url = animation?.url ?? null;
  const fullUrl = styleVideo(url);
  const caption = captionText ?? "ASL animation (approximate)";

  const isReady = status === "ready" && !!fullUrl;
  const isFailed = status === "failed" || fetchFailed || videoFailed;
  const isPending = status === "pending" || status === null;

  useEffect(() => {
    if (isReady) setShouldLoad(true);
  }, [isReady]);

  useEffect(() => {
    setVideoFailed(false);
    setErrorShown(false);
    hasPlayedRef.current = false;
  }, [fullUrl]);

  useEffect(() => {
    if (!isReady || !shouldLoad || !fullUrl) return;

    let cancelled = false;
    const controller = new AbortController();
    setFetchFailed(false);
    setObjectUrl(null);

    const token = getAuthToken();
    fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Animation request failed (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        setObjectUrl(URL.createObjectURL(blob));
      })
      .catch((err: Error) => {
        if (cancelled || err.name === "AbortError") return;
        setFetchFailed(true);
        setErrorShown(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isReady, shouldLoad, fullUrl, reloadKey]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (isReady && objectUrl && !reduceMotion && !dataSaver && videoRef.current && !hasPlayedRef.current) {
      const video = videoRef.current;
      video.muted = true;
      video.playsInline = true;
      void video.play().then(() => {
        hasPlayedRef.current = true;
        setPlaying(true);
      }).catch(() => {});
    }
  }, [isReady, objectUrl, reduceMotion, dataSaver]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRateRef.current;
      if (playing && !video.paused && !video.ended) {
        void video.play().catch(() => {});
      }
    }
  }, [playing, playbackRateRef.current]);

  const handleLoaded = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRateRef.current;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const handleRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, []);

  const handleRetry = useCallback(() => {
    setErrorShown(false);
    if (fetchFailed) {
      setFetchFailed(false);
      setReloadKey((value) => value + 1);
      return;
    }
    onRetry?.(messageId);
  }, [messageId, onRetry, fetchFailed]);

  const handleEnlarge = useCallback(() => {
    setEnlarged(true);
  }, []);

  const handleCloseEnlarge = useCallback(() => {
    setEnlarged(false);
    const video = videoRef.current;
    if (video) { video.pause(); setPlaying(false); }
  }, []);

  if (isFailed || (status === "skipped" && errorShown)) {
    return (
      <div style={styles.failedContainer} role="alert" aria-live="polite">
        <div style={styles.failedCard}>
          <AlertCircle size={20} style={styles.failedIcon} />
          <div style={styles.failedBody}>
            <p style={styles.failedTitle}>Animation unavailable.</p>
            <p style={styles.failedSub}>Please read the message above.</p>
          </div>
          {onRetry && !videoFailed ? (
            <TouchButtonPress onPress={handleRetry} label="Retry" style={styles.retryButton} />
          ) : null}
        </div>
        <p style={styles.caption}>{caption}</p>
      </div>
    );
  }

  if (!isReady && !isPending) {
    return null;
  }

  const videoContent = (
    <>
      <video
        ref={videoRef}
        src={objectUrl ?? undefined}
        autoPlay={false}
        playsInline
        muted
        onLoadedData={handleLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setErrorShown(true);
          setVideoFailed(true);
        }}
        style={styles.video}
        aria-label={`Signing animation for: ${text}`}
        disablePictureInPicture
      />
      <div style={styles.controls}>
        {!shouldLoad && isReady && (dataSaver || reduceMotion) ? (
          <TouchButtonPress onPress={() => setShouldLoad(true)} label="Play animation" style={styles.playButton} />
        ) : null}
        {shouldLoad && isReady && (
          <>
            <button
              aria-label={playing ? "Pause animation" : "Play animation"}
              onClick={togglePlay}
              style={styles.controlButton}
            >
              {playing ? <Pause size={18} strokeWidth="2.5" /> : <Play size={18} strokeWidth="2.5" />}
            </button>
            <button
              aria-label="Replay animation"
              onClick={handleReplay}
              style={styles.controlButton}
            >
              <RefreshCcw size={18} strokeWidth="2.5" />
            </button>
            <div style={styles.speedGroup}>
              <span style={styles.speedLabel}>Speed</span>
              {[0.5, 1].map((rate) => (
                <button
                  key={rate}
                  aria-label={`Speed ${rate}x`}
                  onClick={() => handleRate(rate)}
                  style={{
                    ...styles.speedButton,
                    ...(Math.abs(playbackRateRef.current - rate) < 0.001 ? styles.speedButtonActive : {}),
                  }}
                >
                  {rate}×
                </button>
              ))}
            </div>
            <button
              aria-label="Enlarge animation"
              onClick={handleEnlarge}
              style={styles.controlButton}
            >
              <Expand size={18} strokeWidth="2.5" />
            </button>
          </>
        )}
      </div>
      <p style={styles.caption}>{caption}</p>
    </>
  );

  if (isReady && shouldLoad && !objectUrl && !fetchFailed) {
    return (
      <div style={styles.pendingContainer} role="status" aria-live="polite">
        <div style={styles.skeleton}>
          <div style={styles.skeletonLine} />
          <div style={styles.skeletonLineShort} />
          <div style={styles.spinner}>{SPINNER}</div>
          <p style={styles.pendingText}>Loading the signing animation…</p>
        </div>
        <p style={styles.caption}>{caption}</p>
      </div>
    );
  }

  if (enlarged) {
    return (
      <div style={styles.enlargeBackdrop} onClick={handleCloseEnlarge}>
        <div style={styles.enlargeCard} onClick={(e) => e.stopPropagation()}>
          <button
            aria-label="Close enlarged animation"
            onClick={handleCloseEnlarge}
            style={styles.closeButton}
          >
            <Minimize2 size={20} strokeWidth="2.5" />
          </button>
          <div style={{ ...styles.videoWrapper, ...styles.enlargeVideoWrapper }}>
            {videoContent}
          </div>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div style={styles.pendingContainer} role="status" aria-live="polite">
        <div style={styles.skeleton}>
          <div style={styles.skeletonLine} />
          <div style={styles.skeletonLineShort} />
          <div style={styles.spinner}>{SPINNER}</div>
          <p style={styles.pendingText}>Preparing the signing animation…</p>
        </div>
        <p style={styles.caption}>{caption}</p>
      </div>
    );
  }

  return (
    <div style={styles.readyContainer}>
      <div style={styles.videoWrapper}>
        {videoContent}
      </div>
    </div>
  );
}

function TouchButtonPress({ onPress, label, style }: { onPress: () => void; label: string; style: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      style={{
        ...styles.retryButtonBase,
        ...style,
        background: "var(--signova-primary)",
        color: "#FFFFFF",
        border: "none",
        borderRadius: "var(--radius-control)",
        fontWeight: 700,
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pendingContainer: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 18,
    background: "var(--cream-card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-card)",
  },
  skeleton: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  skeletonLine: { width: 120, height: 10, background: "var(--lavender)", borderRadius: 6 },
  skeletonLineShort: { width: 80, height: 10, background: "var(--lavender)", borderRadius: 6 },
  spinner: { display: "flex", justifyContent: "center", width: 24, height: 24 },
  pendingText: { margin: 0, fontSize: 14, color: "var(--text-2)" },
  failedContainer: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 16,
    background: "var(--cream-card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-card)",
  },
  failedCard: { display: "flex", alignItems: "center", gap: 10 },
  failedIcon: { color: "var(--danger-text)", flex: "none" },
  failedBody: { display: "flex", flexDirection: "column", gap: 2 },
  failedTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" },
  failedSub: { margin: 0, fontSize: 13, color: "var(--text-2)" },
  retryButton: { minWidth: 70 },
  readyContainer: { width: "100%" },
  videoWrapper: {
    width: "100%", borderRadius: "var(--radius-card)", overflow: "hidden",
    background: "#000000", border: "1px solid var(--border-soft)",
  },
  video: { width: "100%", height: "auto", display: "block", background: "#000000" },
  controls: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10,
    background: "var(--cream-card)", borderTop: "1px solid var(--border-soft)",
  },
  controlButton: {
    background: "transparent", border: "1px solid var(--border-soft)", color: "var(--ink)",
    borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 14,
  },
  playButton: {
    background: "var(--signova-primary)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius-control)",
    padding: "8px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  speedGroup: { display: "flex", alignItems: "center", gap: 6 },
  speedLabel: { fontSize: 12, color: "var(--text-2)", marginRight: 4 },
  speedButton: {
    background: "transparent", border: "1px solid var(--border-soft)", color: "var(--ink)", borderRadius: 6,
    width: 32, height: 28, fontSize: 12, cursor: "pointer", fontWeight: 700,
  },
  speedButtonActive: { background: "var(--signova-primary)", color: "#FFFFFF", borderColor: "var(--signova-primary)" },
  caption: {
    margin: "6px 0 0", padding: "8px 10px", fontSize: 12, lineHeight: 1.45,
    color: "var(--purple-600)", fontWeight: 700, textAlign: "center",
    background: "#F0E5FA", border: "1px solid rgba(96, 43, 145, 0.16)", borderRadius: 10,
  },
  enlargeBackdrop: {
    position: "fixed", inset: 0, zIndex: 200, background: "rgba(30,27,46,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  enlargeCard: {
    position: "relative", width: "min(92vw, 720px)", maxHeight: "min(85vh, 560px)",
    background: "var(--cream-card)", borderRadius: 20, border: "1px solid var(--border-soft)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  },
  closeButton: {
    position: "absolute", top: 10, right: 10, zIndex: 10,
    background: "rgba(255,255,255,0.9)", border: "1px solid var(--border-soft)", color: "var(--ink)",
    borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  enlargeVideoWrapper: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  retryButtonBase: { padding: "8px 14px", marginTop: 6 },
};
