import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const messageSentStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 620,
    alignItems: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(27,117,72,0.10)",
    borderWidth: 2,
    borderColor: "rgba(27,117,72,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  titleLarge: {
    fontSize: 38,
  },
  body: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.mutedText,
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 36,
  },
  bodyLarge: {
    fontSize: 24,
    lineHeight: 36,
  },
  buttonContainer: {
    width: "100%",
  },
});
