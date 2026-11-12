import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

const SUCCESS = "#1B7548";

export const conversationStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  staffHeaderBanner: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  greenPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SUCCESS,
  },
  staffNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  serviceSubText: {
    fontSize: 12,
    color: theme.colors.mutedText,
    marginTop: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  messageCard: {
    maxWidth: "82%",
    borderRadius: 20,
    padding: 14,
  },
  userCard: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  staffCard: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  senderBadge: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  timestampText: {
    fontSize: 11,
    color: theme.colors.mutedText,
    fontWeight: "600",
  },
  messageBody: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 25,
    color: "#FFFFFF",
  },
  messageBodyStaff: {
    color: theme.colors.text,
  },
  messageBodyLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  actionBar: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  signBtn: {
    flex: 2,
  },
  textBtn: {
    flex: 1.2,
  },
  incomingStaffPreviewBtn: {
    width: 52,
  },
  endBtnText: {
    color: theme.colors.mutedText,
    fontWeight: "700",
  },
  liveChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(27,117,72,0.10)",
    borderWidth: 1,
    borderColor: "rgba(27,117,72,0.22)",
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: SUCCESS,
  },
});
