import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const tabletHeaderStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minHeight: 72,
  },
  navSlot: {
    width: 56,
    alignItems: "flex-start",
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
  },
  centerLockup: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  orgTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  orgTitleLarge: {
    fontSize: 24,
  },
  poweredBy: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.mutedText,
    marginTop: 2,
    textAlign: "center",
  },
  signovaBrand: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
  actionsSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(91,42,134,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconBtnActive: {
    backgroundColor: "rgba(91,42,134,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(91,42,134,0.35)",
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
