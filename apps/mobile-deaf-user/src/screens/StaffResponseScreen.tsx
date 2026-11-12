import React from "react";
import { View, Text, ScrollView, Image, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { staffResponseStyles as styles } from "../styles/staffResponseStyles";

export function StaffResponseScreen() {
  const { messages, staff, goToStep, accessibility, updateAccessibility } = useSession();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeText = accessibility?.largeText ?? false;

  const latestStaffMessage = [...messages].reverse().find((m) => m.sender === "staff");

  const toggleTextSize = () => {
    updateAccessibility({ largeText: !isLargeText });
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        isTablet && { paddingHorizontal: 48, paddingVertical: 48 },
      ]}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.contentWrap, isTablet && { maxWidth: 860 }]}>
        {/* "Staff replied" indicator */}
        <View style={styles.replyPill}>
          <View style={styles.replyPillDot} />
          <Text style={[styles.replyPillText, isTablet && { fontSize: 14 }]}>STAFF REPLIED</Text>
        </View>

        {/* Response card */}
        <View style={[
          styles.responseCard,
          isTablet && { padding: 36, borderRadius: 28, borderLeftWidth: 5 },
        ]}>
          <View style={[styles.staffHeader, isTablet && { marginBottom: 24, paddingBottom: 20 }]}>
            <Image
              source={require("../assets/kenyan-staff-portrait.jpg")}
              style={[styles.staffAvatar, isTablet && { width: 68, height: 68, borderRadius: 34 }]}
              accessibilityLabel="Staff member portrait"
            />
            <View style={styles.staffMeta}>
              <Text style={[styles.eyebrow, isTablet && { fontSize: 12 }]}>Response from staff</Text>
              <Text style={[styles.staffNameTitle, isTablet && { fontSize: 18, marginTop: 3 }]}>
                {staff?.name || "Grace Wanjiku"}
                {staff?.serviceDesk ? `  ·  ${staff.serviceDesk}` : ""}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.responseText,
              isLargeText && styles.responseTextLarge,
              isTablet && { fontSize: 32, lineHeight: 46 },
            ]}
            accessibilityRole="text"
            accessible
          >
            {latestStaffMessage?.text || ""}
          </Text>
        </View>

        {/* Action controls */}
        <View style={[styles.controlsRow, isTablet && { gap: 16, marginTop: 4 }]}>
          <TouchButton
            variant="outline"
            size={isTablet ? "lg" : "md"}
            style={[styles.actionBtn, isTablet && { minHeight: 60 }]}
            onPress={toggleTextSize}
            icon={<Feather name="type" size={isTablet ? 20 : 18} color={isLargeText ? theme.colors.primary : theme.colors.mutedText} />}
            accessibilityLabel={isLargeText ? "Switch to normal text" : "Switch to larger text"}
          >
            {isLargeText ? "Normal text" : "Larger text"}
          </TouchButton>

          <TouchButton
            variant="primary"
            size={isTablet ? "lg" : "md"}
            style={[styles.actionBtn, isTablet && { minHeight: 60 }]}
            onPress={() => goToStep("conversation")}
            icon={<Feather name="message-square" size={isTablet ? 20 : 18} color="#FFFFFF" />}
            accessibilityLabel="Continue conversation"
          >
            Continue
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
