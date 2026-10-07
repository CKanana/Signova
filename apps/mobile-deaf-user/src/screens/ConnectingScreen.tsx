import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { connectingStyles as styles } from "../styles/connectingStyles";

export function ConnectingScreen() {
  const { goToStep, staff, accessibility } = useSession();
  const [progress] = useState(new Animated.Value(0.15));
  const [connected, setConnected] = useState(false);
  const isLargeText = accessibility?.largeText ?? false;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.85,
      duration: 1600,
      useNativeDriver: false,
    }).start(() => {
      setConnected(true);
    });
  }, [progress]);

  const handleContinue = () => {
    goToStep("permission");
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        {/* Animated User Avatar with Radar Rings */}
        <View style={styles.radarWrapper}>
          <View style={styles.outerPulseRing} />
          <View style={styles.innerAvatarCircle}>
            <Feather name="user" size={48} color="#FFFFFF" />
          </View>
        </View>

        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Connecting you to a staff member
        </Text>

        <Text style={[styles.serviceTag, isLargeText && styles.serviceTagLarge]}>
          <Text style={styles.serviceLabel}>Service: </Text>
          <Text style={styles.serviceVal}>{staff.serviceDesk}</Text>
        </Text>

        {/* Status Card with Progress Bar */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Feather name="clock" size={22} color={theme.colors.primary} />
            <Text style={styles.statusTitle}>
              {connected
                ? `Connected with ${staff?.name || "Grace W."}`
                : `Connecting to ${staff.name}...`}
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchButton
            variant="primary"
            size="touch"
            fullWidth
            onPress={handleContinue}
            icon={<Feather name="chevron-right" size={22} color="#FFFFFF" />}
          >
            {connected ? "Staff found · Connect now" : "Connecting..."}
          </TouchButton>
        </View>
      </View>
    </ScrollView>
  );
}
