import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { textMessageStyles as styles } from "../styles/textMessageStyles";
import { theme } from "../../../../shared/constants/theme";

/**
 * Real-time text chat — tablet-first design.
 * Full-height split view on tablets: thread fills the space, composer pins to bottom.
 */
export function TextMessageScreen() {
  const { sendTextMessage, goBack, messages, staff, accessibility, isTranslating } = useSession();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeText = accessibility?.largeText ?? false;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    setIsSending(true);
    try {
      await sendTextMessage(text);
    } finally {
      setIsSending(false);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const chatMessages = messages;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.chatContainer}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={[styles.chatHeader, isTablet && { paddingHorizontal: 32, minHeight: 76 }]}>
        <TouchableOpacity
          style={styles.chatHeaderBack}
          onPress={goBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={[styles.chatHeaderTitle, isTablet && { fontSize: 19 }]}>
            {staff?.name ?? "Service Counter"}
            {staff?.serviceDesk ? `  ·  ${staff.serviceDesk}` : ""}
          </Text>
          <Text style={styles.chatHeaderSub}>
            {isTranslating ? "Sending…" : "● Live text conversation"}
          </Text>
        </View>
        {isTablet && (
          <View style={{
            paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
            backgroundColor: "rgba(27,117,72,0.10)", borderWidth: 1,
            borderColor: "rgba(27,117,72,0.22)",
          }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.success }}>CONNECTED</Text>
          </View>
        )}
      </View>

      {/* Thread */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatThread}
        contentContainerStyle={[
          styles.chatThreadContent,
          chatMessages.length === 0 && styles.emptyThread,
          isTablet && { paddingHorizontal: 32, paddingVertical: 24 },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {chatMessages.length === 0 ? (
          <>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: "rgba(123,67,188,0.15)", alignItems: "center",
              justifyContent: "center", marginBottom: 16,
            }}>
              <Feather name="message-circle" size={28} color="#CDB8F5" />
            </View>
            <Text style={[styles.emptyTitle, isTablet && { fontSize: 24 }]}>
              Start the conversation
            </Text>
            <Text style={[styles.emptySubtitle, isTablet && { fontSize: 17, maxWidth: 380 }]}>
              Type below. The staff member at the counter will see your message instantly.
            </Text>
          </>
        ) : (
          chatMessages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <View
                key={msg.id}
                style={[
                  styles.bubble,
                  isUser ? styles.bubbleUser : styles.bubbleStaff,
                  isTablet && { maxWidth: "65%", padding: 18, borderRadius: 24 },
                ]}
                accessible
                accessibilityLabel={`${isUser ? "You" : staff?.name ?? "Staff"}: ${msg.text}`}
              >
                <Text style={[
                  styles.bubbleText,
                  !isUser && styles.bubbleTextStaff,
                  isLargeText && styles.bubbleTextLarge,
                  isTablet && { fontSize: 19, lineHeight: 28 },
                ]}>
                  {msg.text}
                </Text>
                <Text style={styles.bubbleTime}>{msg.timestamp}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Composer */}
      <View style={[
        styles.composerBar,
        isTablet && { paddingHorizontal: 32, paddingVertical: 16, gap: 14 },
      ]}>
        <TextInput
          style={[
            styles.composerInput,
            isLargeText && styles.composerInputLarge,
            isTablet && { fontSize: 19, minHeight: 56, borderRadius: 28, paddingHorizontal: 22 },
          ]}
          multiline
          value={draft}
          onChangeText={setDraft}
          placeholder="Type your message here…"
          placeholderTextColor="rgba(184,171,203,0.45)"
          accessible
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={[
            styles.composerSend,
            (!draft.trim() || isSending) && styles.composerSendDisabled,
            isTablet && { width: 56, height: 56, borderRadius: 28 },
          ]}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={isTablet ? 22 : 20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
