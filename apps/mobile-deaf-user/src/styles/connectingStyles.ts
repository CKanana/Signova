import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const connectingStyles = StyleSheet.create({
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
  },
  radarWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    position: "relative",
  },
  outerPulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#D9C9EB",
    backgroundColor: "#F7F2FC",
  },
  innerAvatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  titleLarge: {
    fontSize: 38,
  },
  serviceTag: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 28,
  },
  serviceTagLarge: {
    fontSize: 21,
  },
  serviceLabel: {
    color: theme.colors.mutedText,
    fontWeight: "500",
  },
  serviceVal: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  statusCard: {
    width: "100%",
    backgroundColor: "#F8EED4",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5D9BC",
    padding: 24,
    marginBottom: 32,
  },
  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  progressBarTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#E2D3B3",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 5,
  },
  waitHint: {
    marginTop: theme.spacing.md,
    color: theme.colors.mutedText,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  errorRow: {
    marginTop: theme.spacing.lg,
    alignItems: "center",
    gap: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
