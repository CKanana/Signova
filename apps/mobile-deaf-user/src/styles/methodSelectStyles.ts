import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const methodSelectStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  blurLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(48, 22, 70, 0.68)",
  },
  screenContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  screenContentTablet: {
    paddingHorizontal: 48,
    paddingVertical: theme.spacing.md,
  },
  screenContentCompactTablet: {
    paddingHorizontal: 36,
    paddingVertical: theme.spacing.xs,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    gap: theme.spacing.md,
  },
  topBarCompactTablet: {
    minHeight: 48,
  },
  topBarCompactPhone: {
    minHeight: 44,
    gap: theme.spacing.sm,
  },
  brandAndOrganisation: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.md,
  },
  brandAndOrganisationCompactPhone: {
    gap: theme.spacing.sm,
  },
  brandLogo: {
    width: 136,
    height: 50,
  },
  brandLogoMobile: {
    width: 116,
    height: 43,
  },
  brandLogoCompactPhone: {
    width: 104,
    height: 38,
  },
  brandLogoSmallPhone: {
    width: 76,
    height: 28,
  },
  brandDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
  },
  organisationLockup: {
    flex: 1,
    minWidth: 0,
  },
  organisationLockupCompactPhone: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 64,
    width: 64,
    minWidth: 64,
  },
  organisationLockupSmallPhone: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 46,
    width: 46,
    minWidth: 46,
  },
  organisationShortName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  organisationShortNameSmallPhone: {
    fontSize: 12,
  },
  organisationName: {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 13,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  headerActionsCompactPhone: {
    gap: theme.spacing.xs,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 248, 220, 0.96)",
  },
  headerButtonCompactPhone: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerButtonSmallPhone: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  heading: {
    alignItems: "center",
    width: "100%",
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headingCompactTablet: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  eyebrowRule: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(248, 238, 212, 0.8)",
  },
  eyebrow: {
    color: "#F8EED4",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  title: {
    maxWidth: 900,
    color: "#FFFFFF",
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleLarge: {
    fontSize: 42,
    lineHeight: 50,
  },
  titleCompactTablet: {
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
  },
  subtitleLarge: {
    fontSize: 21,
    lineHeight: 29,
  },
  subtitleCompactTablet: {
    marginTop: theme.spacing.xs,
    fontSize: 16,
    lineHeight: 21,
  },
  cardsContainer: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  cardsContainerTablet: {
    flexDirection: "row",
    gap: theme.spacing.lg,
  },
  cardsContainerCompactTablet: {
    paddingBottom: 0,
    gap: theme.spacing.md,
  },
  methodCard: {
    flex: 1,
    minHeight: 172,
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.64)",
    backgroundColor: "transparent",
  },
  methodCardTablet: {
    minHeight: 270,
  },
  methodCardCompactTablet: {
    minHeight: 0,
  },
  signCard: {
    borderColor: "rgba(246, 215, 255, 0.78)",
  },
  textCard: {
    borderColor: "rgba(255, 248, 220, 0.92)",
    backgroundColor: theme.colors.background,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  textCardImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "58%",
    height: "100%",
  },
  cardTint: {
    ...StyleSheet.absoluteFill,
  },
  signTint: {
    backgroundColor: "rgba(74, 31, 110, 0.64)",
  },
  textTint: {
    backgroundColor: "rgba(255, 248, 220, 0.76)",
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: theme.spacing.lg,
    zIndex: 2,
  },
  cardContentCompactTablet: {
    padding: theme.spacing.md,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8EED4",
  },
  iconBubbleCompactTablet: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  cardCopy: {
    width: "100%",
    marginTop: theme.spacing.md,
  },
  cardCopyCompactTablet: {
    marginTop: theme.spacing.sm,
  },
  textCardCopy: {
    width: "65%",
    maxWidth: 230,
  },
  cardTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },
  cardTitleLarge: {
    fontSize: 32,
    lineHeight: 38,
  },
  signTitle: {
    color: "#FFFFFF",
  },
  textTitle: {
    color: theme.colors.text,
  },
  cardDescription: {
    maxWidth: 400,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  signDescription: {
    color: "#F8EED4",
  },
  textDescription: {
    color: theme.colors.mutedText,
  },
  cardAction: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.radii.pill,
  },
  cardActionCompactTablet: {
    minHeight: 42,
    marginTop: theme.spacing.sm,
  },
  signAction: {
    backgroundColor: "#F8EED4",
  },
  textAction: {
    backgroundColor: theme.colors.primary,
  },
  cardActionText: {
    fontSize: 16,
    fontWeight: "800",
  },
  signActionText: {
    color: theme.colors.primary,
  },
  textActionText: {
    color: "#FFFFFF",
  },
  footer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.sm,
  },
  footerCompactTablet: {
    minHeight: 42,
    paddingTop: 2,
  },
  footerPromise: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  footerMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(91, 42, 134, 0.9)",
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  footerControlPill: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 220, 0.24)",
    backgroundColor: "rgba(55, 22, 84, 0.88)",
    shadowColor: "#1D1325",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  languageButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  footerDivider: {
    width: 1,
    height: 25,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  accessibilityText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  languageText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  footerAccessibility: {
    minWidth: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
});
