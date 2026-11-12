import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  /** ms — defaults to 5000; pass 0 to persist until manually dismissed */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => string;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

let _uid = 0;
function uid() {
  return `toast-${++_uid}-${Date.now()}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: Omit<Toast, "id">): string => {
      const id = uid();
      const duration = opts.duration ?? 5000;
      setToasts((prev) => [...prev, { ...opts, id }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, title?: string) => { toast({ variant: "success", message, title }); },
    [toast]
  );
  const error = useCallback(
    (message: string, title?: string) => { toast({ variant: "danger", message, title, duration: 8000 }); },
    [toast]
  );
  const warning = useCallback(
    (message: string, title?: string) => { toast({ variant: "warning", message, title, duration: 6000 }); },
    [toast]
  );
  const info = useCallback(
    (message: string, title?: string) => { toast({ variant: "info", message, title }); },
    [toast]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((timer) => clearTimeout(timer)); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Toast Container & Item ───────────────────────────────────────────────────

const ICONS: Record<ToastVariant, string> = {
  success: "✓",
  danger: "✕",
  warning: "⚠",
  info: "ℹ",
};

const COLORS: Record<ToastVariant, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: "var(--admin-success-soft, #E6F5EC)",
    border: "var(--admin-success-border, #B8E4C9)",
    icon: "var(--admin-success, #177C45)",
    text: "var(--admin-success, #177C45)",
  },
  danger: {
    bg: "var(--admin-danger-soft, #FDECEA)",
    border: "var(--admin-danger-border, #F5B8B4)",
    icon: "var(--admin-danger, #B82821)",
    text: "var(--admin-danger, #B82821)",
  },
  warning: {
    bg: "var(--admin-warning-soft, #FFF2DD)",
    border: "var(--admin-warning-border, #F7D49E)",
    icon: "var(--admin-warning, #9E5B00)",
    text: "var(--admin-warning, #9E5B00)",
  },
  info: {
    bg: "var(--admin-primary-soft, #F3EDF8)",
    border: "var(--admin-primary-border, #D8C6E6)",
    icon: "var(--admin-primary, #5B2A86)",
    text: "var(--admin-primary, #5B2A86)",
  },
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const c = COLORS[t.variant];
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        borderRadius: "10px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        minWidth: "280px",
        maxWidth: "420px",
        animation: "toastSlideIn 200ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Icon */}
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: c.icon,
          color: "#fff",
          fontSize: "11px",
          fontWeight: "800",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        {ICONS[t.variant]}
      </span>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title && (
          <div style={{ fontWeight: "700", fontSize: "13.5px", color: c.text, marginBottom: "2px" }}>
            {t.title}
          </div>
        )}
        <div style={{ fontSize: "13px", color: "var(--admin-text, #1C1921)", lineHeight: "1.45" }}>
          {t.message}
        </div>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--admin-text-muted, #8E8796)",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      <div
        aria-label="Notifications"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem t={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
