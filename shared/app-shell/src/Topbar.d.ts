/** Status pill text, e.g. "Counter System Online" */
export interface TopbarProps {
    title: string;
    subtitle?: string;
    routeSection?: string;
    statusPill?: string;
    /** Optional refresh handler */
    onRefresh?: () => void;
    /** Optional menu/drawer button (shown below 760px) */
    onMenu?: () => void;
    theme: Theme;
    onToggleTheme: () => void;
}
/** Theme values: light | dark */
export type Theme = "light" | "dark";
/**
 * Top bar: page title + breadcrumb/subtitle, status pill, refresh, theme
 * toggle, user avatar, and (below 760px) a drawer menu button.
 */
export declare function Topbar({ title, subtitle, routeSection, statusPill, onRefresh, onMenu, theme, onToggleTheme, }: TopbarProps): import("react").JSX.Element;
