import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { offlineStyles as styles } from "../styles/offlineStyles";

export function OfflineScreen() {
  const { goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <View style={styles.iconCircle}>
          <Feather name="wifi-off" size={44} color="#D97706" />
        </View>

        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Connection interrupted
        </Text>

        <Text style={[styles.body, isLargeText && styles.bodyLarge]}>
          We’re having trouble connecting to the service. Your message is safe on this tablet.
        </Text>
        

        <View style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={() => goToStep("connecting")}
            icon={<Feather name="refresh-cw" size={20} color="#FFFFFF" />}
          >
            Try reconnecting
          </TouchButton>

          <TouchButton
            variant="ghost"
            size="lg"
            fullWidth
            onPress={() => goToStep("complete")}
          >
            End session
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
