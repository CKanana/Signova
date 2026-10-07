import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  brandIconBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#F8EED4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    fontSize: 20,
    fontWeight: "600",
    color: "#F2EADB",
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 48,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F8EED4",
  },
  dot1: { opacity: 0.6 },
  dot2: { opacity: 0.9 },
  dot3: { opacity: 0.4 },
});
