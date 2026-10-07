import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const uncertainFallbackStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 720,
  },
  eyebrow: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.primary,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
    flex: 1,
  },
  messageCard: {
    backgroundColor: "#F8EED4",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E5D9BC",
    padding: 30,
    marginBottom: 32,
  },
  messageText: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    lineHeight: 44,
  },
  messageTextLarge: {
    fontSize: 38,
    lineHeight: 52,
  },
  buttonStack: {
    width: "100%",
    gap: 14,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfBtn: {
    flex: 1,
  },
});
