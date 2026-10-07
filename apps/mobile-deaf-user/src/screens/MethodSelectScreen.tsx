import React from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSession } from "../context/SessionContext";
import { methodSelectStyles as styles } from "../styles/methodSelectStyles";

export function MethodSelectScreen() {
  const { setMethod, goToStep, accessibility, organisation } = useSession();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isCompactPhone = width < 430;
  const isSmallPhone = width < 360;
  const isCompactTablet = isTablet && height <= 740;
  const isLargeText = accessibility?.largeText ?? false;

  const handleSelectSign = () => {
    setMethod("sign");
    goToStep("tellers");
  };

  const handleSelectText = () => {
    setMethod("text");
    goToStep("text");
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/kenyan-deaf-user-signing.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessible={false}
      />
      <BlurView
        intensity={isTablet ? 30 : 24}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        pointerEvents="none"
        style={styles.blurLayer}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(36, 20, 51, 0.48)", "rgba(55, 25, 81, 0.74)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.backgroundWash}
      />

      <View
        style={[
          styles.screenContent,
          isTablet && styles.screenContentTablet,
          isCompactTablet && styles.screenContentCompactTablet,
        ]}
      >
        <View
          style={[
            styles.topBar,
            isCompactTablet && styles.topBarCompactTablet,
            isCompactPhone && styles.topBarCompactPhone,
          ]}
        >
          <View
            style={[
              styles.brandAndOrganisation,
              isCompactPhone && styles.brandAndOrganisationCompactPhone,
            ]}
          >
            <Image
              source={require("../assets/signova-brand-assets/logos/signova-logo-horizontal-light.png")}
              resizeMode="contain"
              style={[
                styles.brandLogo,
                !isTablet && styles.brandLogoMobile,
                isCompactPhone && styles.brandLogoCompactPhone,
                isSmallPhone && styles.brandLogoSmallPhone,
              ]}
              accessibilityLabel="Signova"
            />
            <View style={styles.brandDivider} />
            <View
              style={[
                styles.organisationLockup,
                isCompactPhone && styles.organisationLockupCompactPhone,
                isSmallPhone && styles.organisationLockupSmallPhone,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.organisationShortName,
                  isSmallPhone && styles.organisationShortNameSmallPhone,
                ]}
              >
                {organisation?.shortName || "KNH"}
              </Text>
              {!isCompactPhone && (
                <Text numberOfLines={1} style={styles.organisationName}>
                  {organisation?.name || "Kenyatta National Hospital"}
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.headerActions, isCompactPhone && styles.headerActionsCompactPhone]}>
            <Pressable
              onPress={() => goToStep("settings")}
              accessibilityRole="button"
              accessibilityLabel="Accessibility settings"
              style={({ pressed }) => [
                styles.headerButton,
                isCompactPhone && styles.headerButtonCompactPhone,
                isSmallPhone && styles.headerButtonSmallPhone,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name="wheelchair-accessibility" size={24} color="#241F27" />
            </Pressable>
            <Pressable
              onPress={() => goToStep("help")}
              accessibilityRole="button"
              accessibilityLabel="Help and guidance"
              style={({ pressed }) => [
                styles.headerButton,
                isCompactPhone && styles.headerButtonCompactPhone,
                isSmallPhone && styles.headerButtonSmallPhone,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="help-circle" size={23} color="#241F27" />
            </Pressable>
          </View>
        </View>

        <View style={[styles.heading, isCompactTablet && styles.headingCompactTablet]}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowRule} />
            <Text style={styles.eyebrow}>CHOOSE HOW YOU'D LIKE TO</Text>
            <View style={styles.eyebrowRule} />
          </View>
          <Text style={[styles.title, isLargeText && styles.titleLarge, isCompactTablet && styles.titleCompactTablet]}>
            {isTablet ? "How would you like to\ncommunicate?" : "How would you like to communicate?"}
          </Text>
          <Text style={[styles.subtitle, isLargeText && styles.subtitleLarge, isCompactTablet && styles.subtitleCompactTablet]}>
            Pick the option that feels most comfortable for you.
          </Text>
        </View>

        <View
          style={[
            styles.cardsContainer,
            isTablet && styles.cardsContainerTablet,
            isCompactTablet && styles.cardsContainerCompactTablet,
          ]}
        >
          <Pressable
            onPress={handleSelectSign}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Continue with Sign Language using the camera"
            style={({ pressed }) => [
              styles.methodCard,
              styles.signCard,
              isTablet && styles.methodCardTablet,
              isCompactTablet && styles.methodCardCompactTablet,
              pressed && styles.cardPressed,
            ]}
          >
            <Image
              source={require("../assets/kenyan-deaf-user-signing.jpg")}
              style={styles.cardImage}
              resizeMode="cover"
              accessible={false}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(72, 25, 108, 0.95)", "rgba(72, 25, 108, 0.82)", "rgba(72, 25, 108, 0.44)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cardTint}
            />
            <View style={[styles.cardContent, isCompactTablet && styles.cardContentCompactTablet]}>
              <View style={[styles.iconBubble, isCompactTablet && styles.iconBubbleCompactTablet]}>
                <MaterialCommunityIcons name="hand-back-right" size={34} color="#5B2A86" />
              </View>
              <View style={[styles.cardCopy, isCompactTablet && styles.cardCopyCompactTablet]}>
                <Text style={[styles.cardTitle, styles.signTitle, isLargeText && styles.cardTitleLarge]}>
                  Sign language
                </Text>
              </View>
              <View style={[styles.cardAction, styles.signAction, isCompactTablet && styles.cardActionCompactTablet]}>
                <Text style={[styles.cardActionText, styles.signActionText]}>Continue</Text>
                <Feather name="arrow-right" size={20} color="#5B2A86" />
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={handleSelectText}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Continue by typing your message"
            style={({ pressed }) => [
              styles.methodCard,
              styles.textCard,
              isTablet && styles.methodCardTablet,
              isCompactTablet && styles.methodCardCompactTablet,
              pressed && styles.cardPressed,
            ]}
          >
            <Image
              source={require("../assets/text-card-keyboard.png")}
              style={styles.textCardImage}
              resizeMode="cover"
              accessible={false}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["#FFF8DC", "#FFF8DC", "rgba(255, 248, 220, 0.92)", "rgba(255, 248, 220, 0.12)"]}
              locations={[0, 0.4, 0.66, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cardTint}
            />
            <View style={[styles.cardContent, isCompactTablet && styles.cardContentCompactTablet]}>
              <View style={[styles.iconBubble, isCompactTablet && styles.iconBubbleCompactTablet]}>
                <MaterialCommunityIcons name="keyboard-outline" size={32} color="#5B2A86" />
              </View>
              <View
                style={[
                  styles.cardCopy,
                  styles.textCardCopy,
                  isCompactTablet && styles.cardCopyCompactTablet,
                ]}
              >
                <Text style={[styles.cardTitle, styles.textTitle, isLargeText && styles.cardTitleLarge]}>
                  Text
                </Text>
              </View>
              <View style={[styles.cardAction, styles.textAction, isCompactTablet && styles.cardActionCompactTablet]}>
                <Text style={[styles.cardActionText, styles.textActionText]}>Continue</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={[styles.footer, isCompactTablet && styles.footerCompactTablet]}>
          <View style={styles.footerPromise}>
            <View style={styles.footerMark}>
              <MaterialCommunityIcons name="heart-pulse" size={19} color="#FFFFFF" />
            </View>
            <Text style={styles.footerText}>Better communication.{"\n"}Better care.</Text>
          </View>
          <View style={styles.footerControlPill}>
            <Pressable
              onPress={() => goToStep("settings")}
              accessibilityRole="button"
              accessibilityLabel={`Language settings, current language ${accessibility?.language || "English"}`}
              style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}
            >
              <Feather name="globe" size={18} color="#FFFFFF" />
              <Text style={styles.languageText}>EN</Text>
              <Feather name="chevron-down" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
