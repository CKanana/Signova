import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const offlineStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 620,
    alignItems: "center",
    textAlign: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEF3C7",
    borderWidth: 2,
    borderColor: "#FDE68A",
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
    marginBottom: 36,
    maxWidth: 480,
  },
  bodyLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  buttonStack: {
    width: "100%",
    gap: 14,
  },
});
