import React from "react";
import {
  Pressable,
  View,
  ViewStyle,
  StyleProp,
  AccessibilityRole,
} from "react-native";
import { useSession } from "../../context/SessionContext";
import { accessibleCardStyles as styles } from "../../styles/accessibleCardStyles";

interface AccessibleCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  borderLeftColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export function AccessibleCard({
  children,
  onPress,
  selected = false,
  borderLeftColor,
  backgroundColor,
  style,
  accessibilityLabel,
  accessibilityRole = onPress ? "button" : "none",
}: AccessibleCardProps) {
  const { accessibility } = useSession();
  const isHighContrast = accessibility?.highContrast ?? false;

  const cardStyle: ViewStyle[] = [
    styles.card,
    selected && styles.cardSelected,
    isHighContrast && styles.highContrast,
    borderLeftColor ? { borderLeftWidth: 6, borderLeftColor } : undefined,
    backgroundColor ? { backgroundColor } : undefined,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible={true}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      accessible={true}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={cardStyle}
    >
      {children}
    </View>
  );
}
