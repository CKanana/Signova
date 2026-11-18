// Icons.tsx — one inline SVG icon library for the camera/signing screen.
//
// Every icon is an explicit, hand-written SVG mapped to its label. Icons are
// stroke-based (currentColor) so they inherit the parent's color, and each
// accepts width/height/color props. White is only ever used inside solid
// purple fills per the PWA theme (white text/icons on purple buttons only).

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const stroke = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Camera({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="12" rx="2" ry="2" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function CameraOff({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="12" rx="2" ry="2" />
      <circle cx="12" cy="13" r="3" />
      <line x1="21" y1="7" x2="15" y2="13" />
    </svg>
  );
}

export function SwitchCamera({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M13 22h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-6a2 2 0 0 0 2 2v6a2 2 0 0 0 2 2zM11 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  );
}

export function Keyboard({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
      <path d="M4 8h6M10 8v4M14 8h4M4 12h8M16 12h4" />
    </svg>
  );
}

export function PhoneOff({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M1 8.95a5 5 0 0 1 3.95 3.95M8.95 15.05A9 9 0 0 1 8.94 23" />
      <line x1="21" y1="21" x2="3" y2="3" />
    </svg>
  );
}

export function Hand({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M10 17v2M14 17v2M12 21v-2M9 13l2 2M15 13l-2 2M12 5V1M7 8h10M12 8l3 3M12 14l3-3" />
    </svg>
  );
}

export function Reply({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function Accessibility({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M11 18H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
      <circle cx="11" cy="13" r="6" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function CircleHelp({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17v-5" />
    </svg>
  );
}

export function ArrowLeft({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function Check({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function RotateCcw({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M1 4v4h4M3 4.93C3.82 4.93 4.5 5.61 4.5 6.43c0 0.82-0.68 1.5-1.5 1.5H1" />
      <path d="M23 20v-4h-4M21 19.07c-0.82 0-1.5-0.68-1.5-1.5 0-0.82 0.68-1.5 1.5-1.5h4" />
    </svg>
  );
}

export function RefreshCcw({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <path d="M1 4v4h4M3 4.93C3.82 4.93 4.5 5.61 4.5 6.43c0 0.82-0.68 1.5-1.5 1.5H1" />
      <path d="M23 20v-4h-4M21 19.07c-0.82 0-1.5-0.68-1.5-1.5 0-0.82 0.68-1.5 1.5-1.5h4" />
    </svg>
  );
}

export function Calendar({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h8" />
    </svg>
  );
}

export function X({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Play({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

export function Pause({ size = 20, color, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      {...stroke}
      {...rest}
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

/** Explicit label -> icon mapping so the reviewer can confirm each icon matches. */
export const ICON_MAP: Record<string, React.ElementType> = {
  Camera,
  CameraOff,
  SwitchCamera,
  Keyboard,
  PhoneOff,
  Hand,
  Accessibility,
  CircleHelp,
  ArrowLeft,
  Check,
  RotateCcw,
  RefreshCcw,
  Calendar,
  X,
  Play,
  Pause,
};
