import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const liveSigningStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 760,
  },
  viewfinder: {
    marginBottom: 14,
  },
  translationBanner: {
    backgroundColor: "#F8EED4",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5D9BC",
    padding: 20,
    marginBottom: 16,
  },
  bannerEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  glossText: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    lineHeight: 32,
  },
  glossTextLarge: {
    fontSize: 28,
    lineHeight: 38,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  controlBtn: {
    flex: 1,
  },
});
