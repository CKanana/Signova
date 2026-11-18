import { useCallback, useEffect } from "react";
import { useReplyRouter } from "../context/ReplyRouterContext";
import { Player } from "../components/Player";
import { Calendar, X } from "../components/ui/Icons";
import { TouchButton } from "../components/ui/TouchButton";

export type AnimationStatus = "pending" | "ready" | "failed" | "skipped";

interface TellerMessageWithAnimation {
  id: string;
  sender: "staff" | "user";
  text: string;
  timestamp: string;
  animation?: {
    status: AnimationStatus;
    url: string | null;
    durationMs: number | null;
    requestedAt: string | null;
    readyAt: string | null;
    error: string | null;
  } | null;
}

/** A queue of messages waiting to be displayed (e.g. two paged requests). */
export type TellerMessageQueue = TellerMessageWithAnimation[];

interface TellerMessagePopupProps {
  message: TellerMessageWithAnimation;
  /** Zero-based index of this message in the current queue batch. */
  queueIndex: number;
  /** The current queue (so the pager can step). */
  queue: TellerMessageWithAnimation[];
  /** When a new message arrives while open, call with the new message. */
  onMessageUpdated?: (message: TellerMessageWithAnimation) => void;
  /** Close the popup (parent handles focus return). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "11:30 PM" from a Date or ISO timestamp. */
function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TellerMessagePopup({
  message,
  queueIndex,
  queue,
  onMessageUpdated,
  onClose,
}: TellerMessagePopupProps) {
  const { replyText, setRoute, clearReplyText } = useReplyRouter();

  // Capture the current message so the player sees fresh data.
  const currentMessage = queue[queueIndex] ?? message;

  // "message:animation" arrives while open -> update live.
  useEffect(() => {
    const watch = (e: Event) => {
      const ev = e as CustomEvent<{ messageId: string; status: AnimationStatus; url: string | null }>;
      if (ev.detail?.messageId === currentMessage.id) {
        // Player owns its own status; this is a no-op but kept for API compat.
        void ev.detail.status;
      }
    };
    window.addEventListener("message:animation", watch);
    return () => window.removeEventListener("message:animation", watch);
  }, [currentMessage.id]);

  // ---- Reply in sign (from camera) ----
  const handleReplyInSign = useCallback(() => {
    // Fade out is handled by the parent (the pop-up unmounts/blurs).
    // We set the reply chip on the camera screen via the context.
    clearReplyText();
    // Request reply in sign; the camera screen listens and switches route.
    // We also send a global event so the camera screen can pick it up
    // regardless of whether it is listening to this component.
    window.dispatchEvent(
      new CustomEvent("signova:reply-in-sign", {
        detail: { text: replyText || currentMessage.text },
      }),
    );
    // Close the pop-up (the camera screen takes over).
    onClose();
    // Keep the router on the camera route.
    setRoute("camera");
  }, [replyText, currentMessage.text, clearReplyText, setRoute, onClose, currentMessage.id]);

  // ---- Reply with text (from camera/text) ----
  const handleReplyWithText = useCallback(() => {
    // Tell the text screen to switch, focus the composer, and show a quote
    // bar. The text screen listens for this event.
    window.dispatchEvent(
      new CustomEvent("signova:reply-with-text", {
        detail: { text: replyText || currentMessage.text },
      }),
    );
    onClose();
    clearReplyText();
    setRoute("text");
  }, [replyText, currentMessage.text, clearReplyText, setRoute, onClose]);

  // ---- Retry the animation ----
  const handleRetry = useCallback(() => {
    onMessageUpdated?.(currentMessage);
  }, [currentMessage, onMessageUpdated]);

  // ---- Layout: full-screen backdrop on desktop / large widths, bottom
  // sheet on < 700px. The backdrop blur must be visible in screenshots. ----
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(59,26,110,0.42)",
        backdropFilter: "blur(10px)",
        // Fallback for browsers without backdrop-filter.
        WebkitBackdropFilter: "blur(10px)",
        // Keep the screen behind interacble (the dialog is inert).
        pointerEvents: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Inert root that carries the backdrop; the dialog itself contains the focusable controls. */}
      <div style={{ display: "contents" }} />

      <div
        style={{
          width: "100%",
          maxWidth: 540,
          ...(isMobile
            ? {
                position: "fixed" as const,
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: "92dvh",
                borderRadius: "24px 24px 0 0",
                margin: 0,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                boxShadow: "0 -8px 30px rgba(59,26,110,0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }
            : {
                position: "relative" as const,
                maxHeight: "calc(100vh - 32px)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 12px 40px rgba(59,26,110,0.24)",
                borderRadius: 24,
                border: "1px solid rgba(201,180,255,0.35)",
              }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: isMobile ? "16px 16px 8px" : "12px 16px 10px",
            borderBottom: "1px solid rgba(201,180,255,0.3)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--purple-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--white)",
            }}
          >
            <Calendar size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id="teller-msg-caption"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              Counter 04
            </h2>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--secondary-text)" }}>
              Customer Support · Main Reception · {formatTime(message.timestamp)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close message notification"
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--white)",
              border: "1px solid var(--border-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink)",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Animation area — 16:9 card */}
        <div style={{ flex: 1, minHeight: 0, position: "relative", padding: isMobile ? "8px 12px 0" : "12px", background: "#1E1B2E" }}>
          <Player
            message={currentMessage}
            onStatusChange={() => {}}
            onRetry={handleRetry}
            onMessageUpdated={onMessageUpdated}
          />
        </div>

        {/* Caption — always visible */}
        <div style={{ padding: isMobile ? "10px 12px 4px" : "10px 16px 8px", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--secondary-text)" }}>
            COUNTER 04 SAYS
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 800,
              color: "var(--body-text)",
              lineHeight: 1.25,
              maxWidth: "100%",
              overflowWrap: "anywhere",
            }}
            onClick={() => void navigator.clipboard?.writeText(currentMessage.text)}
            title="Copy message text"
            role="button"
            aria-label="Copy message text"
          >
            {currentMessage.text}
          </p>
        </div>

        {/* Action buttons — sticky on mobile */}
        {isMobile && (
          <div
            style={{
              position: "sticky",
              bottom: "env(safe-area-inset-bottom)",
              paddingBottom: 8,
              background: "var(--cornsilk)",
            }}
          >
            <div style={{ padding: "10px 12px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <TouchButton
                  variant="primary"
                  size="lg"
                  icon={<Calendar size={16} />}
                  onPress={handleReplyInSign}
                  fullWidth
                >
                  Reply in sign language
                </TouchButton>
                <TouchButton
                  variant="secondary"
                  size="lg"
                  icon={<Calendar size={16} />}
                  onPress={handleReplyWithText}
                  fullWidth
                >
                  Reply with text
                </TouchButton>
              </div>
            </div>
          </div>
        )}

        {/* Desktop action row */}
        {!isMobile && (
          <div style={{ padding: "10px 16px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TouchButton
                variant="primary"
                size="lg"
                icon={<Calendar size={16} />}
                onPress={handleReplyInSign}
                fullWidth
              >
                Reply in sign language
              </TouchButton>
              <TouchButton
                variant="secondary"
                size="lg"
                icon={<Calendar size={16} />}
                onPress={handleReplyWithText}
                fullWidth
              >
                Reply with text
              </TouchButton>
            </div>
          </div>
        )}

        {/* Close button (full width, underlined) */}
        <div style={{ padding: isMobile ? "8px 12px 12px" : "8px 16px 12px", flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Close message notification"
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--purple-800)",
              border: "none",
              textDecoration: "underline",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
