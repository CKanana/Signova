import { type ReactNode } from "react";
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
export interface SidebarFooterProps {
    children?: ReactNode;
}
/** Navigation sections: { label, items } */
export interface NavSections {
    label: string;
    items: NavItem[];
}
/** Configuration injected by the host app, never markup */
export interface SidebarProps {
    /** App name overlayed on the logo ("ADMIN PORTAL" / "STAFF DESK") */
    brandLabel: string;
    /** Organisation card (Admin only) */
    organisation?: Organisation;
    /** User card (Admin only) – name, role, initials */
    user?: User;
    /** Navigation sections with items */
    navSections: NavSections[];
    /** Sidebar footer slots (required for Staff teller availability) */
    footer?: SidebarFooterProps;
    /** Collapsed state */
    collapsed: boolean;
    /** Toggle collapse/expand */
    onToggleCollapse: () => void;
    /** Open the off-canvas drawer (below 760px) */
    onOpenDrawer: () => void;
    /** Drawer open state */
    isDrawerOpen: boolean;
    /** Close the drawer */
    onCloseDrawer: () => void;
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
export declare function Sidebar({ brandLabel, organisation, user, navSections, footer, collapsed, onToggleCollapse, onOpenDrawer, isDrawerOpen, onCloseDrawer, }: SidebarProps): import("react").JSX.Element;
