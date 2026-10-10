import React from "react";

/**
 * Loading / empty / error states.
 *
 * Empty states use the Signova circular badge mark instead of stock
 * illustrations, so every surface of the product reads as Signova.
 */

import badgeMark from "../../assets/brand/signova-badge-circular.png";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="staff-state" role="status" aria-live="polite">
      <span className="staff-spinner" aria-hidden="true" />
      <p className="staff-state__text">{label}</p>
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="staff-card">
      <div className="staff-card__body staff-stack">
        <div className="staff-skeleton" style={{ height: 18, width: "38%" }} />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="staff-skeleton" style={{ height: 14, width: `${92 - i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="staff-state">
      <img className="staff-state__mark" src={badgeMark} alt="" aria-hidden="true" />
      <p className="staff-state__title">{title}</p>
      {children ? <p className="staff-state__text">{children}</p> : null}
      {action}
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  action?: React.ReactNode;
}

export function ErrorBanner({ message, action }: ErrorBannerProps) {
  return (
    <div className="staff-banner staff-banner--error" role="alert">
      <span aria-hidden="true">⚠</span>
      <div className="staff-banner__body">{message}</div>
      {action ? <div className="staff-banner__actions">{action}</div> : null}
    </div>
  );
}

interface WarningBannerProps {
  message: string;
  action?: React.ReactNode;
}

export function WarningBanner({ message, action }: WarningBannerProps) {
  return (
    <div className="staff-banner staff-banner--warn" role="status">
      <span aria-hidden="true">!</span>
      <div className="staff-banner__body">{message}</div>
      {action ? <div className="staff-banner__actions">{action}</div> : null}
    </div>
  );
}
