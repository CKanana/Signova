import React from "react";

/**
 * Button. Mirrors the mobile TouchButton variants at desktop hit sizes
 * (min 44px). Every button keeps a visible focus ring from the global
 * :focus-visible rule.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "staff-btn",
    `staff-btn--${variant}`,
    size === "sm" ? "staff-btn--sm" : "",
    block ? "staff-btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <span className="staff-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
