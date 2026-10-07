import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Text, View } from "react-native";
import { useSession } from "../context/SessionContext";
import { splashStyles as styles } from "../styles/splashStyles";

export function SplashScreen() {
  const { goToStep } = useSession();
  const bounce = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -12,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 550,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ]),
    );
    const waveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: -1,
          duration: 360,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(450),
      ]),
    );

    bounceAnimation.start();
    waveAnimation.start();
    const timer = setTimeout(() => {
      goToStep("welcome");
    }, 10000);

    return () => {
      clearTimeout(timer);
      bounceAnimation.stop();
      waveAnimation.stop();
    };
  }, [bounce, goToStep, wave]);

  const waveRotation = wave.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.brandIconBox, { transform: [{ translateY: bounce }] }]}
      >
        <Animated.Image
          source={require("../assets/signova-brand-assets/app-icon/signova-app-icon-hands-s.png")}
          resizeMode="contain"
          style={[styles.brandLogo, { transform: [{ rotate: waveRotation }] }]}
        />
      </Animated.View>
      <Text style={styles.brandTitle}>Signova</Text>
      <Text style={styles.tagline}>Communication without barriers.</Text>

      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
    </View>
  );
}
