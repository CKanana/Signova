import { type ReactNode } from "react";
import type { Theme } from "./useTheme";
/** Navigation section: { label, items } */
export interface NavSection {
    label: string;
    items: NavItem[];
}
/** Navigation item: label, icon, route, optional badge count */
export interface NavItem {
    id: string;
    label: string;
    icon: ReactNode;
    badge?: number;
}
/** Organisation card info (optional) */
export interface Organisation {
    name: string;
    serviceName?: string;
}
/** User identity (optional) */
export interface User {
    name: string;
    role: string;
    initials: string;
}
/** Sidebar footer slot children (optional, e.g. Staff teller availability) */
export type SidebarFooterProps = ReactNode;
/** Configuration injected by the host app, never markup */
export interface AppShellProps {
    /** App name overlayed on the logo ("ADMIN PORTAL" / "STAFF DESK") */
    brandLabel: string;
    /** Organisation card (Admin only) — real org name/service, not placeholder */
    organization?: Organisation;
    /** User card (Admin only) – name, role, initials */
    user?: User;
    /** Sidebar footer slots (e.g. Staff teller availability control) */
    footer?: ReactNode;
    /** Navigation sections: { label, items } */
    navSections: NavSection[];
    /** Page title + optional subtitle/heading for the top bar */
    title: string;
    /** Breadcrumb/section label under the title */
    subtitle?: string;
    /** Route section (e.g. "Management", "Records") — shown under the title */
    routeSection?: string;
    /** Live status pill text (e.g. "Counter System Online") */
    statusPill?: string;
    /** Optional refresh handler */
    onRefresh?: () => void;
    /** Optional menu/drawer button handler (visible below 760px) */
    onMenu?: () => void;
    children: ReactNode;
}
/**
 * Collapsible sidebar.
 *
 * - Expands to 260px, collapses to 84px.
 * - Stores the preference in sessionStorage (try/catch).
 * - Under 980px: auto-collapses.
 * - Under 760px: off-canvas drawer opened by the top bar menu button
 *   (backdrop + Escape to close).
 * - Keyboard accessible: real buttons, focus ring, aria-current.
 */
export declare function Sidebar({ brandLabel, organisation, user, navSections, footer, collapsed, onToggleCollapse, onOpenDrawer, isDrawerOpen, onCloseDrawer, }: {
    brandLabel: string;
    organisation?: Organisation;
    user?: User;
    navSections: NavSection[];
    footer?: SidebarFooterProps;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onOpenDrawer: () => void;
    isDrawerOpen: boolean;
    onCloseDrawer: () => void;
}): import("react").JSX.Element;
/**
 * Top bar: page title + breadcrumb/subtitle, optional status pill,
 * refresh, theme toggle, and (below 760px) a drawer menu button.
 */
export declare function Topbar({ title, subtitle, routeSection, statusPill, onRefresh, onMenu, theme, onToggleTheme, }: {
    title: string;
    subtitle?: string;
    routeSection?: string;
    statusPill?: string;
    onRefresh?: () => void;
    onMenu?: () => void;
    theme: Theme;
    onToggleTheme: () => void;
}): import("react").JSX.Element;
/**
 * Shared app shell: collapsible sidebar + top bar + main content area.
 *
 * Both Admin and Hearing Staff pass configuration (nav sections, brand,
 * identity, organisation card, status pill, footer slot) instead of markup.
 */
export declare function AppShell({ brandLabel, organization, user, footer, navSections, title, subtitle, routeSection, statusPill, onRefresh, onMenu, children, }: AppShellProps): import("react").JSX.Element;
