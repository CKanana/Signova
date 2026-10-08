import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const translatingStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 600,
    alignItems: "center",
    textAlign: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F8EED4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  titleLarge: {
    fontSize: 40,
  },
  body: {
    fontSize: 19,
    color: theme.colors.mutedText,
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 32,
  },
  bodyLarge: {
    fontSize: 22,
  },
  progressTrack: {
    width: "100%",
    height: 12,
    backgroundColor: "#E6DBC2",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 36,
  },
  progressFill: {
    width: "80%",
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
  },
  errorWrap: {
    marginTop: 24,
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
