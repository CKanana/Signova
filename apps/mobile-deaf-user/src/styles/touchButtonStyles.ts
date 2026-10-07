import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const touchButtonStyles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.control,
    flexDirection: "row",
  },
  fullWidth: {
    width: "100%",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconContainer: {
    marginRight: 6,
  },
  // Sizes
  sizeSm: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sizeMd: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sizeLg: {
    minHeight: 50,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  sizeTouch: {
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  sizeTouchLarge: {
    minHeight: 64,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  sizeIcon: {
    width: 48,
    height: 48,
    padding: 0,
    borderRadius: 24,
  },
  // Variants
  variantPrimary: {
    backgroundColor: theme.colors.primary,
    borderWidth: 0,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  variantSecondary: {
    backgroundColor: "#F2EADB",
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  variantAccent: {
    backgroundColor: "#F8EED4",
    borderWidth: 1,
    borderColor: "#E5D9BC",
  },
  variantOutline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  variantGhost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  variantDanger: {
    backgroundColor: theme.colors.danger,
    borderWidth: 0,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  // Typography
  baseText: {
    fontWeight: "700",
    textAlign: "center",
  },
  textSm: {
    fontSize: 14,
  },
  textMd: {
    fontSize: 16,
  },
  textLg: {
    fontSize: 18,
  },
  textTouch: {
    fontSize: 18,
  },
  textTouchLarge: {
    fontSize: 21,
  },
  textIcon: {
    fontSize: 18,
  },
  textWhite: {
    color: "#FFFFFF",
  },
  textPrimaryColor: {
    color: theme.colors.primary,
  },
  textDark: {
    color: theme.colors.text,
  },
});
