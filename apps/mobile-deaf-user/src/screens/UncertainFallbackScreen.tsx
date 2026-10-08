import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { uncertainFallbackStyles as styles } from "../styles/uncertainFallbackStyles";

export function UncertainFallbackScreen() {
  const { currentDraft, goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const detectedText = currentDraft || "I need...";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <Text style={styles.eyebrow}>WE’RE NOT COMPLETELY SURE ABOUT THIS SIGN</Text>

        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Feather name="alert-triangle" size={22} color="#D97706" />
          <Text style={styles.warningText}>
            Please check the message before sending to staff.
          </Text>
        </View>

        {/* Partial Message Card */}
        <View style={styles.messageCard}>
          <Text style={[styles.messageText, isLargeText && styles.messageTextLarge]}>
            “{detectedText}”
          </Text>
        </View>

        {/* Action Options */}
        <View style={styles.buttonStack}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={() => goToStep("live")}
            icon={<Feather name="rotate-ccw" size={20} color="#FFFFFF" />}
          >
            Try signing again
          </TouchButton>

          <View style={styles.secondaryRow}>
            <TouchButton
              variant="outline"
              size="touch"
              style={styles.halfBtn}
              onPress={() => goToStep("text")}
              icon={
                <MaterialCommunityIcons
                  name="keyboard-outline"
                  size={20}
                  color={theme.colors.text}
                />
              }
            >
              Edit text
            </TouchButton>

            <TouchButton
              variant="ghost"
              size="touch"
              style={styles.halfBtn}
              onPress={() => goToStep("confirm")}
            >
              Continue anyway
            </TouchButton>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
