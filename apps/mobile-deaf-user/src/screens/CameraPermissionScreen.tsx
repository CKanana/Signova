import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { cameraPermissionStyles as styles } from "../styles/cameraPermissionStyles";

export function CameraPermissionScreen() {
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
          <Feather name="camera" size={44} color={theme.colors.primary} />
        </View>

        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Signova needs camera access
        </Text>

        <Text style={[styles.body, isLargeText && styles.bodyLarge]}>
          We use your camera only to recognise sign language during your communication session.
        </Text>

        <View style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={() => goToStep("ready")}
            icon={<Feather name="camera" size={22} color="#FFFFFF" />}
          >
            Allow camera
          </TouchButton>

          <TouchButton
            variant="ghost"
            size="lg"
            fullWidth
            onPress={() => goToStep("method")}
          >
            Not now
          </TouchButton>
        </View>

        <View style={styles.privacyGuarantee}>
          <Feather name="shield" size={20} color={theme.colors.primary} />
          <Text style={styles.privacyText}>
            Your video is private, local, and session-only.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
