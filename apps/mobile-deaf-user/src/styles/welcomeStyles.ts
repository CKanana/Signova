import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const welcomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  blurLayer: {
    ...StyleSheet.absoluteFill,
  },
  imageScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(28, 20, 38, 0.34)",
  },
  screenContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  screenContentTablet: {
    paddingHorizontal: 48,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  headerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 248, 220, 0.94)",
  },
  headerButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  welcomeCopy: {
    width: "100%",
    maxWidth: 600,
    marginTop: "auto",
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  welcomeCopyTablet: {
    maxWidth: 720,
    paddingTop: 0,
    marginBottom: theme.spacing.md,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F8EED4",
    letterSpacing: 1.2,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 46,
    textShadowColor: "rgba(0, 0, 0, 0.28)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleLarge: {
    fontSize: 44,
    lineHeight: 52,
  },
  titleTablet: {
    maxWidth: 680,
    fontSize: 54,
    lineHeight: 62,
  },
  subtitle: {
    maxWidth: 540,
    marginTop: theme.spacing.md,
    color: "#F8F2E8",
    fontSize: 18,
    lineHeight: 27,
  },
  subtitleLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  buttonStack: {
    width: "100%",
    maxWidth: 480,
    gap: theme.spacing.sm,
  },
  buttonStackTablet: {
    gap: theme.spacing.md,
  },
});
