import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const accessibleCardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.panel,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 3,
    backgroundColor: "#F8F3FC",
  },
  highContrast: {
    borderColor: "#000000",
    borderWidth: 2.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
