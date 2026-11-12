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
  /** Overlay behind the status bar; hosts the status bar background color. */
  statusBarOverlay: {
    height: 24,
    backgroundColor: theme.colors.primary,
  },
  outerContainerTablet: {
    padding: 0,
    alignItems: "stretch",
  },
  tabletDeviceFrame: {
    flex: 1,
    width: "100%",
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  tabletFrameBorder: {
    maxWidth: 1024,
    maxHeight: 1366,
    borderRadius: 0,
    borderWidth: 0,
    shadowColor: "#241F27",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
    alignSelf: "center",
    width: "100%",
  },
  statusBarHardware: {
    height: 36,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusBarTime: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  sessionStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  greenStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  sessionStatusText: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  contentViewport: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  largeTextViewport: {},
  devBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
  },
  devLink: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  devLinkText: {
    fontSize: 11,
    color: theme.colors.mutedText,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
