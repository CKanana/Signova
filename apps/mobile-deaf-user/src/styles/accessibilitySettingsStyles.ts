import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const accessibilitySettingsStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 720,
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
  settingsGroup: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  settingLabelLarge: {
    fontSize: 21,
  },
  settingDesc: {
    fontSize: 14,
    color: theme.colors.mutedText,
    marginTop: 4,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 18,
    marginBottom: 28,
  },
  saveBtn: {
    marginTop: 8,
  },
});
