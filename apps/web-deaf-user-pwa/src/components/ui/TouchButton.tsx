import React from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "touch" | "icon";

interface TouchButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

const SIZE_PADDING: Record<ButtonSize, string> = {
  sm: "6px 12px",
  md: "8px 16px",
  lg: "10px 20px",
  touch: "14px 24px",
  icon: "8px",
};

const SIZE_FONT: Record<ButtonSize, string> = {
  sm: "14px",
  md: "15px",
  lg: "16px",
  touch: "17px",
  icon: "16px",
};

export function TouchButton({
  children,
  onPress,
  variant = "primary",
  size = "touch",
  icon,
  disabled = false,
  loading = false,
  className,
  style,
  accessibilityLabel,
  fullWidth = false,
}: TouchButtonProps) {
  const base = clsx(
    "sn-button",
    variant && `sn-button--${variant}`,
    size && `sn-button--${size}`,
    (disabled || loading) && "sn-button--disabled",
    loading && "sn-button--loading",
    fullWidth && "sn-button--full",
    className,
  );

  const containerStyle: React.CSSProperties = {
    padding: SIZE_PADDING[size],
    fontSize: SIZE_FONT[size],
    borderRadius: "var(--signova-radius-control)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: fullWidth ? undefined : 0,
    width: fullWidth ? "100%" : undefined,
    transition: "background 0.15s, border-color 0.15s, color 0.15s, transform 0.05s",
    ...style,
  };

  // Background / text colors per variant.
  let bg = "transparent";
  let borderColor = "var(--signova-border)";
  let color = "var(--signova-text)";

  if (variant === "primary" || variant === "danger") {
    bg = variant === "danger" ? "var(--signova-danger)" : "var(--signova-primary)";
    color = "var(--signova-on-primary)";
    borderColor = "transparent";
  } else if (variant === "accent") {
    bg = "var(--signova-primary)";
    color = "var(--signova-on-primary)";
    borderColor = "transparent";
  } else if (variant === "outline") {
    borderColor = "var(--signova-primary)";
    color = "var(--signova-primary)";
  } else if (variant === "ghost") {
    color = "var(--signova-text)";
  } else if (variant === "secondary") {
    bg = "var(--signova-surface)";
    borderColor = "var(--signova-border)";
    color = "var(--signova-text)";
  }

  if (disabled || loading) {
    bg = "rgba(104, 99, 107, 0.25)";
    borderColor = "transparent";
    color = "var(--signova-muted-text)";
  }

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || loading}
      aria-label={accessibilityLabel || (typeof children === "string" ? children : undefined)}
      aria-disabled={disabled || loading || undefined}
      className={base}
      style={{
        ...containerStyle,
        background: bg,
        border: `1px solid ${borderColor}`,
        color,
      }}
    >
      {loading ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "sn-spin 0.8s linear infinite" }}
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      ) : (
        <>
          {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
          {typeof children === "string" ? (
            <span style={{ fontWeight: 500 }}>{children}</span>
          ) : (
            children
          )}
        </>
      )}
    </button>
  );
}
