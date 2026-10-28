import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const icon = {
    className: "app-topbar__action-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
};
export function Topbar({ title, subtitle, routeSection, statusPill, onRefresh, onMenu, theme, onToggleTheme, }) {
    const dark = theme === "dark";
    return (_jsxs("header", { className: "app-topbar", children: [_jsxs("div", { className: "app-topbar__left", children: [_jsx("h1", { className: "app-topbar__title", children: title }), subtitle || routeSection ? (_jsx("div", { className: "app-topbar__subtitle", children: subtitle ?? routeSection })) : null] }), _jsxs("div", { className: "app-topbar__right", children: [statusPill ? (_jsxs("div", { className: "app-topbar__status", children: [_jsx("span", { className: "app-topbar__status-dot" }), statusPill] })) : null, onRefresh ? (_jsx("button", { type: "button", className: "app-topbar__action", onClick: onRefresh, "aria-label": "Refresh view", children: _jsx("svg", { ...icon, children: _jsx("path", { d: "M20 11a8 8 0 1 0-2 5M20 4v7h-7" }) }) })) : null, _jsx("button", { type: "button", className: "app-topbar__action", onClick: onToggleTheme, "aria-label": dark ? "Switch to light mode" : "Switch to dark mode", children: dark ? (_jsxs("svg", { ...icon, children: [_jsx("circle", { cx: "12", cy: "12", r: "4" }), _jsx("path", { d: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" })] })) : (_jsx("svg", { ...icon, children: _jsx("path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }) })) }), _jsx("button", { type: "button", className: "app-topbar__action app-topbar__action--menu", onClick: onMenu, "aria-label": "Open navigation menu", children: _jsx("svg", { ...icon, children: _jsx("path", { d: "M3 6h18M3 12h18M3 18h18" }) }) })] })] }));
}
//# sourceMappingURL=Topbar.js.map