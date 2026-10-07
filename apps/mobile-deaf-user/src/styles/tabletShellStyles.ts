import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const tabletShellStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  outerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  outerContainerTablet: {
    padding: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  tabletDeviceFrame: {
    flex: 1,
    width: "100%",
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  tabletFrameBorder: {
    maxWidth: 960,
    maxHeight: 1100,
    borderRadius: 28,
    borderWidth: 8,
    borderColor: "#241F27",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  statusBarHardware: {
    height: 32,
    backgroundColor: "#241F27",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBarTime: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#48BB78",
  },
  sessionStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  contentViewport: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  largeTextViewport: {},
  devBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FAF6ED",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
  },
  devLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  devLinkText: {
    fontSize: 11,
    color: theme.colors.mutedText,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
