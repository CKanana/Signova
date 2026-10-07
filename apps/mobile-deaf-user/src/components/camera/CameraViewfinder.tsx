import React from "react";
import { View, Text, Image, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cameraViewfinderStyles as styles } from "../../styles/cameraViewfinderStyles";

interface CameraViewfinderProps {
  readyPrompt?: boolean;
  isLive?: boolean;
  handsDetected?: boolean;
  style?: ViewStyle;
}

export function CameraViewfinder({
  readyPrompt = false,
  isLive = false,
  handsDetected = true,
  style,
}: CameraViewfinderProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Background Camera Image / Simulation */}
      <Image
        source={require("../../assets/kenyan-deaf-user-signing.jpg")}
        style={styles.cameraImage}
        resizeMode="cover"
        accessibilityLabel="Camera view showing user positioned for signing"
      />

      {/* Hand Framing Guide Brackets */}
      <View style={styles.guideBox} pointerEvents="none">
        {/* Top-left */}
        <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
        {/* Top-right */}
        <View style={[styles.cornerBracket, styles.bracketTopRight]} />
        {/* Bottom-left */}
        <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
        {/* Bottom-right */}
        <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
      </View>

      {/* Guide Pill at bottom of viewfinder */}
      {readyPrompt && (
        <View style={styles.guidePill}>
          <Text style={styles.guidePillText}>Keep both hands visible</Text>
        </View>
      )}

      {/* Live Status Overlay Badges */}
      {isLive && (
        <View style={styles.liveOverlayBadge}>
          <View style={styles.statusRow}>
            <View style={styles.pulsingGreenDot} />
            <Text style={styles.statusLiveText}>Signova is recognising...</Text>
          </View>
          {handsDetected && (
            <View style={styles.detectedRow}>
              <Feather name="check" size={14} color="#48BB78" />
              <Text style={styles.detectedText}>Hands detected</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
