import React from "react";
import { View, Text, ScrollView, Switch, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { accessibilitySettingsStyles as styles } from "../styles/accessibilitySettingsStyles";

export function AccessibilitySettingsScreen() {
  const { accessibility, updateAccessibility, goBack } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const items = [
    {
      key: "largeText" as const,
      label: "Large text",
      desc: "Make words larger across all screens",
      value: accessibility.largeText,
    },
    {
      key: "highContrast" as const,
      label: "High contrast",
      desc: "Increase the visual difference between elements",
      value: accessibility.highContrast,
    },
    {
      key: "captions" as const,
      label: "Captions",
      desc: "Show text for every spoken staff response",
      value: accessibility.captions,
    },
    {
      key: "visualAlerts" as const,
      label: "Visual notifications",
      desc: "Use clear on-screen badges instead of sound",
      value: accessibility.visualAlerts,
    },
    {
      key: "reduceMotion" as const,
      label: "Reduce motion",
      desc: "Limit pulsing animations and transitions",
      value: accessibility.reduceMotion,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Accessibility settings
        </Text>
        <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
          Choose how Signova works best for you.
        </Text>

        {/* Setting Toggles List */}
        <View style={styles.settingsGroup}>
          {items.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.settingRow,
                index < items.length - 1 && styles.borderBottom,
              ]}
            >
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, isLargeText && styles.settingLabelLarge]}>
                  {item.label}
                </Text>
                <Text style={styles.settingDesc}>{item.desc}</Text>
              </View>

              <Switch
                value={item.value}
                onValueChange={(val) => updateAccessibility({ [item.key]: val })}
                trackColor={{ false: "#D1D5DB", true: theme.colors.primary }}
                thumbColor="#FFFFFF"
                accessible={true}
                accessibilityLabel={`${item.label} toggle`}
              />
            </View>
          ))}
        </View>

        {/* Language Selector */}
        <Pressable
          style={styles.languageRow}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Selected language: English and Kenyan Sign Language"
        >
          <View>
            <Text style={styles.settingLabel}>Language</Text>
            <Text style={styles.settingDesc}>English · Kenyan Sign Language (KSL)</Text>
          </View>
          <Feather name="chevron-right" size={22} color={theme.colors.mutedText} />
        </Pressable>

        <TouchButton
          variant="primary"
          size="touch"
          fullWidth
          onPress={goBack}
          style={styles.saveBtn}
        >
          Back to conversation
        </TouchButton>
      </View>
    </ScrollView>
  );
}
