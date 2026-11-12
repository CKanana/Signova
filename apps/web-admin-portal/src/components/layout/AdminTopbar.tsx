import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { SunIcon, MoonIcon, RefreshIcon } from "../../components/ui/Icons";
import { DashboardIcon } from "../../components/ui";
import { useState, useEffect } from "react";

/** Route title map — reused by the topbar and, where relevant, the route titles. */
const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  "/admin/overview": { section: "Overview", title: "Executive Overview" },
  "/admin/staff": { section: "Management", title: "Staff Directory" },
  "/admin/tellers": { section: "Management", title: "Service Counters & Tellers" },
  "/admin/sessions": { section: "Records", title: "Communication Sessions" },
  "/admin/audit": { section: "Records", title: "Audit Records" },
  "/admin/settings": { section: "Settings", title: "Organization Configuration" },
  "/admin/account": { section: "Settings", title: "Administrator Account" },
};

const THEME_KEY = "signova-theme";

/** Admin topbar: breadcrumbs, system indicator, and the theme toggle. */
export function AdminTopbar() {
  const { user } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    } catch {
      // storage unavailable
    }
  }, []);

  // Apply theme via data-theme attribute (matches shared AppShell useTheme hook)
  // and keep .admin-dark as a fallback alias.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (theme === "dark") {
      root.classList.add("admin-dark");
    } else {
      root.classList.remove("admin-dark");
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  const routeInfo = ROUTE_TITLES[location.pathname] ?? { section: "Admin", title: "Overview" };

  if (!mounted) return null;

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__breadcrumbs">
        <span>{routeInfo.section}</span>
        <span>/</span>
        <span className="admin-topbar__crumb-active">{routeInfo.title}</span>
      </div>

      <div className="admin-topbar__actions">
        <div className="admin-system-indicator" title="Signova Admin Portal">
          <span className="admin-system-indicator__dot" />
          <span>Admin Portal</span>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--icon"
          onClick={() => navigate("/admin/overview")}
          aria-label="Go to dashboard"
        >
          <DashboardIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--icon"
          onClick={() => window.location.reload()}
          aria-label="Refresh view"
        >
          <RefreshIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--icon"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
