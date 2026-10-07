import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const conversationStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F2E7",
  },
  staffHeaderBanner: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  greenPulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
  },
  staffNameText: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  serviceSubText: {
    fontSize: 13,
    color: theme.colors.mutedText,
    marginTop: 2,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    gap: 16,
  },
  messageCard: {
    width: "100%",
    maxWidth: 640,
    borderRadius: 18,
    padding: 20,
  },
  userCard: {
    alignSelf: "flex-end",
  },
  staffCard: {
    alignSelf: "flex-start",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  senderBadge: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  timestampText: {
    fontSize: 13,
    color: theme.colors.mutedText,
    fontWeight: "600",
  },
  messageBody: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    lineHeight: 28,
  },
  messageBodyLarge: {
    fontSize: 24,
    lineHeight: 34,
  },
  actionBar: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1.5,
    borderTopColor: theme.colors.border,
    padding: 16,
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
    width: 56,
  },
  endBtnText: {
    color: theme.colors.mutedText,
    fontWeight: "700",
  },
});
