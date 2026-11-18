import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Film,
  Hand,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useSession } from "../../context/SessionContext";
import { AnimationBlock } from "../AnimationBlock";
import { SignovaAvatar } from "./SignovaAvatar";
import { loadSignPose } from "./poseClient";
import { buildMappedFrames, getAvatarPoseAt } from "./poseMapping";
import { usePosePlayback } from "./usePosePlayback";
import type { Message } from "../../../../../shared/types/session";
import type { SignPoseSequence } from "../../../../../shared/types/signPose";
import "./avatar-player.css";

interface SignovaAvatarPlayerProps {
  message: Message;
  dataSaver: boolean;
  reduceMotion: boolean;
  onRetry: (messageId: string) => void;
}

export function SignovaAvatarPlayer({
  message,
  dataSaver,
  reduceMotion,
  onRetry,
}: SignovaAvatarPlayerProps) {
  const { sessionId, accessibility } = useSession();
  const prefersReducedMotion =
    reduceMotion || accessibility?.reduceMotion === true;
  const [pose, setPose] = useState<SignPoseSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPose(null);

    if (!sessionId) {
      setLoading(false);
      setError("This session is no longer available.");
      return;
    }

    loadSignPose(sessionId, message.id)
      .then((sequence) => {
        if (cancelled) return;
        if (!sequence.frames.length) {
          setError("The signing service returned no poses for this message.");
          return;
        }
        setPose(sequence);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "The 2D sign could not be prepared.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, message.id, retryKey]);

  const mappedFrames = useMemo(
    () => (pose ? buildMappedFrames(pose) : []),
    [pose],
  );
  const playback = usePosePlayback({
    pose,
    autoPlay: true,
    reduceMotion: prefersReducedMotion,
  });
  const avatarPose = useMemo(
    () => getAvatarPoseAt(mappedFrames, playback.position),
    [mappedFrames, playback.position],
  );

  const hasVideoFallback = Boolean(
    message.animation && message.animation.status !== "skipped",
  );
  const gloss =
    pose?.glosses?.join(" · ") ?? message.text;
  const missingLetters = [
    ...new Set((pose?.droppedLetters ?? []).map((item) => item.letter)),
  ];
  const missingLetterWords = [
    ...new Set((pose?.droppedLetters ?? []).map((item) => item.word)),
  ];
  const status = loading
    ? "PREPARING"
    : error
      ? hasVideoFallback
        ? "VIDEO FALLBACK"
        : "UNAVAILABLE"
      : playback.playing
        ? "PLAYING"
        : "READY";
  const statusTone = loading
    ? "pending"
    : error
      ? "failed"
      : playback.playing
        ? "playing"
        : "ready";
  const caption = pose?.text || message.text;

  const retryPose = () => setRetryKey((value) => value + 1);

  return (
    <div className="sn-avatar-card">
      <div className="sn-avatar-card__head">
        <span className="sn-avatar-card__tag">
          <Hand size={12} strokeWidth={2.4} aria-hidden="true" />
          2D SIGN
        </span>
        <span className="sn-avatar-card__gloss" title={gloss}>
          {gloss}
        </span>
        <span className={`sn-avatar-card__status is-${statusTone}`}>
          {status}
        </span>
      </div>

      {loading ? (
        <>
          <div className="sn-avatar-loading" role="status" aria-live="polite">
            <span className="sn-avatar-spinner" aria-hidden="true" />
            <p className="sn-avatar-loading__title">Preparing 2D sign…</p>
            <p className="sn-avatar-loading__text">
              Signova is loading the signing sequence for this message.
            </p>
          </div>
          <div className="sn-avatar-caption">
            <span className="sn-avatar-caption__label">Message</span>
            <p className="sn-avatar-caption__text">{message.text}</p>
          </div>
        </>
      ) : error ? (
        <>
          <div className="sn-avatar-error">
            <span className="sn-avatar-error__icon" aria-hidden="true">
              <AlertCircle size={22} strokeWidth={2.1} />
            </span>
            <p className="sn-avatar-error__title">2D sign unavailable</p>
            <p className="sn-avatar-error__text">{error}</p>
            <button
              type="button"
              className="sn-avatar-btn sn-avatar-btn--outline"
              onClick={retryPose}
            >
              <RefreshCw size={15} strokeWidth={2.4} />
              Try avatar again
            </button>
          </div>

          {hasVideoFallback ? (
            <div className="sn-avatar-videoFallback">
              <p className="sn-avatar-videoFallback__label">
                <Film size={14} strokeWidth={2.2} />
                SignBridge video fallback
              </p>
              <AnimationBlock
                messageId={message.id}
                text={message.text}
                captionText={message.text}
                animation={message.animation ?? null}
                dataSaver={dataSaver}
                reduceMotion={reduceMotion}
                onRetry={onRetry}
              />
            </div>
          ) : (
            <div className="sn-avatar-caption">
              <span className="sn-avatar-caption__label">Message</span>
              <p className="sn-avatar-caption__text">{message.text}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className="sn-avatar-stage"
            role="img"
            aria-label={`Signova 2D signer for: ${caption}`}
          >
            {avatarPose ? <SignovaAvatar pose={avatarPose} /> : null}
          </div>
          <div className="sn-avatar-caption">
            <span className="sn-avatar-caption__label">Caption</span>
            <p className="sn-avatar-caption__text">{caption}</p>
          </div>
          <div className="sn-avatar-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(playback.progress * 100)}%` }} />
          </div>
          <div className="sn-avatar-meta">
            <span>
              {(pose!.durationMs / 1000).toFixed(1)}s · {pose!.frameCount} frames
            </span>
            <span>Signova 2D signer</span>
          </div>
          <div className="sn-avatar-controls">
            <button
              type="button"
              className="sn-avatar-btn sn-avatar-btn--primary"
              onClick={playback.playing ? playback.pause : playback.play}
            >
              {playback.playing ? (
                <Pause size={16} strokeWidth={2.3} />
              ) : (
                <Play size={16} strokeWidth={2.3} />
              )}
              {playback.playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="sn-avatar-btn sn-avatar-btn--outline"
              onClick={playback.replay}
            >
              <RotateCcw size={15} strokeWidth={2.3} />
              Replay
            </button>
          </div>
          {missingLetters.length > 0 ? (
            <div className="sn-avatar-missing">
              No SignBridge pose for letter
              {missingLetters.length === 1 ? "" : "s"} {missingLetters.join(", ")}
              {missingLetterWords.length > 0
                ? ` in ${missingLetterWords.map((word) => `“${word}”`).join(", ")}`
                : ""}
              . Those letters are skipped in the animation; the full message
              remains in the caption.
            </div>
          ) : null}
          {pose!.droppedWords.length > 0 ? (
            <div className="sn-avatar-missing">
              No SignBridge pose for: {pose!.droppedWords.join(", ")}. Those
              words are skipped in the animation and remain in the caption.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

