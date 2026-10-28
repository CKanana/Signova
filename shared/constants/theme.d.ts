export declare const theme: {
    readonly colors: {
        readonly primary: "#5B2A86";
        readonly onPrimary: "#FFFFFF";
        readonly background: "#FFF8DC";
        readonly surface: "#FFFFFF";
        readonly text: "#241F27";
        readonly mutedText: "#68636B";
        readonly border: "#DED8C8";
        readonly success: "#1B7548";
        readonly warning: "#965300";
        readonly danger: "#B3261E";
        readonly focus: "#315EA8";
    };
    readonly spacing: {
        readonly xs: 4;
        readonly sm: 8;
        readonly md: 16;
        readonly lg: 24;
        readonly xl: 32;
    };
    readonly radii: {
        readonly control: 12;
        readonly panel: 20;
        readonly pill: 999;
    };
};
export type WebThemeTarget = {
    style: {
        setProperty: (name: string, value: string) => void;
    };
};
export declare function applyWebTheme(target: WebThemeTarget): void;
