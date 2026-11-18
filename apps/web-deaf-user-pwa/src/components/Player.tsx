import { useEffect, useRef, useState } from "react";

interface PlayerProps {
  message: {
    animation?: {
      status: "pending" | "ready" | "failed" | "skipped";
      url: string | null;
      durationMs: number | null;
      requestedAt: string | null;
      readyAt: string | null;
      error: string | null;
    } | null;
    text: string;
  };
  onStatusChange: (status: "pending" | "ready" | "failed" | "skipped") => void;
  onRetry: () => void;
  onMessageUpdated?: (
    message: {
      id: string;
      sender: "staff" | "user";
      text: string;
      timestamp: string;
      animation?: {
        status: "pending" | "ready" | "failed" | "skipped";
        url: string | null;
        durationMs: number | null;
        requestedAt: string | null;
        readyAt: string | null;
        error: string | null;
      } | null;
    },
  ) => void;
}

function StickFigure({ size, color }: { size: number; color: string }) {
  const half = size / 2;
  const head = <circle cx={half} cy={half - 6} r={size * 0.25} fill={color} />;
  const body =
    <line
      x1={half}
      y1={half - 6}
      x2={half}
      y2={half + 8}
      stroke={color}
      strokeWidth={size * 0.18}
      strokeLinecap="round"
    />;
  const armL =
    <line
      x1={half - 6}
      y1={half - 2}
      x2={half - 14}
      y2={half - 18}
      stroke={color}
      strokeWidth={size * 0.14}
      strokeLinecap="round"
    />;
  const armR =
    <line
      x1={half + 6}
      y1={half - 2}
      x2={half + 14}
      y2={half - 18}
      stroke={color}
      strokeWidth={size * 0.14}
      strokeLinecap="round"
    />;
  const legL =
    <line
      x1={half - 4}
      y1={half + 8}
      x2={half - 10}
      y2={half + 20}
      stroke={color}
      strokeWidth={size * 0.14}
      strokeLinecap="round"
    />;
  const legR =
    <line
      x1={half + 4}
      y1={half + 8}
      x2={half + 10}
      y2={half + 20}
      stroke={color}
      strokeWidth={size * 0.14}
      strokeLinecap="round"
    />;
  return (
    <g>
      {head}
      {body}
      {armL}
      {armR}
      {legL}
      {legR}
    </g>
  );
}

export function Player({
  message,
  onStatusChange,
  onRetry: _onRetry,
  onMessageUpdated: _onMessageUpdated,
}: PlayerProps) {
  const [phase, setPhase] = useState<"pending" | "ready" | "failed" | "skipped">(
    "pending",
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (message.animation?.status === "pending") {
      setPhase("pending");
      onStatusChange("pending");
      const t = setTimeout(() => {
        setPhase("ready");
        onStatusChange("ready");
      }, 1200);
      return () => clearTimeout(t);
    }
    if (message.animation?.status === "ready") {
      setPhase("ready");
      onStatusChange("ready");
      return;
    }
    if (message.animation?.status === "failed") {
      setPhase("failed");
      onStatusChange("failed");
      return;
    }
    if (message.animation?.status === "skipped") {
      setPhase("skipped");
      onStatusChange("skipped");
    }
  }, [message.animation?.status, onStatusChange]);

  useEffect(() => {
    if (phase !== "ready") return;
    const step = 60;
    const start = performance.now();

    const tick = () => {
      const t = performance.now() - start;
      const progress = t / step;
      if (progress >= 1) {
        // Advance the placeholder frame only on completion (no-op loop otherwise).
        void progress;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [phase]);

  const figureSize = 36;
  const el = (
    <svg width={figureSize} height={figureSize + 8} viewBox="0 0 40 48" style={{ display: "block" }}>
      <StickFigure size={figureSize} color="#B42318" />
    </svg>
  );

  return (
    <div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        {el}
      </div>
    </div>
  );
}
