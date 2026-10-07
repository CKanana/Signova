import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const readyToSignStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 720,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  titleLarge: {
    fontSize: 38,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.mutedText,
    textAlign: "center",
    marginBottom: 20,
  },
  subtitleLarge: {
    fontSize: 22,
  },
  viewfinder: {
    marginBottom: 20,
  },
  buttonRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  primaryBtn: {
    flex: 2,
  },
  cancelBtn: {
    flex: 1,
  },
});
