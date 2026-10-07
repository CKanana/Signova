import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { CameraViewfinder } from "../components/camera/CameraViewfinder";
import { liveSigningStyles as styles } from "../styles/liveSigningStyles";

export function LiveSigningScreen() {
  const { goToStep, detectedGloss, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        {/* Live Camera Viewfinder with recognition badges */}
        <CameraViewfinder isLive={true} handsDetected={true} style={styles.viewfinder} />

        {/* Live Detected Gloss Translation Banner */}
        <View style={styles.translationBanner}>
          <Text style={styles.bannerEyebrow}>TRANSLATED MESSAGE</Text>
          <Text style={[styles.glossText, isLargeText && styles.glossTextLarge]}>
            “{detectedGloss || "Hello, I need help with my account."}”
          </Text>
        </View>

        {/* Live Control Buttons */}
        <View style={styles.controlsRow}>
          <TouchButton
            variant="primary"
            size="lg"
            style={styles.controlBtn}
            onPress={() => goToStep("translating")}
            icon={<Feather name="pause" size={20} color="#FFFFFF" />}
          >
            Pause
          </TouchButton>

          <TouchButton
            variant="outline"
            size="lg"
            style={styles.controlBtn}
            onPress={() => goToStep("uncertain")}
            icon={<Feather name="rotate-ccw" size={20} color={theme.colors.text} />}
          >
            Retry
          </TouchButton>

          <TouchButton
            variant="ghost"
            size="lg"
            style={styles.controlBtn}
            onPress={() => goToStep("complete")}
            icon={<Feather name="x" size={20} color={theme.colors.text} />}
          >
            End
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
