// Shared app shell barrel.
//
// Reused by the Admin portal and the Hearing Staff dashboard.
// Each app imports only from here; styles live in app-shell.css.

export { AppShell, type AppShellProps, type NavSections } from "./AppShell";
export { Sidebar, type SidebarProps, type NavItem, type Organisation, type User, type SidebarFooterProps } from "./Sidebar";
export { Topbar, type TopbarProps } from "./Topbar";
export { useTheme, type Theme, getInitialTheme, THEME_STORAGE_KEY } from "./useTheme";
export { default as appShellCss } from "./app-shell.css";
