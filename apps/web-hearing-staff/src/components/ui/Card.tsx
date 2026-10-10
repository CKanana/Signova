import React from "react";

/**
 * The core Signova surface — a soft-radius bordered card mirroring the
 * mobile AccessibleCard. Optional selected state for list items.
 */

interface CardProps {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}

export function Card({ children, selected = false, className, as: Tag = "div" }: CardProps) {
  const classes = ["staff-card", selected ? "staff-card--selected" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <Tag className={classes}>{children}</Tag>;
}

interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
  eyebrow?: string;
}

export function CardHeader({ title, action, eyebrow }: CardHeaderProps) {
  return (
    <div className="staff-card__header">
      <div>
        {eyebrow ? <div className="staff-eyebrow">{eyebrow}</div> : null}
        <h3 className="staff-card__title">{title}</h3>
      </div>
      {action ? <div style={{ marginLeft: "auto" }}>{action}</div> : null}
    </div>
  );
}
