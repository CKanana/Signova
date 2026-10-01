import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const appStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  brandMark: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.control,
    backgroundColor: theme.colors.primary,
  },
  brandMarkText: {
    color: theme.colors.onPrimary,
    fontSize: 32,
    fontWeight: "800",
  },
  brandName: {
    marginTop: theme.spacing.sm,
    color: theme.colors.primary,
    fontSize: 30,
    fontWeight: "800",
  },
  eyebrow: {
    marginTop: theme.spacing.xl,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: "800",
  },
  body: {
    maxWidth: 380,
    marginTop: theme.spacing.sm,
    color: theme.colors.mutedText,
    fontSize: 18,
    lineHeight: 27,
    textAlign: "center",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
});