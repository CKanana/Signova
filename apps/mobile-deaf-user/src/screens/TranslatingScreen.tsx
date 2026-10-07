import React, { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { translatingStyles as styles } from "../styles/translatingStyles";

export function TranslatingScreen() {
  const { goToStep, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  useEffect(() => {
    const timer = setTimeout(() => {
      goToStep("confirm");
    }, 1200);
    return () => clearTimeout(timer);
  }, [goToStep]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        <View style={styles.iconCircle}>
          <Feather name="loader" size={44} color="#5B2A86" />
        </View>

        <Text style={[styles.title, isLargeText && styles.titleLarge]}>
          Translating your sign...
        </Text>

        <Text style={[styles.body, isLargeText && styles.bodyLarge]}>
          Keep your hands still for a moment.
        </Text>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TouchButton
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => goToStep("confirm")}
          icon={<Feather name="check" size={20} color="#FFFFFF" />}
        >
          Translation complete
        </TouchButton>
      </View>
    </ScrollView>
  );
}
