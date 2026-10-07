import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { sessionCompleteStyles as styles } from "../styles/sessionCompleteStyles";

export function SessionCompleteScreen() {
  const { organisation, resetSession, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const handleNewConversation = () => {
    resetSession();
    goToStep("method");
  };

  const handleReturnHome = () => {
    resetSession();
    goToStep("welcome");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <View style={styles.iconCircle}>
          <Feather name="check" size={48} color={theme.colors.success} />
        </View>

        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Communication complete
        </Text>

        <Text style={[styles.body, isLargeText && styles.bodyLarge]}>
          Thank you for using {organisation?.name || "Kenyatta National Hospital"}’s
          communication service.
        </Text>

        <View style={styles.privacyPill}>
          <Feather name="shield" size={18} color={theme.colors.primary} />
          <Text style={styles.privacyPillText}>
            Session data and camera memory have been wiped securely.
          </Text>
        </View>

        <View style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={handleNewConversation}
          >
            Start new conversation
          </TouchButton>

          <TouchButton
            variant="outline"
            size="lg"
            fullWidth
            onPress={handleReturnHome}
          >
            Return home
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
