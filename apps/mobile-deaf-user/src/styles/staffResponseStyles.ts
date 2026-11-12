import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

const SUCCESS = "#1B7548";
const SUCCESS_BG = "rgba(27,117,72,0.10)";

export const staffResponseStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: theme.colors.background,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 780,
    gap: 24,
  },
  replyPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SUCCESS_BG,
    borderWidth: 1,
    borderColor: "rgba(27,117,72,0.22)",
  },
  replyPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS,
  },
  replyPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: SUCCESS,
    letterSpacing: 0.6,
  },
  responseCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: SUCCESS,
    padding: 28,
    shadowColor: "#241F27",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  staffHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  staffAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EDE3F5",
  },
  staffMeta: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: SUCCESS,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  staffNameTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 2,
  },
  responseText: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text,
    lineHeight: 40,
  },
  responseTextLarge: {
    fontSize: 34,
    lineHeight: 48,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
});
