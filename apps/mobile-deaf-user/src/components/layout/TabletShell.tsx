import React from "react";
import {
  StatusBar,
  View,
  Text,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../../../../shared/constants/theme";
import { useSession } from "../../context/SessionContext";
import { TabletHeader } from "./TabletHeader";
import { tabletShellStyles as styles } from "../../styles/tabletShellStyles";

interface TabletShellProps {
  children: React.ReactNode;
}

export function TabletShell({ children }: TabletShellProps) {
  const { step, goToStep, accessibility } = useSession();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeText = accessibility?.largeText ?? false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={step === "welcome" || step === "method" ? "light-content" : "dark-content"}
        backgroundColor={step === "splash" ? theme.colors.primary : "#241F27"}
      />

      <View style={[styles.outerContainer, isTablet && styles.outerContainerTablet]}>
        <View style={[styles.tabletDeviceFrame, isTablet && styles.tabletFrameBorder]}>
          {/* Top Institutional Tablet Hardware Status Bar */}
          {step !== "splash" && step !== "welcome" && (
            <View style={styles.statusBarHardware}>
              <Text style={styles.statusBarTime}>9:41 AM</Text>
              <View style={styles.sessionStatusBadge}>
                <View style={styles.greenStatusDot} />
                <Text style={styles.sessionStatusText}>Secure session</Text>
              </View>
            </View>
          )}

          {/* Navigation / Brand Header */}
          {step !== "splash" && step !== "welcome" && step !== "method" && <TabletHeader />}

          {/* Main Dynamic Step Viewport */}
          <View style={[styles.contentViewport, isLargeText && styles.largeTextViewport]}>
            {children}
          </View>

          {/* Quick-test helper bar for easy development verification */}
          {__DEV__ && step !== "splash" && step !== "welcome" && step !== "method" && step !== "tellers" && (
            <View style={styles.devBar}>
              <Pressable
                onPress={() => goToStep(step === "offline" ? "welcome" : "offline")}
                style={styles.devLink}
              >
                <Text style={styles.devLinkText}>
                  {step === "offline" ? "Exit offline preview" : "Preview offline state"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
