import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0B1A",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  brandIconBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  brandLogo: {
    width: 96,
    height: 96,
    borderRadius: 28,
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(205,184,245,0.85)",
    textAlign: "center",
    lineHeight: 26,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 48,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.9 },
  dot3: { opacity: 0.6 },
});
