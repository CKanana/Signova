import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const messageSentStyles = StyleSheet.create({
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
    backgroundColor: "#DCFCE7",
    borderWidth: 2,
    borderColor: "#86EFAC",
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
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.mutedText,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 36,
  },
  bodyLarge: {
    fontSize: 26,
    lineHeight: 38,
  },
  buttonContainer: {
    width: "100%",
  },
});
