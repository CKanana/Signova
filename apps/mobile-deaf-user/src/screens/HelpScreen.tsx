import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { helpStyles as styles } from "../styles/helpStyles";

export function HelpScreen() {
  const { goBack, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const cards = [
    {
      title: "How Signova works",
      icon: (
        <MaterialCommunityIcons
          name="hand-back-right"
          size={28}
          color={theme.colors.primary}
        />
      ),
    },
    {
      title: "How to sign",
      icon: <Feather name="play" size={26} color={theme.colors.primary} />,
    },
    {
      title: "Camera help",
      icon: <Feather name="camera" size={26} color={theme.colors.primary} />,
    },
    {
      title: "Communication help",
      icon: <Feather name="message-square" size={26} color={theme.colors.primary} />,
    },
    {
      title: "Accessibility features",
      icon: (
        <MaterialCommunityIcons
          name="wheelchair-accessibility"
          size={28}
          color={theme.colors.primary}
        />
      ),
    },
    {
      title: "Call front desk staff",
      icon: <Feather name="bell" size={26} color={theme.colors.primary} />,
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
          How can we help?
        </Text>
        <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
          Choose a topic for simple visual guidance.
        </Text>

        <View style={styles.cardsGrid}>
          {cards.map((card) => (
            <Pressable
              key={card.title}
              style={({ pressed }) => [styles.helpCard, pressed && styles.cardPressed]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={card.title}
            >
              <View style={styles.iconBox}>{card.icon}</View>
              <Text style={[styles.cardTitle, isLargeText && styles.cardTitleLarge]}>
                {card.title}
              </Text>
              <Feather
                name="chevron-right"
                size={22}
                color={theme.colors.mutedText}
                style={styles.chevron}
              />
            </Pressable>
          ))}
        </View>

        <TouchButton
          variant="primary"
          size="touch"
          fullWidth
          onPress={goBack}
          style={styles.backBtn}
        >
          Return to communication
        </TouchButton>
      </View>
    </ScrollView>
  );
}
