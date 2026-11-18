import React from "react";
import { TouchButton } from "../components/ui/TouchButton";
import { Calendar } from "../components/ui/Icons";

interface NotificationBannerProps {
  /** Text of the latest staff message. */
  messageText: string;
  /** Handler when the user taps the banner (opens the pop-up). */
  onOpenPopup: () => void;
}

/**
 * Non-interrupting notification banner: shown at the top of the camera
 * screen when POPUP_INTERRUPTS_SIGNING is false and a teller message
 * arrives while the user is signing.
 */
export function NotificationBanner({ messageText, onOpenPopup }: NotificationBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        background: "var(--purple-50)",
        border: "1px solid rgba(155,123,208,0.5)",
        borderRadius: "var(--radius-pill)",
        flexShrink: 0,
      }}
      role="alert"
      aria-live="polite"
      onClick={onOpenPopup}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenPopup();
        }
      }}
      tabIndex={0}
    >
      <Calendar size={18} style={{ color: "var(--purple-600)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            color: "var(--ink)",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          New message from Counter 04
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--secondary-text)",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {first40(messageText)}
        </p>
      </div>
      <TouchButton
        variant="primary"
        size="sm"
        onPress={() => {
          onOpenPopup();
        }}
        style={{ flexShrink: 0 }}
      >
        View
      </TouchButton>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--secondary-text)",
          cursor: "pointer",
          padding: 6,
          borderRadius: "var(--radius-pill)",
          fontSize: 16,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function first40(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  const cut = trimmed.slice(0, 40);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 8 ? cut.slice(0, lastSpace) : cut;
}
