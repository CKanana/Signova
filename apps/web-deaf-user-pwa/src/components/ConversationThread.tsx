import React, { useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";

const tellerBubbleBase: React.CSSProperties = {
  background: "var(--lavender)",
  color: "var(--body-text)",
  border: "1px solid var(--border-soft)",
  borderBottomLeftRadius: 4,
  maxWidth: "88%",
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.4,
  wordWrap: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};

const mySignedBase: React.CSSProperties = {
  background: "var(--purple-600)",
  color: "var(--white)",
  borderBottomRightRadius: 4,
  maxWidth: "88%",
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.4,
  wordWrap: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};

const replayChipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: "var(--radius-pill)",
  border: "2px solid var(--purple-400)",
  background: "var(--cream-card)",
  color: "var(--purple-600)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

function ReplayChip({
  animation,
  onReplay,
}: {
  animation: { status: "pending" | "ready" | "failed" | "skipped"; url: string | null; error: string | null } | null;
  onReplay?: () => void;
}) {
  const [pendingRetry, setPendingRetry] = useState(false);

  let label: string;
  if (animation?.status === "pending") {
    label = "Preparing animation…";
  } else if (animation?.status === "failed") {
    label = "Animation unavailable";
  } else if (animation?.status === "skipped") {
    label = "Animation unavailable";
  } else {
    label = "Replay animation";
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pendingRetry) return;
        if (animation?.status === "pending") {
          setPendingRetry(true);
          return;
        }
        onReplay?.();
      }}
      disabled={pendingRetry}
      style={{
        ...replayChipBase,
        opacity: pendingRetry ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

interface ThreadRowProps {
  message: {
    id: string;
    sender: "staff" | "user";
    text: string;
    animation?: { status: "pending" | "ready" | "failed" | "skipped"; url: string | null; durationMs: number | null; requestedAt: string | null; readyAt: string | null; error: string | null; } | null;
  };
  isStaff: boolean;
  showLabel: boolean;
  onRetry?: (sessionId: string, messageId: string) => void;
}

function ThreadRow({ message, isStaff, showLabel, onRetry }: ThreadRowProps) {
  const animation = message.animation ?? null;
  const isPending = animation?.status === "pending";
  const isReady = animation?.status === "ready" && !!animation?.url;
  const isFailed = animation?.status === "failed";
  const isSkipped = animation?.status === "skipped";
  const isProcessing = isPending || isFailed || isSkipped;

  const handleRetry = () => {
    onRetry?.("", message.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "100%", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {showLabel && (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: isStaff ? "var(--secondary-text)" : "var(--white)", marginBottom: 2 }}>
            {isStaff ? "Counter 04" : "You (signed)"}
          </span>
        )}
        <span style={isStaff ? tellerBubbleBase : mySignedBase}>{message.text}</span>
      </div>

      {isStaff && (
        <span style={{ fontSize: 10, color: "var(--success-text)", marginTop: 2 }}>Delivered</span>
      )}

      {!isProcessing && isReady && (
        <ReplayChip
          animation={animation}
          onReplay={handleRetry}
        />
      )}

      {isPending && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--purple-400)", borderTopColor: "var(--purple-600)", borderRadius: "50%", animation: "sn-spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 12, color: "var(--secondary-text)" }}>Preparing the signing animation…</span>
        </div>
      )}

      {isFailed && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger-text)" }}>Animation unavailable</span>
          <TouchButton
            variant="outline"
            size="sm"
            onPress={handleRetry}
            style={{ flexShrink: 0, padding: "4px 10px", fontSize: 11 }}
          >
            Retry
          </TouchButton>
        </div>
      )}

      {isSkipped && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--secondary-text)", fontStyle: "italic" }}>No signing animation was generated for this message.</p>
      )}
    </div>
  );
}

export function ThreadRowNonStaff() {
  return null;
}

export function ConversationThread() {
  const { messages, retryAnimation } = useSession();

  const staffMessages = useMemo(
    () => messages.filter((m) => m.sender === "staff").reverse(),
    [messages],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {staffMessages.map((m, i, arr) => {
        const prev = i > 0 ? arr[arr.length - 1 - i] : null;
        const showLabel = prev?.sender !== m.sender;
        const isStaff = m.sender === "staff";
        if (!isStaff) return null;
        return <ThreadRow key={m.id} message={m} isStaff={true} showLabel={showLabel} onRetry={retryAnimation} />;
      })}
      {staffMessages.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--secondary-text)", padding: 20 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No messages yet</p>
          <p style={{ margin: 0, fontSize: 12 }}>Your signed messages and staff replies appear here.</p>
        </div>
      )}
    </div>
  );
}
