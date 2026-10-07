import React from "react";
import { BlurView } from "expo-blur";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { welcomeStyles as styles } from "../styles/welcomeStyles";

export function WelcomeScreen() {
  const { organisation, goToStep, accessibility } = useSession();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeText = accessibility?.largeText ?? false;

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/kenyan-deaf-user-signing.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessible={false}
      />
      <BlurView
        intensity={isTablet ? 28 : 22}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        pointerEvents="none"
        style={styles.blurLayer}
      />
      <View pointerEvents="none" style={styles.imageScrim} />

      <View style={[styles.screenContent, isTablet && styles.screenContentTablet]}>
        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <Image
              source={require("../assets/signova-brand-assets/app-icon/signova-app-icon-hands-s.png")}
              resizeMode="contain"
              style={styles.brandLogo}
              accessibilityLabel="Signova logo"
            />
            <Text style={styles.brandName}>Signova</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => goToStep("settings")}
              accessibilityRole="button"
              accessibilityLabel="Accessibility settings"
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            >
              <MaterialCommunityIcons name="wheelchair-accessibility" size={25} color="#241F27" />
            </Pressable>
            <Pressable
              onPress={() => goToStep("help")}
              accessibilityRole="button"
              accessibilityLabel="Help and guidance"
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            >
              <Feather name="help-circle" size={24} color="#241F27" />
            </Pressable>
          </View>
        </View>

        <View style={[styles.welcomeCopy, isTablet && styles.welcomeCopyTablet]}>
          <Text style={styles.eyebrow}>
            {organisation?.shortName || "KNH"} · SIGN LANGUAGE AND TEXT SUPPORT
          </Text>
          <Text
            style={[
              styles.title,
              isTablet && styles.titleTablet,
              isLargeText && styles.titleLarge,
            ]}
          >
            Welcome to {organisation?.name || "Kenyatta National Hospital"}
          </Text>
          <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
            {organisation?.welcomeMessage ||
              "Communication support is available in sign language or text."}
          </Text>
        </View>

        <View style={[styles.buttonStack, isTablet && styles.buttonStackTablet]}>
          <TouchButton
            variant="accent"
            size="touch"
            fullWidth
            onPress={() => goToStep("method")}
            icon={<Feather name="arrow-right" size={23} color="#5B2A86" />}
          >
            Start communication
          </TouchButton>

          <TouchButton
            variant="outline"
            size="lg"
            fullWidth
            onPress={() => goToStep("help")}
            icon={
              <MaterialCommunityIcons
                name="wheelchair-accessibility"
                size={22}
                color="#241F27"
              />
            }
          >
            Accessibility help
          </TouchButton>
        </View>
      </View>
    </View>
  );
}
