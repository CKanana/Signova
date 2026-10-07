import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const staffResponseStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 780,
  },
  responseCard: {
    backgroundColor: "#F8EED4",
    borderRadius: 24,
    borderLeftWidth: 8,
    borderLeftColor: theme.colors.success,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#E5D9BC",
    padding: 32,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  staffHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  staffAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DED8C8",
  },
  staffMeta: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.success,
    letterSpacing: 1.2,
  },
  staffNameTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 2,
  },
  responseText: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    lineHeight: 44,
  },
  responseTextLarge: {
    fontSize: 38,
    lineHeight: 52,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
});
