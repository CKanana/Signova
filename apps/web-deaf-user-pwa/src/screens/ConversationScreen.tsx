import React from "react";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { mergeStyles } from "../styles/mergeStyles";
import { MessageSquare, User, Send, ChevronRight } from "lucide-react";

export function ConversationScreen() {
  const { messages, currentDraft, sendMessage, goToStep, staff, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;
  const [input, setInput] = React.useState(currentDraft);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={styles.backLabelWrap}>
          <TouchButton variant="ghost" size="md" onPress={() => goToStep("complete")} style={styles.backBtn} icon={<ChevronRight size={16} color="var(--signova-text)" />} />
        </div>
        <div style={mergeStyles(styles.header, isLargeText && styles.headerLargeText)}>
          <div style={mergeStyles(styles.staffBadge, isLargeText && styles.staffBadgeLargeText)}>
            <User size={20} color="var(--signova-primary)" />
          </div>
          <div style={mergeStyles(styles.staffInfo, isLargeText && styles.staffInfoLargeText)}>
            <span style={mergeStyles(styles.staffName, isLargeText && styles.staffNameLarge)}>{staff.name || "Staff member"}</span>
            <span style={mergeStyles(styles.statusChip, staff.isAvailable && styles.statusChipOnline)}>Available</span>
          </div>
        </div>
      </div>
      <div style={styles.messagesWrap}>
        <div style={styles.messages}>
          {messages.length === 0 && (
            <div style={styles.empty}>
              <MessageSquare size={32} color="var(--signova-muted-text)" />
              <p style={styles.emptyText}>No messages yet. Start a conversation below.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={mergeStyles(styles.bubble, m.sender === "user" && styles.bubbleUser, m.sender === "staff" && styles.bubbleStaff)}>
              <span style={mergeStyles(styles.bubbleText, m.sender === "staff" && styles.bubbleStaffText)}>{m.text}</span>
              <span style={mergeStyles(styles.meta, m.sender === "user" && styles.metaUser, m.sender === "staff" && styles.metaStaff)}>{m.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={mergeStyles(styles.inputBar, isLargeText && styles.inputBarLargeText)}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a reply…"
          style={mergeStyles(styles.input, isLargeText && styles.inputLargeText)}
        />
        <TouchButton variant="primary" size="md" disabled={!input.trim()} onPress={() => { void sendMessage(input, "text"); setInput(""); }} icon={<Send size={18} color="#FFFFFF" />}>
          Send
        </TouchButton>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", width: "100%", background: "var(--signova-background)", fontFamily: "var(--signova-font-family)", color: "var(--signova-text)", display: "flex", flexDirection: "column" } as React.CSSProperties,
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottom: "1px solid var(--signova-border)" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  headerLargeText: { gap: 12 } as React.CSSProperties,
  staffBadge: { width: 36, height: 36, borderRadius: "50%", background: "rgba(91,42,134,0.15)", display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
  staffBadgeLargeText: { width: 44, height: 44 } as React.CSSProperties,
  staffInfo: { display: "flex", flexDirection: "column" } as React.CSSProperties,
  staffInfoLargeText: { gap: 4 } as React.CSSProperties,
  staffName: { fontWeight: 700, color: "var(--signova-text)", margin: 0 } as React.CSSProperties,
  staffNameLarge: { fontSize: 16 } as React.CSSProperties,
  statusChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--signova-success)" } as React.CSSProperties,
  statusChipOnline: { color: "var(--signova-success)" } as React.CSSProperties,
  backLabelWrap: { display: "flex", alignItems: "center" } as React.CSSProperties,
  backBtn: { minWidth: 0, padding: 6 } as React.CSSProperties,
  messagesWrap: { flex: 1, overflowY: "auto", padding: 14 } as React.CSSProperties,
  messages: { display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties,
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 40, color: "var(--signova-muted-text)" } as React.CSSProperties,
  emptyText: { fontSize: 15, margin: 0 } as React.CSSProperties,
  bubble: { display: "flex", flexDirection: "column", gap: 4, maxWidth: "80%" } as React.CSSProperties,
  bubbleUser: { alignSelf: "flex-end" } as React.CSSProperties,
  bubbleStaff: { alignSelf: "flex-start" } as React.CSSProperties,
  bubbleText: { padding: "10px 14px", borderRadius: 14, fontSize: 15, lineHeight: 1.5 } as React.CSSProperties,
  bubbleUserText: { background: "var(--signova-primary)", color: "#FFFFFF", marginLeft: "auto" } as React.CSSProperties,
  bubbleStaffText: { background: "var(--signova-surface)", color: "var(--signova-text)", border: "1px solid var(--signova-border)", marginRight: "auto" } as React.CSSProperties,
  meta: { fontSize: 11, color: "var(--signova-muted-text)", alignSelf: "flex-end" } as React.CSSProperties,
  metaUser: { alignSelf: "flex-end" } as React.CSSProperties,
  metaStaff: { alignSelf: "flex-start" } as React.CSSProperties,
  inputBar: { padding: 12, borderTop: "1px solid var(--signova-border)", background: "var(--signova-background)", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  inputBarLargeText: { gap: 10 } as React.CSSProperties,
  input: { flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--signova-border)", background: "var(--signova-surface)", color: "var(--signova-text)", fontSize: 15, fontFamily: "inherit" } as React.CSSProperties,
  inputLargeText: { fontSize: 17 } as React.CSSProperties,
};
