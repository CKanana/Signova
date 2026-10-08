import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { confirmSignStyles as styles } from "../styles/confirmSignStyles";

export function ConfirmSignScreen() {
  const { currentDraft, confirmAndSend, goToStep, accessibility, confidence } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const messageText = currentDraft;

  const handleSend = () => {
    void confirmAndSend(messageText);
  };

  const handleRetry = () => {
    goToStep("live");
  };

  const handleEdit = () => {
    goToStep("text");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>WE UNDERSTOOD:</Text>

        <View style={styles.messageCard}>
          <Text style={[styles.messageText, isLargeText && styles.messageTextLarge]}>
            “{messageText}”
          </Text>
        </View>

        <View style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={handleSend}
            icon={<Feather name="send" size={22} color="#FFFFFF" />}
          >
            Send message
          </TouchButton>

          <View style={styles.secondaryRow}>
            <TouchButton
              variant="outline"
              size="touch"
              style={styles.halfBtn}
              onPress={handleRetry}
              icon={<Feather name="rotate-ccw" size={20} color={theme.colors.text} />}
            >
              Try again
            </TouchButton>

            <TouchButton
              variant="ghost"
              size="touch"
              style={styles.halfBtn}
              onPress={handleEdit}
              icon={
                <MaterialCommunityIcons
                  name="keyboard-outline"
                  size={22}
                  color={theme.colors.text}
                />
              }
            >
              Edit text
            </TouchButton>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
