import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { AnimationBlock } from "../components/AnimationBlock";

export function TextMessageScreen() {
  const {
    staff,
    sessionStatus,
    isConnected,
    messages,
    sessionId,
    accessibility,
    retryAnimation,
    sendTextMessage,
    endSession,
    goToStep,
    goBack,
  } = useSession();

  const [text, setText] = useState("");
  const [sending, setSending] = useState<"idle" | "sending" | "sent" | "delivered" | "failed">("idle");
  const [scrolled, setScrolled] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const tellerName = staff?.name ?? "Staff member";
  const counterNumber = staff?.counterNumber ?? "1";
  const reduceMotion = accessibility?.reduceMotion ?? false;
  const dataSaver = accessibility?.dataSaver ?? false;

  const connectionLabel =
    sessionStatus === "ACTIVE"
      ? "Connected"
      : sessionStatus === "CONNECTING"
        ? "Reconnecting"
        : "Offline";

  const isOnline = isConnected && sessionStatus === "ACTIVE";

  useEffect(() => {
    if (isOnline && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOnline]);

  const handleSend = useCallback(() => {
    if (!text.trim() || !isOnline) return;
    setSending("sending");
    void sendTextMessage(text);
    setText("");
    setSending("sent");
    setTimeout(() => setSending("delivered"), 800);
    setTimeout(() => setSending("idle"), 1600);
  }, [text, sendTextMessage, isOnline]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndSession = () => setConfirmEnd(true);

  const handleConfirmEnd = () => {
    setConfirmEnd(false);
    void endSession();
  };

  const handleSwitchToSign = () => {
    goToStep("live");
  };

  const handleLeave = () => goBack();

  const connectionPill = () => {
    const active = sessionStatus === "ACTIVE";
    return (
      <div style={styles.connectionPill}>
        <div style={mergeStyles(styles.connectionDot, active ? styles.connectionDotActive : styles.connectionDotIdle)} aria-hidden="true" />
        <span style={styles.connectionText}>{connectionLabel}</span>
      </div>
    );
  };

  const timer = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const backIcon = (
    <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
  const accessibilityIcon = (
    <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 18H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
      <circle cx="11" cy="13" r="6" />
      <path d="M9 7h6" />
    </svg>
  );
  const helpIcon = (
    <svg width="20" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 18" />
      <path d="M5 12h14" />
    </svg>
  );
  const handIcon = (
    <svg width="18" height="18" fill="none" stroke="var(--purple-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
      <path d="M12 6h.01M12 12h.01M12 18h.01" />
    </svg>
  );
  const phoneOffIcon = (
    <svg width="18" height="18" fill="none" stroke="var(--danger-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
      <line x1="22" y1="2" x2="22" y2="12" />
      <line x1="16" y1="16" x2="16" y2="22" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="8" y1="16" x2="8" y2="22" />
    </svg>
  );
  const sendIcon = (
    <svg width="18" height="18" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
  const clockIcon = (
    <svg width="14" height="14" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
  const checkIcon = (
    <svg width="14" height="14" fill="none" stroke="var(--success-dot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  const doubleCheckIcon = (
    <svg width="14" height="14" fill="none" stroke="var(--success-dot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
      <polyline points="16 6 5 17 1 12" />
    </svg>
  );
  const alertIcon = (
    <svg width="14" height="14" fill="none" stroke="var(--danger-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 29h24M12 17h20" />
    </svg>
  );

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const iconButton = (label: string, icon: React.ReactNode, onPress: () => void) => (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      style={styles.iconButton}
    >
      {icon}
    </button>
  );

  const deliveryState = () => {
    if (sending === "sending") {
      return (
        <div style={styles.deliverySending}>
          {clockIcon}
          <span style={styles.deliveryText}>Sending</span>
        </div>
      );
    }
    if (sending === "sent") {
      return (
        <div style={styles.deliverySent}>
          {checkIcon}
          <span style={styles.deliveryText}>Sent</span>
        </div>
      );
    }
    if (sending === "delivered") {
      return (
        <div style={styles.deliveryDelivered}>
          {doubleCheckIcon}
          <span style={styles.deliveryText}>Delivered</span>
        </div>
      );
    }
    if (sending === "failed") {
      return (
        <div style={styles.deliveryFailed}>
          {alertIcon}
          <span style={styles.deliveryText}>Failed</span>
          <button
            type="button"
            aria-label="Tap to retry"
            onClick={handleSend}
            style={styles.retryButton}
          >
            Tap to retry
          </button>
        </div>
      );
    }
    return null;
  };

  const reconnectingBanner = () => {
    return null;
  };

  const typingIndicator = () => {
    return null;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          type="button"
          aria-label="Back to method selection"
          onClick={handleLeave}
          disabled={confirmEnd}
          style={mergeStyles(styles.backButton, confirmEnd ? styles.buttonDisabled : {})}
        >
          {backIcon}
        </button>
        <div style={styles.tellerInfo}>
          <div style={styles.tellerAvatar}>
            {tellerName.split(" ").map((p) => p[0]).join("")}
          </div>
          <div>
            <span style={styles.tellerName}>{tellerName}</span>
            <span style={styles.tellerSub}>Counter {counterNumber} &middot; Ground floor</span>
          </div>
        </div>
        <div style={styles.spacer} />
        {iconButton("Accessibility settings", accessibilityIcon, () => goToStep("settings"))}
        {iconButton("Help and guidance", helpIcon, () => goToStep("help"))}
      </header>

      <div style={styles.statusStrip}>
        {connectionPill()}
        <span style={styles.statusTimer}>{timer()}</span>
      </div>

      <main style={styles.main}>
        <div
          role="log"
          aria-live="polite"
          style={styles.messageList}
          ref={messagesEndRef}
        >
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIconTile} aria-hidden="true">
                <svg width="48" height="48" fill="none" stroke="var(--border-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 3 3 3h4v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4h4l-3-3-3-3h-4v-4a2 2 0 0 0-2-2zM2 12h20v10H2V12z" />
                </svg>
              </div>
              <span style={styles.emptyTitle}>Say hello to start</span>
              <span style={styles.emptyBody}>Your staff member sees your message instantly.</span>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const sameSender = prev && prev.sender === m.sender;
            const isStaff = m.sender === "staff";
            const showLabel = !sameSender && isStaff;
            const showTime = i === messages.length - 1 || !sameSender;
            return (
              <div key={m.id} style={mergeStyles(styles.messageRow, isStaff ? styles.messageRowStaff : styles.messageRowUser)}>
                {showLabel && isStaff && (
                  <span style={styles.senderLabel}>{tellerName}</span>
                )}
                <span style={mergeStyles(styles.bubble, isStaff ? styles.bubbleStaff : styles.bubbleUser)}>
                  {m.text}
                </span>
                {isStaff && m.animation && (
                  <AnimationBlock
                    messageId={m.id}
                    text={m.text}
                    animation={m.animation}
                    dataSaver={dataSaver}
                    reduceMotion={reduceMotion}
                    onRetry={(messageId) => void retryAnimation(sessionId ?? "", messageId)}
                  />
                )}
                {showTime && (
                  <span style={styles.messageTime}>{formatTime(m.timestamp)}</span>
                )}
              </div>
            );
          })}
          {typingIndicator()}
          <div ref={messagesEndRef} />
        </div>
        {scrolled && (
          <button
            type="button"
            aria-label="Jump to newest message"
            onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setScrolled(false); }}
            style={styles.newMessagePill}
          >
            New message
          </button>
        )}
      </main>

      {reconnectingBanner()}

      <div style={styles.actionRow}>
        <TouchButton variant="outline" size="sm" onPress={handleSwitchToSign} style={styles.actionButton}>
          {handIcon}
          <span style={styles.actionLabel}>Use sign language</span>
        </TouchButton>
        <TouchButton variant="outline" size="sm" onPress={handleEndSession} style={mergeStyles(styles.actionButton, styles.actionButtonDanger)}>
          {phoneOffIcon}
          <span style={styles.actionLabel}>End session</span>
        </TouchButton>
      </div>

      <div style={styles.composerWrapper}>
        <div style={styles.composer}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            style={mergeStyles(styles.textarea, !isOnline ? styles.textareaOffline : {})}
            disabled={!isOnline}
            aria-label="Type a message"
            rows={1}
          />
          <button
            type="button"
            aria-label="Send"
            onClick={handleSend}
            disabled={!text.trim() || !isOnline}
            style={mergeStyles(
              styles.sendButton,
              (!text.trim() || !isOnline) ? styles.sendButtonDisabled : {},
            )}
          >
            {sendIcon}
            <span style={styles.sendLabel}>Send</span>
          </button>
        </div>
        {deliveryState()}
      </div>

      {confirmEnd && (
        <div style={styles.dialogOverlay} onClick={() => setConfirmEnd(false)}>
          <div style={styles.dialogCard} onClick={(e) => e.stopPropagation()}>
            <span style={styles.dialogTitle}>End session?</span>
            <span style={styles.dialogBody}>Ending now will free the teller and close the conversation.</span>
            <div style={styles.dialogActions}>
              <TouchButton variant="outline" size="sm" onPress={() => setConfirmEnd(false)} style={styles.dialogButton}>
                Cancel
              </TouchButton>
              <TouchButton variant="danger" size="sm" onPress={handleConfirmEnd} style={styles.dialogButtonConfirm}>
                End session
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeStyles<T extends Record<string, any>>(
  ...styles: (T | undefined | null)[]
): T {
  const result: Partial<T> = {};
  for (const s of styles) {
    if (s) Object.assign(result, s);
  }
  return result as T;
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
    gap: 10,
    flexShrink: 0,
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
  buttonDisabled: {
    opacity: 0.5,
    pointerEvents: "none",
  } as React.CSSProperties,
  tellerInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } as React.CSSProperties,
  tellerAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
  } as React.CSSProperties,
  tellerName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  } as React.CSSProperties,
  tellerSub: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  } as React.CSSProperties,
  spacer: {
    flex: 1,
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
    color: "#FFFFFF",
    flexShrink: 0,
  } as React.CSSProperties,

  statusStrip: {
    background: "var(--lavender)",
    borderBottom: "1px solid var(--border-soft)",
    padding: "8px var(--space-4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  } as React.CSSProperties,
  connectionPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    background: "rgba(22, 163, 74, 0.15)",
    border: "1px solid rgba(22, 163, 74, 0.3)",
  } as React.CSSProperties,
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--text-2)",
    flexShrink: 0,
  } as React.CSSProperties,
  connectionDotActive: {
    background: "var(--success-dot)",
    boxShadow: "0 0 0 6px rgba(22, 163, 74, 0.3)",
  } as React.CSSProperties,
  connectionDotIdle: {
    background: "rgba(255,255,255,0.4)",
  } as React.CSSProperties,
  connectionText: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--success-text)",
  } as React.CSSProperties,
  statusTimer: {
    fontSize: 12,
    fontWeight: 700,
    fontFamily: '"Courier New", monospace',
    color: "var(--purple-800)",
    flexShrink: 0,
  } as React.CSSProperties,

  main: {
    flex: 1,
    minHeight: 0,
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom))",
    boxSizing: "border-box",
    overflowX: "hidden",
  } as React.CSSProperties,
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } as React.CSSProperties,
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    paddingTop: 40,
    textAlign: "center",
  } as React.CSSProperties,
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "var(--cream-card)",
    border: "1px solid var(--border-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  emptyTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "var(--purple-800)",
    margin: 0,
  } as React.CSSProperties,
  emptyBody: {
    fontSize: 14,
    color: "var(--text-2)",
    margin: 0,
  } as React.CSSProperties,
  messageRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxWidth: "82%",
  } as React.CSSProperties,
  messageRowStaff: {
    alignSelf: "flex-start",
  } as React.CSSProperties,
  messageRowUser: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  } as React.CSSProperties,
  senderLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "var(--text-2)",
    marginBottom: 2,
    alignSelf: "flex-start",
  } as React.CSSProperties,
  bubble: {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--ink)",
    maxWidth: "100%",
    wordWrap: "break-word",
    overflowWrap: "break-word",
  } as React.CSSProperties,
  bubbleStaff: {
    background: "var(--lavender)",
    color: "var(--ink)",
    borderBottomLeftRadius: 4,
    border: "1px solid var(--border-soft)",
  } as React.CSSProperties,
  bubbleUser: {
    background: "var(--purple-600)",
    color: "#FFFFFF",
    borderBottomRightRadius: 4,
  } as React.CSSProperties,
  messageTime: {
    fontSize: 11,
    color: "var(--text-2)",
    alignSelf: "flex-end",
    marginTop: 2,
  } as React.CSSProperties,
  typingBubble: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 12px",
    borderRadius: 16,
    background: "var(--lavender)",
    border: "1px solid var(--border-soft)",
    marginLeft: 4,
  } as React.CSSProperties,
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--purple-600)",
    animation: "sn-typing 1.4s infinite ease-in-out both",
  } as React.CSSProperties,
  newMessagePill: {
    alignSelf: "center",
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    background: "var(--purple-600)",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 800,
    marginTop: 8,
    cursor: "pointer",
  } as React.CSSProperties,

  reconnectingBanner: {
    background: "var(--lavender)",
    borderBottom: "1px solid var(--border-soft)",
    padding: "6px var(--space-4)",
    fontSize: 13,
    color: "var(--purple-800)",
    fontWeight: 600,
    textAlign: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  reconnectingText: {
    margin: 0,
  } as React.CSSProperties,

  actionRow: {
    display: "flex",
    gap: 8,
    padding: "8px var(--space-4)",
    background: "var(--cornsilk)",
    borderTop: "1px solid var(--border-soft)",
    flexShrink: 0,
  } as React.CSSProperties,
  actionButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
    height: 44,
    borderRadius: "var(--radius-pill)",
    border: "2px solid var(--purple-600)",
    background: "var(--cream-card)",
    color: "var(--purple-600)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,
  actionButtonDanger: {
    borderColor: "var(--danger-text)",
    color: "var(--danger-text)",
  } as React.CSSProperties,
  actionLabel: {
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  composerWrapper: {
    padding: "8px var(--space-4) calc(var(--space-4) + var(--safe-bottom))",
    background: "var(--cornsilk)",
    borderTop: "1px solid var(--border-soft)",
    flexShrink: 0,
  } as React.CSSProperties,
  composer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: 760,
    margin: "0 auto",
  } as React.CSSProperties,
  textarea: {
    minHeight: 48,
    maxHeight: 144,
    padding: "12px 14px",
    borderRadius: "14px",
    border: "2px solid var(--border-ctl)",
    background: "var(--cream-card)",
    color: "var(--ink)",
    fontFamily: "inherit",
    fontSize: 16,
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    flex: 1,
  } as React.CSSProperties,
  textareaOffline: {
    opacity: 0.7,
  } as React.CSSProperties,
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: "14px",
    background: "var(--purple-600)",
    color: "#FFFFFF",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,
  sendButtonDisabled: {
    background: "var(--lavender)",
    border: "2px solid var(--border-ctl)",
    color: "var(--text-2)",
    cursor: "not-allowed",
  } as React.CSSProperties,
  sendLabel: {
    fontSize: 14,
    fontWeight: 800,
  } as React.CSSProperties,

  deliverySending: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--text-2)",
    marginTop: 4,
    marginLeft: "auto",
  } as React.CSSProperties,
  deliverySent: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--success-text)",
    marginTop: 4,
    marginLeft: "auto",
  } as React.CSSProperties,
  deliveryDelivered: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--success-text)",
    marginTop: 4,
    marginLeft: "auto",
  } as React.CSSProperties,
  deliveryFailed: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--danger-text)",
    marginTop: 4,
    marginLeft: "auto",
  } as React.CSSProperties,
  deliveryText: {
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  retryButton: {
    background: "none",
    border: "none",
    color: "var(--danger-text)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
  } as React.CSSProperties,

  dialogOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(30, 27, 46, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  } as React.CSSProperties,
  dialogCard: {
    background: "var(--cream-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: 16,
    padding: 24,
    maxWidth: 320,
    width: "85%",
    boxShadow: "0 12px 40px rgba(59, 26, 110, 0.22)",
  } as React.CSSProperties,
  dialogTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "var(--ink)",
    margin: "0 0 8px",
  } as React.CSSProperties,
  dialogBody: {
    fontSize: 14,
    color: "var(--text-2)",
    margin: "0 0 18px",
  } as React.CSSProperties,
  dialogActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  } as React.CSSProperties,
  dialogButton: {
    fontSize: 13,
    fontWeight: 800,
    padding: "8px 14px",
    borderRadius: "var(--radius-pill)",
    border: "2px solid var(--border-soft)",
    background: "var(--cream-card)",
    color: "var(--ink)",
  } as React.CSSProperties,
  dialogButtonConfirm: {
    background: "var(--purple-600)",
    borderColor: "var(--purple-600)",
    color: "#FFFFFF",
  } as React.CSSProperties,
} as const;

// Typing dots animation
const style = document.createElement("style");
style.textContent = `
  @keyframes sn-typing {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(-4px); opacity: 1; }
  }
  .sn-typing-dot-1 { animation-delay: 0.2s; }
  .sn-typing-dot-2 { animation-delay: 0.4s; }
  .sn-typing-dot-3 { animation-delay: 0.6s; }
`;
if (typeof document !== "undefined") {
  document.head.appendChild(style);
}
