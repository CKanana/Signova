import React from "react";
import { Check } from "../components/ui/Icons";
import { useReplyRouter } from "../context/ReplyRouterContext";

interface ReplyChipProps {
  /** Text of the message being replied to (first 40 chars shown). */
  replyText: string;
  /** Called when the user dismisses the chip. */
  onDismiss: () => void;
  /** Called when the user taps the chip (opens the pop-up / starts reply). */
  onTap: () => void;
}

/**
 * Dismissible reply-context chip at the top centre of the camera frame.
 * Shown after "Reply in sign language" is tapped from the text screen.
 */
export function ReplyChip({ replyText, onDismiss, onTap }: ReplyChipProps) {
  const { replyText: currentReplyText } = useReplyRouter();

  React.useEffect(() => {
    // If the context already has a reply text, highlight this chip.
    if (currentReplyText && !replyText) {
      // Handled by parent (context is shared; we just reflect the state).
    }
  }, [replyText, currentReplyText]);

  return (
    <div
      style={{
        position: "absolute" as const,
        top: "var(--space-4)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: "var(--radius-pill)",
        background: "var(--purple-50)",
        border: "1px solid rgba(155,123,208,0.5)",
        boxShadow: "0 4px 16px rgba(59,26,110,0.18)",
        cursor: "pointer",
        flexShrink: 0,
        zIndex: 10,
      }}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Reply in sign language to Counter 04"
    >
      <Check size={18} style={{ color: "var(--purple-600)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            color: "var(--ink)",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          Replying to Counter 04: {replyText}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss reply chip"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--secondary-text)",
          cursor: "pointer",
          padding: 4,
          borderRadius: "var(--radius-pill)",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
