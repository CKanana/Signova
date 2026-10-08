import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { textMessageStyles as styles } from "../styles/textMessageStyles";

export function TextMessageScreen() {
  const { sendTextMessage, goBack, accessibility } = useSession();
  const [text, setText] = useState("");
  const isLargeText = accessibility?.largeText ?? false;

  const handleSend = () => {
    if (text.trim()) {
      void sendTextMessage(text.trim());
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardAvoid}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <Text style={[styles.title, isLargeText && styles.titleLarge]}>
            Type your message
          </Text>
          <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
            A staff member at the service counter will read your message.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your message</Text>
            <TextInput
              style={[styles.textArea, isLargeText && styles.textAreaLarge]}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
              placeholder="Type your message here..."
              placeholderTextColor="#999"
              accessible={true}
              accessibilityLabel="Message input field"
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchButton
              variant="primary"
              size="touch"
              fullWidth
              onPress={handleSend}
              disabled={!text.trim()}
              icon={<Feather name="send" size={20} color="#FFFFFF" />}
            >
              Send message
            </TouchButton>

            <TouchButton
              variant="ghost"
              size="lg"
              fullWidth
              onPress={goBack}
            >
              Cancel
            </TouchButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
