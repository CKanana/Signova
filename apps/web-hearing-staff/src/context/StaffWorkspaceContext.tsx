import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type SessionDetail, type StaffUser, type StaffTeller } from "../services/api";
import { useStaffAuth } from "./AuthContext";
import {
  connectStaffSocket,
  disconnectStaffSocket,
  endSession as socketEndSession,
  getConnectionState,
  joinSession,
  sendStaffMessage,
  type ConnectionState,
} from "../services/socket";
import type { SessionRequestPayload, WireMessage } from "../services/events";
import type { MessageRecord, Organisation } from "../../../../shared/types/mobile";
/**
 * Staff workspace state: organization, tellers, the assigned teller, the
 * incoming request queue, the active session, its conversation, and the
 * realtime connection state.
 *
 * Rules honored here:
 *  - The backend is the source of truth. Nothing is hardcoded; every value
 *    comes from a REST response or a Socket.IO event.
 *  - Realtime uses ONLY the existing /signova infrastructure.
 *  - Tellers are resolved by the backend's `staffUser` assignment — the UI
 *    does not assume a 1:1 staff↔teller mapping (the schema doesn't enforce
 *    one); it shows every org teller with live status and marks the assigned
 *    ones.
 *  - Send confirmation comes from the server's own broadcast (message:new
 *    to the session room), so an optimistic message is only committed when
 *    the server has actually persisted and rebroadcast it.
 */

export type SessionView =
  | { kind: "idle" }
  | { kind: "request"; request: SessionRequestPayload; receivedAt: string }
  | { kind: "connecting"; sessionId: string }
  | { kind: "active"; session: SessionDetail; messages: UiMessage[] }
  | { kind: "ended"; session: SessionDetail; messages: UiMessage[] };

export interface UiMessage {
  id: string;
  sender: "USER" | "STAFF";
  text: string;
  method: "sign" | "text" | "speech";
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
  pending?: boolean;
  failed?: boolean;
}

interface StaffWorkspaceValue {
  // Org + identity
  organization: Organisation | null;
  user: StaffUser | null;
  tellers: StaffTeller[];
  assignedTellers: StaffTeller[];
  isLoadingOrg: boolean;
  isLoadingTellers: boolean;

  // Teller availability control (FREE ⇄ OFFLINE only; BUSY is backend-owned)
  isSavingAvailability: boolean;
  setAvailability: (tellerId: string, status: "FREE" | "OFFLINE") => Promise<void>;

  // Session lifecycle
  view: SessionView;
  pendingRequest: SessionRequestPayload | null;
  activeSessionId: string | null;
  isLoadingSession: boolean;
  lowConfidenceAlert: { sessionId: string; confidence: number } | null;
  clearLowConfidenceAlert: () => void;
  connection: ConnectionState;

  // Actions
  acceptRequest: () => Promise<void>;
  declineRequest: () => void;
  sendReply: (text: string) => Promise<void>;
  endActiveSession: () => Promise<void>;
  resetToDashboard: () => void;
  reloadWorkspace: () => Promise<void>;

  // Errors
  error: string | null;
  clearError: () => void;
}

const StaffWorkspaceContext = createContext<StaffWorkspaceValue | null>(null);

/** Poll interval for detecting sessions ended from the other client. */
const STATUS_POLL_MS = 4000;

export function StaffWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useStaffAuth();

  const [organization, setOrganization] = useState<Organisation | null>(null);
  const [tellers, setTellers] = useState<StaffTeller[]>([]);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [isLoadingTellers, setIsLoadingTellers] = useState(true);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  const [view, setView] = useState<SessionView>({ kind: "idle" });
  const [pendingRequest, setPendingRequest] = useState<SessionRequestPayload | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [lowConfidenceAlert, setLowConfidenceAlert] = useState<{
    sessionId: string;
    confidence: number;
  } | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(getConnectionState());
  const [error, setError] = useState<string | null>(null);

  const clearLowConfidenceAlert = useCallback(() => setLowConfidenceAlert(null), []);

  // Session messages live in a ref-backed map so socket events can append
  // without stale-closure issues; a version counter drives re-render.
  const messagesRef = useRef<Map<string, UiMessage[]>>(new Map());
  const [, forceMessages] = useState(0);
  const commitMessages = useCallback((sessionId: string, next: UiMessage[]) => {
    messagesRef.current.set(sessionId, next);
    forceMessages((n) => n + 1);
  }, []);
  const getMessages = useCallback(
    (sessionId: string) => messagesRef.current.get(sessionId) ?? [],
    [],
  );

  const activeSessionId = view.kind === "active" ? view.session._id : null;
  const clearError = useCallback(() => setError(null), []);

  /* ------------------------------------------------------------------ */
  /* Data loading                                                        */
  /* ------------------------------------------------------------------ */

  const loadOrganization = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingOrg(true);
    try {
      const { organization: org } = await api.getOrganization();
      setOrganization(org);
    } catch (err) {
      setError(describeError(err, "Could not load your organization details."));
    } finally {
      setIsLoadingOrg(false);
    }
  }, [isAuthenticated]);

  const loadTellers = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingTellers(true);
    try {
      const { tellers: list } = await api.listTellers();
      setTellers(list);
    } catch (err) {
      setError(describeError(err, "Could not load teller information."));
    } finally {
      setIsLoadingTellers(false);
    }
  }, [isAuthenticated]);

  const reloadWorkspace = useCallback(async () => {
    await Promise.all([loadOrganization(), loadTellers()]);
  }, [loadOrganization, loadTellers]);

  // Load org + tellers once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    void reloadWorkspace();
  }, [isAuthenticated, reloadWorkspace]);

  /* ------------------------------------------------------------------ */
  /* Socket wiring                                                       */
  /* ------------------------------------------------------------------ */

  // Connect the staff socket with the access token. We read the token via a
  // tiny helper that re-connects when the auth state changes.
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectStaffSocket();
      setConnection("idle");
      return;
    }
    // The auth context holds the token in a ref; grab it from storage the
    // same way (sessionStorage), which is where the staff app keeps it.
    const token = window.sessionStorage.getItem("signova.staff.accessToken");
    if (!token) return;

    connectStaffSocket(token, {
      onConnectionChange: (state) => setConnection(state),
      onSessionRequest: (payload) => {
        // Only surface the request if we're idle (no active session).
        setView((current) => {
          if (current.kind === "idle") {
            setPendingRequest(payload);
            return {
              kind: "request",
              request: payload,
              receivedAt: new Date().toISOString(),
            };
          }
          return current;
        });
      },
      onNewMessage: (message) => {
        setView((current) => {
          if (current.kind !== "active" || current.session._id !== message.sessionId) {
            return current;
          }
          // Confirm any pending optimistic copy of this message.
          const existing = getMessages(message.sessionId);
          const optimistic = existing.find(
            (m) => m.pending && m.sender === message.sender && m.text === message.text,
          );
          const next = optimistic
            ? existing.map((m) => (m === optimistic ? { ...wireToUi(message) } : m))
            : [...existing, wireToUi(message)];
          commitMessages(message.sessionId, next);
          return current;
        });
      },
      onTranslationLow: (payload) => {
        setLowConfidenceAlert(payload);
      },
      onSessionEnded: (payload) => {
        setView((current) => {
          if (current.kind !== "active" || current.session._id !== payload.sessionId) {
            return current;
          }
          return {
            kind: "ended",
            session: { ...current.session, status: "ENDED", endedAt: new Date().toISOString() },
            messages: getMessages(payload.sessionId),
          };
        });
        setPendingRequest(null);
      },
      onError: (message) => setError(message),
    });
    return () => {
      /* socket teardown happens on sign-out; keep it alive across views */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ------------------------------------------------------------------ */
  /* Teller availability (staff-controlled)                              */
  /* ------------------------------------------------------------------ */

  const setAvailability = useCallback(
    async (tellerId: string, status: "FREE" | "OFFLINE") => {
      setIsSavingAvailability(true);
      setError(null);
      try {
        const { teller } = await api.setTellerAvailability(tellerId, status);
        setTellers((prev) => prev.map((t) => (t._id === teller._id ? teller : t)));
      } catch (err) {
        setError(describeError(err, "Could not update teller availability."));
      } finally {
        setIsSavingAvailability(false);
      }
    },
    [],
  );

  /* ------------------------------------------------------------------ */
  /* Session lifecycle                                                   */
  /* ------------------------------------------------------------------ */

  const loadSessionIntoView = useCallback(
    async (sessionId: string) => {
      setIsLoadingSession(true);
      try {
        const [{ session }, { messages }] = await Promise.all([
          api.getSession(sessionId),
          api.listMessages(sessionId),
        ]);
        const ui = messages.map(recordToUi);
        commitMessages(sessionId, ui);

        if (session.status === "ENDED") {
          setView({ kind: "ended", session, messages: ui });
        } else {
          setView({ kind: "active", session, messages: ui });
          joinSession(sessionId);
        }
        setPendingRequest(null);
      } catch (err) {
        setError(describeError(err, "Could not open this session."));
        setView({ kind: "idle" });
      } finally {
        setIsLoadingSession(false);
      }
    },
    [commitMessages],
  );

  const acceptRequest = useCallback(async () => {
    if (!pendingRequest) return;
    await loadSessionIntoView(pendingRequest.sessionId);
  }, [loadSessionIntoView, pendingRequest]);

  const declineRequest = useCallback(() => {
    setPendingRequest(null);
    setView({ kind: "idle" });
  }, []);

  const sendReply = useCallback(
    async (text: string) => {
      const sessionId = activeSessionId;
      if (!sessionId || !text.trim()) return;

      // Optimistic copy — confirmed only when the server broadcasts it back.
      const optimistic: UiMessage = {
        id: `optimistic-${Date.now()}`,
        sender: "STAFF",
        text: text.trim(),
        method: "speech",
        isConfirmed: false,
        timestamp: new Date().toISOString(),
        pending: true,
      };
      commitMessages(sessionId, [...getMessages(sessionId), optimistic]);

      try {
        sendStaffMessage(sessionId, text.trim(), "speech");
      } catch (err) {
        setError(describeError(err, "Your reply could not be sent."));
        commitMessages(
          sessionId,
          getMessages(sessionId).map((m) =>
            m === optimistic ? { ...m, pending: false, failed: true } : m,
          ),
        );
      }
    },
    [activeSessionId, commitMessages, getMessages],
  );

  const endActiveSession = useCallback(async () => {
    const sessionId = activeSessionId;
    if (!sessionId) return;
    setError(null);
    try {
      const { session } = await api.endSession(sessionId);
      setView({ kind: "ended", session, messages: getMessages(sessionId) });
      setPendingRequest(null);
      // Refresh teller statuses — the teller was freed server-side.
      void loadTellers();
    } catch (err) {
      // Fall back to the socket path (server derives STAFF_ENDED from role).
      socketEndSession(sessionId);
      setError(describeError(err, "Could not end the session cleanly."));
    }
  }, [activeSessionId, getMessages, loadTellers]);

  const resetToDashboard = useCallback(() => {
    setView({ kind: "idle" });
    setPendingRequest(null);
    setLowConfidenceAlert(null);
    void loadTellers();
  }, [loadTellers]);

  /* ------------------------------------------------------------------ */
  /* Polling: pick up sessions ended from the mobile client via REST     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!activeSessionId) return;
    const timer = window.setInterval(async () => {
      try {
        const { session } = await api.getSession(activeSessionId);
        if (session.status === "ENDED") {
          setView((current) =>
            current.kind === "active" && current.session._id === session._id
              ? { kind: "ended", session, messages: getMessages(session._id) }
              : current,
          );
          setPendingRequest(null);
          void loadTellers();
        }
      } catch {
        /* transient network blip — the socket events remain authoritative */
      }
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeSessionId, getMessages, loadTellers]);

  /* ------------------------------------------------------------------ */
  /* Derived                                                             */
  /* ------------------------------------------------------------------ */

  const assignedTellers = useMemo(
    () => (user ? tellers.filter((t) => t.staffUser === user.id) : []),
    [tellers, user],
  );

  const value = useMemo<StaffWorkspaceValue>(
    () => ({
      organization,
      user,
      tellers,
      assignedTellers,
      isLoadingOrg,
      isLoadingTellers,
      isSavingAvailability,
      setAvailability,
      view,
      pendingRequest,
      activeSessionId,
      isLoadingSession,
      lowConfidenceAlert,
      clearLowConfidenceAlert,
      connection,
      acceptRequest,
      declineRequest,
      sendReply,
      endActiveSession,
      resetToDashboard,
      reloadWorkspace,
      error,
      clearError,
    }),
    [
      organization,
      user,
      tellers,
      assignedTellers,
      isLoadingOrg,
      isLoadingTellers,
      isSavingAvailability,
      setAvailability,
      view,
      pendingRequest,
      activeSessionId,
      isLoadingSession,
      lowConfidenceAlert,
      clearLowConfidenceAlert,
      connection,
      acceptRequest,
      declineRequest,
      sendReply,
      endActiveSession,
      resetToDashboard,
      reloadWorkspace,
      error,
      clearError,
    ],
  );

  return (
    <StaffWorkspaceContext.Provider value={value}>{children}</StaffWorkspaceContext.Provider>
  );
}

export function useStaffWorkspace(): StaffWorkspaceValue {
  const ctx = useContext(StaffWorkspaceContext);
  if (!ctx) throw new Error("useStaffWorkspace must be used inside <StaffWorkspaceProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function wireToUi(m: WireMessage): UiMessage {
  return {
    id: m.id,
    sender: m.sender,
    text: m.text,
    method: m.method,
    confidence: m.confidence,
    isConfirmed: m.isConfirmed,
    timestamp: m.timestamp,
  };
}

function recordToUi(m: MessageRecord): UiMessage {
  return {
    id: m._id,
    sender: m.sender,
    text: m.text,
    method: m.method,
    confidence: m.confidence,
    isConfirmed: m.isConfirmed,
    timestamp: m.timestamp,
  };
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}
