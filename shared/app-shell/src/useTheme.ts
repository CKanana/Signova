// Shared light/dark theme hook.
//
// Values "light" | "dark". Defaults to prefers-color-scheme, then the
// user's saved choice (localStorage key "signova-theme", shared by both
// apps). The host app applies the theme via data-theme on the document
// root BEFORE first paint using an inline script in index.html, so there
// is no white flash on reload in dark mode.

import { useState, useEffect, useCallback } from "react";

/** Light / dark theme values */
export type Theme = "light" | "dark";

/** Storage key shared by both apps (per the spec) */
export const THEME_STORAGE_KEY = "signova-theme";

/**
 * Reads the persisted theme, falling back to the system preference.
 * Callers should pass `initialTheme` to AppShell so the theme is
 * applied before first paint (see the index.html inline script).
 */
export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return window.matchMedia("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

/**
 * Syncs the theme on the document root via data-theme so both apps see
 * the same value. The host app MUST set data-theme on <html> before
 * first paint (inline script in index.html) — this hook only re-syncs
 * when the value changes.
 */
export function useTheme(initialTheme?: Theme) {
  const [theme, setTheme] = useState<Theme>(() =>
    initialTheme ?? getInitialTheme()
  );

  const set = useCallback((next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        set(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return { theme, setTheme, set };
}
