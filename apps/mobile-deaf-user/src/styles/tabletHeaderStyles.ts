import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const tabletHeaderStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    minHeight: 64,
  },
  navSlot: {
    width: 52,
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
    paddingHorizontal: 8,
  },
  orgTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  orgTitleLarge: {
    fontSize: 21,
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
    gap: 6,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2E8",
  },
  iconBtnActive: {
    backgroundColor: "#EDE4F7",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
});
