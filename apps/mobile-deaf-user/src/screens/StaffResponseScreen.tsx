import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { staffResponseStyles as styles } from "../styles/staffResponseStyles";

export function StaffResponseScreen() {
  const { staff, goToStep, accessibility, updateAccessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const toggleTextSize = () => {
    updateAccessibility({ largeText: !isLargeText });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        {/* Large Highlighted Staff Response Card */}
        <View style={styles.responseCard}>
          <View style={styles.staffHeader}>
            <Image
              source={require("../assets/kenyan-staff-portrait.jpg")}
              style={styles.staffAvatar}
              accessibilityLabel="Grace, customer support specialist portrait"
            />
            <View style={styles.staffMeta}>
              <Text style={styles.eyebrow}>STAFF RESPONSE</Text>
              <Text style={styles.staffNameTitle}>
                {staff?.name || "Grace Wanjiku"} · {staff?.serviceDesk || "Customer Support"}
              </Text>
            </View>
          </View>

          <Text style={[styles.responseText, isLargeText && styles.responseTextLarge]}>
            “Please wait while I check your account.”
          </Text>
        </View>

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          <TouchButton
            variant="outline"
            size="lg"
            style={styles.actionBtn}
            icon={<Feather name="volume-2" size={20} color={theme.colors.text} />}
          >
            Replay
          </TouchButton>

          <TouchButton
            variant="outline"
            size="lg"
            style={styles.actionBtn}
            onPress={toggleTextSize}
            icon={<Feather name="type" size={20} color={theme.colors.text} />}
          >
            {isLargeText ? "Normal text" : "Larger text"}
          </TouchButton>

          <TouchButton
            variant="primary"
            size="lg"
            style={styles.actionBtn}
            onPress={() => goToStep("conversation")}
            icon={<Feather name="chevron-right" size={20} color="#FFFFFF" />}
          >
            Continue
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
