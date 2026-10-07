import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const confirmSignStyles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.primary,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  messageCard: {
    backgroundColor: "#F8EED4",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E5D9BC",
    padding: 32,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
