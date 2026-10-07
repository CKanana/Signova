import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const helpStyles = StyleSheet.create({
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
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  titleLarge: {
    fontSize: 38,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.mutedText,
    textAlign: "center",
    marginBottom: 28,
  },
  subtitleLarge: {
    fontSize: 21,
  },
  cardsGrid: {
    gap: 12,
    marginBottom: 28,
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#F8EED4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  cardTitleLarge: {
    fontSize: 21,
  },
  chevron: {
    marginLeft: 8,
  },
  backBtn: {
    marginTop: 8,
  },
});
