import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../../shared/constants/theme";
import { useSession } from "../../context/SessionContext";
import { tabletHeaderStyles as styles } from "../../styles/tabletHeaderStyles";

interface TabletHeaderProps {
  onBack?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
}

export function TabletHeader({ onBack, onSettings, onHelp }: TabletHeaderProps) {
  const { step, goBack, goToStep, organisation, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const showBackButton = step !== "splash" && step !== "welcome";

  const handleBack = onBack || goBack;
  const handleSettings = onSettings || (() => goToStep("settings"));
  const handleHelp = onHelp || (() => goToStep("help"));

  return (
    <View style={styles.header}>
      {/* Left Back Button or Placeholder */}
      <View style={styles.navSlot}>
        {showBackButton ? (
          <Pressable
            onPress={handleBack}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back to previous screen"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Feather name="arrow-left" size={24} color={theme.colors.text} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      {/* Center White-label Branding Lockup */}
      <View style={styles.centerLockup}>
        <Text
          numberOfLines={1}
          style={[styles.orgTitle, isLargeText && styles.orgTitleLarge]}
        >
          {organisation?.name || "Kenyatta National Hospital"}
        </Text>
        <Text style={styles.poweredBy}>
          Powered by <Text style={styles.signovaBrand}>Signova</Text> · Counter 04
        </Text>
      </View>

      {/* Right Accessibility & Help Action Buttons */}
      <View style={styles.actionsSlot}>
        <Pressable
          onPress={handleSettings}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Accessibility Settings"
          style={({ pressed }) => [
            styles.iconBtn,
            step === "settings" && styles.iconBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="wheelchair-accessibility"
            size={24}
            color={step === "settings" ? theme.colors.primary : theme.colors.text}
          />
        </Pressable>

        <Pressable
          onPress={handleHelp}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Help and guidance"
          style={({ pressed }) => [
            styles.iconBtn,
            step === "help" && styles.iconBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Feather
            name="help-circle"
            size={23}
            color={step === "help" ? theme.colors.primary : theme.colors.text}
          />
        </Pressable>
      </View>
    </View>
  );
}
