import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useTheme } from "./useTheme";
const COLLAPSE_KEY = "signova.app.sidebar.collapsed";
function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const m = window.matchMedia(query);
        const update = () => setMatches(m.matches);
        update();
        m.addEventListener("change", update);
        return () => m.removeEventListener("change", update);
    }, [query]);
    return matches;
}
function readCollapsed() {
    try {
        const v = localStorage.getItem(COLLAPSE_KEY);
        if (v !== null)
            return v === "1";
    }
    catch { /* ignore */ }
    return window.matchMedia("(max-width: 980px)").matches;
}
export function AppShell({ brandLabel, logoSrc, organization, user, onSignOut, footer, navSections, title, subtitle, routeSection, statusPill, onRefresh, onMenu, children, }) {
    const { theme, toggle } = useTheme();
    const { pathname } = useLocation();
    const isMobile = useMediaQuery("(max-width: 760px)");
    const isNarrow = useMediaQuery("(max-width: 980px)");
    const [pref, setPref] = useState(readCollapsed);
    const [drawerOpen, setDrawerOpen] = useState(false);
    // Auto-collapse on narrow screens (not saved as the user's choice).
    useEffect(() => { if (isNarrow)
        setPref(true); }, [isNarrow]);
    // Close the drawer on navigation, on leaving mobile, and on Escape.
    useEffect(() => setDrawerOpen(false), [pathname, isMobile]);
    useEffect(() => {
        if (!drawerOpen)
            return;
        const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen]);
    // In the mobile drawer the sidebar is always shown expanded.
    const collapsed = !isMobile && pref;
    const toggleSidebar = () => {
        if (isMobile)
            return setDrawerOpen(false);
        const next = !pref;
        setPref(next);
        try {
            localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
        }
        catch { /* ignore */ }
    };
    return (_jsxs("div", { className: "app-shell", children: [_jsx(Sidebar, { brandLabel: brandLabel, logoSrc: logoSrc, organisation: organization, user: user, onSignOut: onSignOut, navSections: navSections, footer: footer, collapsed: collapsed, isDrawerOpen: drawerOpen, onToggleCollapse: toggleSidebar }), drawerOpen ? (_jsx("div", { className: "app-sidebar__backdrop", onClick: () => setDrawerOpen(false), "aria-hidden": "true" })) : null, _jsxs("div", { className: "app-main", children: [_jsx(Topbar, { title: title, subtitle: subtitle, routeSection: routeSection, statusPill: statusPill, onRefresh: onRefresh, onMenu: () => { setDrawerOpen(true); onMenu?.(); }, theme: theme, onToggleTheme: toggle }), _jsx("main", { className: "app-main__content", children: children })] })] }));
}
//# sourceMappingURL=AppShell.js.map