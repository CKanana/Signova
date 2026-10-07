import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const textMessageStyles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 680,
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
    marginBottom: 24,
  },
  subtitleLarge: {
    fontSize: 21,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },
  textArea: {
    width: "100%",
    minHeight: 180,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 20,
    fontSize: 20,
    color: theme.colors.text,
    lineHeight: 28,
  },
  textAreaLarge: {
    fontSize: 24,
    lineHeight: 34,
    minHeight: 220,
  },
  buttonRow: {
    width: "100%",
    gap: 12,
  },
});
