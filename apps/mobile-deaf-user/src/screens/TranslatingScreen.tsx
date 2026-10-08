import React, { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { translatingStyles as styles } from "../styles/translatingStyles";

export function TranslatingScreen() {
  const { goToStep, requestTranslation, isTranslating, error, accessibility } = useSession();
  const isLargeText = accessibility?.largeText ?? false;

  // Request a real translation through the model-agnostic seam when this screen
  // mounts. The context advances to "confirm" (high confidence) or "uncertain"
  // (low confidence) based on the server's response. No fake timers.
  useEffect(() => {
    void requestTranslation();
  }, [requestTranslation]);

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
          {isTranslating && <ActivityIndicator color="#5B2A86" />}
        </View>

        {error && !isTranslating && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchButton variant="outline" size="md" onPress={() => void requestTranslation()}>
              Try again
            </TouchButton>
          </View>
        )}

        {!isTranslating && !error && (
          <TouchButton
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => goToStep("confirm")}
            icon={<Feather name="check" size={20} color="#FFFFFF" />}
          >
            Translation complete
          </TouchButton>
        )}
      </View>
    </ScrollView>
  );
}
