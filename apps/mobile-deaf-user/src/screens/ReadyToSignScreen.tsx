import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { CameraViewfinder } from "../components/camera/CameraViewfinder";
import { readyToSignStyles as styles } from "../styles/readyToSignStyles";

export function ReadyToSignScreen() {
  const { goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          You’re ready to communicate
        </Text>
        <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
          Position your hands inside the camera frame.
        </Text>

        {/* Viewfinder with Framing Guide & Hint */}
        <CameraViewfinder readyPrompt={true} style={styles.viewfinder} />

        <View style={styles.buttonRow}>
          <TouchButton
            variant="primary"
            size="touch"
            style={styles.primaryBtn}
            onPress={() => goToStep("live")}
            icon={<Feather name="play" size={22} color="#FFFFFF" />}
          >
            Start signing
          </TouchButton>

          <TouchButton
            variant="outline"
            size="touch"
            style={styles.cancelBtn}
            onPress={() => goToStep("method")}
            icon={<Feather name="x" size={22} color={theme.colors.text} />}
          >
            Cancel
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
