import React, { useEffect, useRef, useState } from "react";
import { useStaffWorkspace, type UiMessage } from "../context/StaffWorkspaceContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfidenceMeter, confidenceBand, bandLabel } from "../components/ui/ConfidenceMeter";
import { EmptyState, ErrorBanner, LoadingState, WarningBanner } from "../components/ui/States";
import { IconCheck, IconPower, IconSend, IconUsers } from "../components/ui/Icons";

/**
 * The active communication workspace.
 *
 * Shows the translated Deaf-user messages with the backend's confidence
 * values, staff replies, live realtime state, and the reply composer. Send
 * goes over the existing Socket.IO message:send event; the server derives
 * the STAFF sender from the token, persists once, and broadcasts to the
 * session room where the Deaf-user mobile app receives staff:message.
 */

export function SessionPage({ onNavigate }: { onNavigate: (view: "dashboard" | "history") => void }) {
  const {
    view,
    pendingRequest,
    isLoadingSession,
    lowConfidenceAlert,
    clearLowConfidenceAlert,
    connection,
    sendReply,
    endActiveSession,
    resetToDashboard,
    error,
    clearError,
  } = useStaffWorkspace();

  const [draft, setDraft] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const messages = view.kind === "active" ? view.messages : view.kind === "ended" ? view.messages : [];

  // Keep the newest message in view.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, view.kind]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendReply(text);
  }

  async function handleEnd() {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setIsEnding(true);
    try {
      await endActiveSession();
    } finally {
      setIsEnding(false);
      setConfirmEnd(false);
    }
  }

  /* ---------------- Incoming request ---------------- */
  if (view.kind === "request" && pendingRequest) {
    return (
      <Card>
        <EmptyState
          title="You have an incoming request"
          action={
            <Button onClick={() => onNavigate("dashboard")}>Go to dashboard to accept</Button>
          }
        >
          A Deaf user is waiting. Accept the request from your dashboard to open the conversation.
        </EmptyState>
      </Card>
    );
  }

  /* ---------------- Loading ---------------- */
  if (isLoadingSession) {
    return (
      <Card>
        <LoadingState label="Opening the conversation…" />
      </Card>
    );
  }

  /* ---------------- Idle ---------------- */
  if (view.kind === "idle") {
    return (
      <Card>
        <EmptyState title="No active session" action={<Button variant="secondary" onClick={() => onNavigate("dashboard")}>Go to dashboard</Button>}>
          Your conversation workspace opens automatically when you accept a Deaf user&apos;s request.
        </EmptyState>
      </Card>
    );
  }

  /* ---------------- Ended ---------------- */
  if (view.kind === "ended") {
    const session = view.session;
    return (
      <div className="staff-stack">
        <Card>
          <div className="staff-card__body staff-stack">
            <div className="staff-row">
              <Badge tone="neutral" dot>
                Session ended
              </Badge>
              <span style={{ color: "var(--signova-muted-text)", fontSize: 14 }}>
                {view.messages.length} message{view.messages.length === 1 ? "" : "s"} exchanged
              </span>
            </div>
            <h2 className="staff-section-title" style={{ fontSize: 22 }}>
              This conversation has closed
            </h2>
            <p className="staff-section-lede" style={{ marginBottom: 0 }}>
              {session.endReason
                ? endReasonText(session.endReason)
                : "The session was closed. The teller counter is now free again."}
            </p>
            <div className="staff-row">
              <Button onClick={resetToDashboard}>Back to dashboard</Button>
              <Button variant="secondary" onClick={() => onNavigate("history")}>
                View history
              </Button>
            </div>
          </div>
        </Card>
        {view.messages.length > 0 ? (
          <Card>
            <CardHeader title="Conversation transcript" />
            <MessageThread messages={view.messages} threadRef={threadRef} />
          </Card>
        ) : null}
      </div>
    );
  }

  /* ---------------- Active ---------------- */
  if (view.kind !== "active") {
    return null;
  }
  const session = view.session;
  const tellerName = typeof session.teller === "object" ? session.teller.name : "Your counter";

  return (
    <div className="staff-session">
      <div className="staff-session__main">
        {error ? (
          <div style={{ marginBottom: 12 }}>
            <ErrorBanner message={error} action={<Button size="sm" variant="secondary" onClick={clearError}>Dismiss</Button>} />
          </div>
        ) : null}

        {lowConfidenceAlert && lowConfidenceAlert.sessionId === session._id ? (
          <div style={{ marginBottom: 12 }}>
            <WarningBanner
              message={`The latest translation had low confidence (${Math.round(
                lowConfidenceAlert.confidence * 100,
              )}%). Read the Deaf user's message carefully and confirm if unsure.`}
              action={
                <Button size="sm" variant="secondary" onClick={clearLowConfidenceAlert}>
                  Got it
                </Button>
              }
            />
          </div>
        ) : null}

        <Card className="staff-session__thread-wrap" as="section">
          <CardHeader
            title="Conversation"
            eyebrow={`Session ${session._id.slice(-6).toUpperCase()}`}
            action={
              <Badge tone="live" dot pulse>
                Live
              </Badge>
            }
          />
          <MessageThread messages={messages} threadRef={threadRef} />
          {connection !== "connected" ? (
            <div style={{ padding: "8px 24px 16px" }}>
              <WarningBanner
                message={
                  connection === "reconnecting"
                    ? "Reconnecting to the Signova service… new messages will arrive automatically."
                    : "You are disconnected. Messages you send will resume when the connection returns."
                }
              />
            </div>
          ) : null}
          <form className="staff-composer" onSubmit={handleSend}>
            <label className="sr-only" htmlFor="staff-reply">
              Type your reply to the Deaf user
            </label>
            <textarea
              id="staff-reply"
              className="staff-composer__input"
              placeholder="Type your reply… (Enter to send, Shift+Enter for a new line)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e);
                }
              }}
              rows={2}
            />
            <Button type="submit" disabled={!draft.trim()}>
              <IconSend />
              Send
            </Button>
          </form>
        </Card>
      </div>

      <aside className="staff-session__aside" aria-label="Session details">
        <Card>
          <CardHeader title="Session" />
          <div className="staff-card__body">
            <dl className="staff-kv">
              <dt>Status</dt>
              <dd>
                <Badge tone="live" dot pulse>
                  Active
                </Badge>
              </dd>
              <dt>Started</dt>
              <dd>{formatTime(session.startedAt)}</dd>
              <dt>Method</dt>
              <dd>{session.method === "sign" ? "Sign language" : "Typed message"}</dd>
              <dt>Messages</dt>
              <dd>{messages.length}</dd>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="End session" />
          <div className="staff-card__body staff-stack">
            <p className="staff-field__hint" style={{ margin: 0 }}>
              Ending the session frees your counter and notifies the Deaf user immediately.
            </p>
            {confirmEnd ? (
              <div className="staff-stack" style={{ gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                  End this conversation with {tellerName}?
                </p>
                <div className="staff-row">
                  <Button variant="danger" loading={isEnding} onClick={() => void handleEnd()}>
                    <IconPower />
                    Yes, end session
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" block onClick={() => setConfirmEnd(true)}>
                <IconPower />
                End session
              </Button>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

interface MessageThreadProps {
  messages: UiMessage[];
  threadRef: React.RefObject<HTMLDivElement | null>;
}

function MessageThread({ messages, threadRef }: MessageThreadProps) {
  return (
    <div className="staff-thread staff-session__thread" ref={threadRef} role="log" aria-live="polite" aria-label="Conversation messages">
      {messages.length === 0 ? (
        <EmptyState title="No messages yet">
          The Deaf user&apos;s translated messages will appear here as they arrive.
        </EmptyState>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.sender === "USER";
  const uncertain = isUser && message.confidence !== undefined && confidenceBand(message.confidence) === "low";

  const classes = [
    "staff-msg",
    isUser ? "staff-msg--user" : "staff-msg--staff",
    uncertain ? "staff-msg--uncertain" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className="staff-msg__head">
        <span className="staff-msg__sender">
          {isUser ? (
            <>
              <IconUsers size={13} /> Deaf user
            </>
          ) : (
            "You"
          )}
        </span>
        <span className="staff-msg__time">{formatTime(message.timestamp)}</span>
      </div>
      <p className="staff-msg__text">{message.text}</p>

      {isUser ? (
        <div className="staff-msg__meta">
          {message.confidence !== undefined ? (
            <ConfidenceMeter confidence={message.confidence} compact />
          ) : null}
          {message.method === "sign" ? (
            <Badge tone="neutral">Signed</Badge>
          ) : (
            <Badge tone="neutral">Typed</Badge>
          )}
          {message.isConfirmed ? (
            <Badge tone="free">
              <IconCheck size={12} /> Confirmed
            </Badge>
          ) : (
            <Badge tone="warn">Unconfirmed</Badge>
          )}
          {uncertain ? (
            <span style={{ color: "var(--signova-warning)", fontSize: 12, fontWeight: 700 }}>
              Low confidence — {bandLabel("low")} translation
            </span>
          ) : null}
        </div>
      ) : null}

      {message.pending ? (
        <p className="staff-field__hint" style={{ marginTop: 6, marginBottom: 0 }}>
          Sending…
        </p>
      ) : null}
      {message.failed ? (
        <p style={{ color: "var(--signova-danger)", fontSize: 12, fontWeight: 700, marginTop: 6, marginBottom: 0 }}>
          Could not send — check your connection and try again.
        </p>
      ) : null}
    </article>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function endReasonText(reason: string): string {
  switch (reason) {
    case "USER_ENDED":
      return "The Deaf user ended the conversation. The counter is free again.";
    case "STAFF_ENDED":
      return "You ended the conversation. The counter is free again.";
    case "TIMEOUT":
      return "The session timed out. The counter is free again.";
    default:
      return "The session ended. The counter is free again.";
  }
}
