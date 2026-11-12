import { StyleSheet } from "react-native";
import { theme } from "../../../../shared/constants/theme";

export const textMessageStyles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Full chat layout: header + thread + composer
  chatContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chatHeader: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatHeaderBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(91,42,134,0.08)",
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  chatHeaderSub: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: "600",
    marginTop: 1,
  },
  chatThread: {
    flex: 1,
    padding: 16,
    paddingBottom: 8,
  },
  chatThreadContent: {
    gap: 10,
    paddingBottom: 8,
  },
  // Bubbles
  bubble: {
    maxWidth: "80%",
    padding: 14,
    borderRadius: 20,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 5,
  },
  bubbleStaff: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bubbleText: {
    fontSize: 17,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 24,
  },
  bubbleTextStaff: {
    color: theme.colors.text,
  },
  bubbleTextLarge: {
    fontSize: 21,
    lineHeight: 30,
  },
  bubbleTime: {
    fontSize: 11,
    color: "rgba(0,0,0,0.35)",
    marginTop: 4,
    textAlign: "right",
  },
  // Composer bar
  composerBar: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 17,
    color: theme.colors.text,
    lineHeight: 24,
  },
  composerInputLarge: {
    fontSize: 20,
  },
  composerSend: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  composerSendDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
  },
  // Empty state
  emptyThread: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.colors.mutedText,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 22,
  },
  // Legacy fallback
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: theme.colors.background,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 680,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  titleLarge: {
    fontSize: 36,
  },
  subtitle: {
    fontSize: 17,
    color: theme.colors.mutedText,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  subtitleLarge: {
    fontSize: 20,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.mutedText,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  textArea: {
    width: "100%",
    minHeight: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 20,
    fontSize: 20,
    color: theme.colors.text,
    lineHeight: 28,
  },
  textAreaLarge: {
    fontSize: 24,
    lineHeight: 34,
    minHeight: 200,
  },
  buttonRow: {
    width: "100%",
    gap: 12,
  },
});
