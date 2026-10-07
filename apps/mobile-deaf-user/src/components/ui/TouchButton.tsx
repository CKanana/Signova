import React from "react";
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  View,
  ActivityIndicator,
} from "react-native";
import { theme } from "../../../../../shared/constants/theme";
import { useSession } from "../../context/SessionContext";
import { touchButtonStyles as styles } from "../../styles/touchButtonStyles";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "touch" | "icon";

interface TouchButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

export function TouchButton({
  children,
  onPress,
  variant = "primary",
  size = "touch",
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  fullWidth = false,
}: TouchButtonProps) {
  const { accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  const getContainerStyle = (pressed: boolean): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    if (fullWidth) list.push(styles.fullWidth);

    switch (size) {
      case "sm":
        list.push(styles.sizeSm);
        break;
      case "md":
        list.push(styles.sizeMd);
        break;
      case "lg":
        list.push(styles.sizeLg);
        break;
      case "icon":
        list.push(styles.sizeIcon);
        break;
      case "touch":
      default:
        list.push(isLargeText ? styles.sizeTouchLarge : styles.sizeTouch);
        break;
    }

    switch (variant) {
      case "secondary":
        list.push(styles.variantSecondary);
        break;
      case "outline":
        list.push(styles.variantOutline);
        break;
      case "ghost":
        list.push(styles.variantGhost);
        break;
      case "accent":
        list.push(styles.variantAccent);
        break;
      case "danger":
        list.push(styles.variantDanger);
        break;
      case "primary":
      default:
        list.push(styles.variantPrimary);
        break;
    }

    if (pressed) {
      list.push(styles.pressed);
    }

    if (disabled || loading) {
      list.push(styles.disabled);
    }

    if (style) {
      list.push(style);
    }

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.baseText];

    switch (size) {
      case "sm":
        list.push(styles.textSm);
        break;
      case "md":
        list.push(styles.textMd);
        break;
      case "lg":
        list.push(styles.textLg);
        break;
      case "icon":
        list.push(styles.textIcon);
        break;
      case "touch":
      default:
        list.push(isLargeText ? styles.textTouchLarge : styles.textTouch);
        break;
    }

    switch (variant) {
      case "secondary":
      case "accent":
        list.push(styles.textPrimaryColor);
        break;
      case "outline":
      case "ghost":
        list.push(styles.textDark);
        break;
      case "danger":
        list.push(styles.textWhite);
        break;
      case "primary":
      default:
        list.push(styles.textWhite);
        break;
    }

    if (textStyle) {
      list.push(textStyle);
    }

    return list;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => getContainerStyle(pressed)}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : theme.colors.primary}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={children ? styles.iconContainer : undefined}>{icon}</View>}
          {typeof children === "string" ? (
            <Text style={getTextStyle()}>{children}</Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  );
}
