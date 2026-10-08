import React, { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { messageSentStyles as styles } from "../styles/messageSentStyles";

export function MessageSentScreen() {
  const { messages, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const lastUserMessage = [...messages].reverse().find((m) => m.sender === "user");
  const messageText = lastUserMessage?.text ?? "";

  useEffect(() => {
    const timer = setTimeout(() => {
      goToStep("conversation");
    }, 2200);
    return () => clearTimeout(timer);
  }, [goToStep]);

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
          Message sent
        </Text>

        <Text style={[styles.body, isLargeText && styles.bodyLarge]}>
          “{messageText}”
        </Text>

        <View style={styles.buttonContainer}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={() => goToStep("conversation")}
            icon={<Feather name="chevron-right" size={22} color="#FFFFFF" />}
          >
            View conversation
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
