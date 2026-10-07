import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const sessionCompleteStyles = StyleSheet.create({
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
    marginBottom: 24,
    maxWidth: 480,
  },
  bodyLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8EED4",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 36,
  },
  privacyPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  buttonStack: {
    width: "100%",
    gap: 14,
  },
});
