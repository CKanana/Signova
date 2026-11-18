import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { AnimationBlock } from "../components/AnimationBlock";
import { ArrowLeft, MessageSquare, User, Send } from "lucide-react";

export function ConversationScreen() {
  const {
    messages,
    currentDraft,
    sendMessage,
    goToStep,
    staff,
    sessionId,
    accessibility,
    retryAnimation,
  } = useSession();
  const [input, setInput] = React.useState(currentDraft ?? "");

  const reduceMotion = accessibility?.reduceMotion ?? false;
  const dataSaver = accessibility?.dataSaver ?? false;

  const backIcon = (
    <ArrowLeft size={20} color="#FFFFFF" />
  );

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          type="button"
          aria-label="Back"
          onClick={() => goToStep("complete")}
          style={styles.backButton}
        >
          {backIcon}
        </button>
        <div style={styles.brandText}>
          <div style={styles.staffBadge}>
            <User size={20} color="#FFFFFF" />
          </div>
          <div style={styles.staffInfo}>
            <span style={styles.staffName}>{staff?.name || "Staff member"}</span>
            <span style={styles.statusChip}>&bull; Available</span>
          </div>
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
              <circle cx="12" cy={12} r={10} />
              <polyline points="12 6 12 18" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <main style={styles.messagesWrap}>
        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              <MessageSquare size={32} color="var(--text-2)" />
              <p style={styles.emptyText}>No messages yet. Start a conversation below.</p>
            </div>
          )}
          {messages.map((m) => (
            <React.Fragment key={m.id}>
              <div
                key={m.id}
                style={mergeStyles(
                  styles.bubble,
                  m.sender === "user" ? styles.bubbleUser : undefined,
                  m.sender === "staff" ? styles.bubbleStaff : undefined,
                )}
              >
                <span style={mergeStyles(styles.bubbleText, m.sender === "staff" ? styles.bubbleStaffText : undefined)}>
                  {m.text}
                </span>
                <span style={styles.messageTime}>{formatTime(m.timestamp)}</span>
                {m.sender === "staff" && m.animation && (
                  <AnimationBlock
                    messageId={m.id}
                    text={m.text}
                    animation={m.animation}
                    dataSaver={dataSaver}
                    reduceMotion={reduceMotion}
                    onRetry={(messageId) => void retryAnimation(sessionId ?? "", messageId)}
                  />
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </main>

      <div style={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a reply…"
          style={styles.input}
        />
        <TouchButton
          variant="primary"
          size="touch"
          disabled={!input.trim()}
          onPress={() => { void sendMessage(input, "text"); setInput(""); }}
          icon={<Send size={18} color="#FFFFFF" />}
        >
          Send
        </TouchButton>
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
  brandText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  staffBadge: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  staffInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  staffName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  statusChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.85)",
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
  messagesWrap: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "calc(var(--space-3) + var(--safe-top)) var(--space-4) calc(var(--space-4) + var(--safe-bottom))",
    boxSizing: "border-box",
  } as React.CSSProperties,
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } as React.CSSProperties,
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 40,
    color: "var(--text-2)",
  } as React.CSSProperties,
  emptyText: {
    fontSize: 15,
    margin: 0,
  } as React.CSSProperties,
  bubble: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxWidth: "80%",
    padding: "4px 0",
  } as React.CSSProperties,
  bubbleUser: { alignSelf: "flex-end" } as React.CSSProperties,
  bubbleStaff: { alignSelf: "flex-start" } as React.CSSProperties,
  bubbleText: {
    padding: "10px 14px",
    borderRadius: 14,
    fontSize: 15,
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
  messageTime: {
    fontSize: 11,
    color: "var(--text-2)",
    alignSelf: "flex-end",
    marginTop: 2,
  } as React.CSSProperties,
  inputBar: {
    padding: "12px var(--space-4) calc(var(--space-4) + var(--safe-bottom))",
    borderTop: "1px solid var(--border-soft)",
    background: "var(--cream-card)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  } as React.CSSProperties,
  input: {
    flex: 1,
    minHeight: 48,
    padding: "10px 14px",
    borderRadius: "var(--radius-control)",
    border: "2px solid var(--border-ctl)",
    background: "var(--cream-card)",
    color: "var(--ink)",
    fontSize: 15,
    fontFamily: "inherit",
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
