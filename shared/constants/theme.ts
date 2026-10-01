export const theme = {
  colors: {
    primary: "#5B2A86",
    onPrimary: "#FFFFFF",
    background: "#FFF8DC",
    surface: "#FFFFFF",
    text: "#241F27",
    mutedText: "#68636B",
    border: "#DED8C8",
    success: "#1B7548",
    warning: "#965300",
    danger: "#B3261E",
    focus: "#315EA8",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radii: {
    control: 12,
    panel: 20,
    pill: 999,
  },
} as const;

export type WebThemeTarget = {
  style: {
    setProperty: (name: string, value: string) => void;
  };
};

export function applyWebTheme(target: WebThemeTarget): void {
  const variables = {
    "--signova-primary": theme.colors.primary,
    "--signova-on-primary": theme.colors.onPrimary,
    "--signova-background": theme.colors.background,
    "--signova-surface": theme.colors.surface,
    "--signova-text": theme.colors.text,
    "--signova-muted-text": theme.colors.mutedText,
    "--signova-border": theme.colors.border,
    "--signova-success": theme.colors.success,
    "--signova-focus": theme.colors.focus,
  };

  for (const [name, value] of Object.entries(variables)) {
    target.style.setProperty(name, value);
  }
}