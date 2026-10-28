export type Theme = "light" | "dark";
export declare const THEME_STORAGE_KEY = "signova-theme";
export declare function getInitialTheme(): Theme;
export declare function applyTheme(theme: Theme): void;
export declare function useTheme(): {
    theme: Theme;
    setTheme: (next: Theme) => void;
    toggle: () => void;
};
