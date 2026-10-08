import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { connectingStyles as styles } from "../styles/connectingStyles";

export function ConnectingScreen() {
  const { goToStep, staff, accessibility, connectToSession, isConnected, error } = useSession();
  const [progress] = useState(new Animated.Value(0.15));
  const [connected, setConnected] = useState(false);
  const isLargeText = accessibility?.largeText ?? false;

  // Establish the real Socket.IO connection when this screen mounts. The
  // context advances to "live" on the server's session:connected event, or to
  // "offline" if the socket can't connect in time. No fake timers.
  useEffect(() => {
    connectToSession();
  }, [connectToSession]);

  // Reflect the real connection state.
  useEffect(() => {
    if (isConnected) {
      setConnected(true);
    }
  }, [isConnected]);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 0.85,
      duration: 1600,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [progress]);

  const retryConnection = () => {
    connectToSession();
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
            <Feather name={connected ? "check-circle" : "clock"} size={22} color={theme.colors.primary} />
            <Text style={styles.statusTitle}>
              {connected
                ? `Connected with ${staff.name}. Opening your signing space...`
                : `Connecting to ${staff.name}...`}
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
        </View>

        <Text style={styles.waitHint}>
          {connected ? "Starting live communication" : "Please wait while we connect you."}
        </Text>

        {error && !connected && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchButton variant="outline" size="md" onPress={retryConnection}>
              Retry connection
            </TouchButton>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
