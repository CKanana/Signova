import React, { useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { liveSigningStyles as styles } from "../styles/liveSigningStyles";

export function LiveSigningScreen() {
  const { goToStep, requestTranslation, isTranslating, endSession, messages, staff, accessibility } =
    useSession();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isCompactTablet = isTablet && height <= 740;
  const isLargeText = accessibility?.largeText ?? false;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [facing, setFacing] = useState<CameraType>("front");
  const hasRequestedPermission = useRef(false);

  useEffect(() => {
    if (!cameraPermission || cameraPermission.granted || hasRequestedPermission.current) return;

    hasRequestedPermission.current = true;
    if (!cameraPermission.canAskAgain) {
      setCameraError("Camera access is off. Enable it in device settings to continue signing.");
      return;
    }

    void requestCameraPermission()
      .then((permission) => {
        if (!permission.granted) {
          setCameraError("Camera access was not granted. Enable it to continue signing.");
        }
      })
      .catch(() => setCameraError("The camera could not start. Check your device permissions."));
  }, [cameraPermission, requestCameraPermission]);

  const retryCamera = () => {
    setCameraReady(false);
    setCameraPaused(false);
    setCameraError(null);

    if (cameraPermission?.granted) return;
    if (cameraPermission?.canAskAgain) {
      hasRequestedPermission.current = true;
      void requestCameraPermission()
        .then((permission) => {
          if (!permission.granted) {
            setCameraError("Camera access was not granted. Enable it to continue signing.");
          }
        })
        .catch(() => setCameraError("The camera could not start. Check your device permissions."));
    } else {
      void Linking.openSettings();
    }
  };

  const latestStaffMessage = [...messages].reverse().find((message) => message.sender === "staff");
  const hasCameraPermission = cameraPermission?.granted === true;

  // "Review and send" triggers a real translation through the model-agnostic
  // seam. The context routes to "confirm" (high confidence) or "uncertain"
  // (low confidence) based on the server's response — there is no fabricated
  // confidence anywhere in the UI.
  const handleReviewAndSend = () => {
    goToStep("translating");
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        isTablet && styles.containerTablet,
        isCompactTablet && styles.containerCompactTablet,
      ]}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.contentWrap, isTablet && styles.contentWrapTablet]}>
        <View style={styles.pageHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.headingEyebrow}>{staff.serviceDesk}</Text>
            <Text style={[styles.pageTitle, isLargeText && styles.pageTitleLarge]}>
              Live conversation
            </Text>
          </View>
          <View style={styles.privateBadge}>
            <Feather name="shield" size={16} color={theme.colors.success} />
            <Text style={styles.privateText}>Private session</Text>
          </View>
        </View>

        <View style={[styles.workspace, isTablet && styles.workspaceTablet]}>
          <View style={[styles.cameraPanel, isTablet && styles.cameraPanelTablet]}>
            <View style={styles.cameraPanelHeader}>
              <View style={styles.cameraReadyLabel}>
                <View style={[styles.cameraStatusDot, cameraReady && styles.cameraStatusLive]} />
                <Text style={styles.cameraReadyText}>
                  {cameraError ? "Camera unavailable" : cameraReady ? "Camera is ready" : "Starting camera"}
                </Text>
              </View>
              <Pressable
                onPress={() => setFacing((current) => current === "front" ? "back" : "front")}
                accessibilityRole="button"
                accessibilityLabel="Switch camera"
                style={({ pressed }) => [styles.cameraSettingsButton, pressed && styles.pressed]}
              >
                <Feather name="refresh-cw" size={17} color="#F8EED4" />
                <Text style={styles.cameraSettingsText}>Switch camera</Text>
              </Pressable>
            </View>

            <View style={[styles.cameraViewport, isTablet && styles.cameraViewportTablet]}>
              {hasCameraPermission && !cameraError ? (
                <CameraView
                  style={styles.cameraFeed}
                  facing={facing}
                  mirror={facing === "front"}
                  active={!cameraPaused}
                  onCameraReady={() => setCameraReady(true)}
                  onMountError={({ message }) => {
                    setCameraError(message);
                    setCameraReady(false);
                  }}
                />
              ) : cameraError ? (
                <View style={styles.permissionFallback}>
                  <View style={styles.permissionIcon}>
                    <Feather name="camera-off" size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.permissionTitle}>Camera access needed</Text>
                  <Text style={styles.permissionBody}>{cameraError}</Text>
                  <TouchButton variant="accent" size="md" onPress={retryCamera}>
                    Enable camera
                  </TouchButton>
                </View>
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <ActivityIndicator color="#F8EED4" />
                  <Text style={styles.cameraPlaceholderText}>Preparing your private camera…</Text>
                </View>
              )}

              {hasCameraPermission && !cameraError && (
                <View pointerEvents="none" style={styles.cameraOverlay}>
                  <View style={styles.guideFrame} />
                  <View style={styles.recognitionBadge}>
                    <View style={[styles.cameraStatusDot, styles.cameraStatusLive]} />
                    <Text style={styles.recognitionText}>Sign naturally — keep hands in frame</Text>
                  </View>
                  <View style={styles.cameraPrivacyBadge}>
                    <Feather name="lock" size={13} color="#FFFFFF" />
                    <Text style={styles.cameraPrivacyText}>Live sign-language camera</Text>
                  </View>
                  {cameraPaused && (
                    <View style={styles.pausedOverlay}>
                      <Text style={styles.pausedText}>Camera paused</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.controlsRow}>
              <TouchButton
                variant="outline"
                size="md"
                style={styles.controlBtn}
                onPress={() => setCameraPaused((paused) => !paused)}
                disabled={!hasCameraPermission || Boolean(cameraError)}
                icon={
                  <Feather
                    name={cameraPaused ? "play" : "pause"}
                    size={18}
                    color={theme.colors.text}
                  />
                }
              >
                {cameraPaused ? "Resume" : "Pause"}
              </TouchButton>
              <TouchButton
                variant="outline"
                size="md"
                style={styles.controlBtn}
                onPress={retryCamera}
                icon={<Feather name="rotate-ccw" size={18} color={theme.colors.text} />}
              >
                Retry
              </TouchButton>
              <TouchButton
                variant="ghost"
                size="md"
                style={styles.controlBtn}
                onPress={() => void endSession()}
                icon={<Feather name="x" size={18} color={theme.colors.text} />}
              >
                End
              </TouchButton>
            </View>
          </View>

          <View style={[styles.conversationColumn, isTablet && styles.conversationColumnTablet]}>
            <View style={[styles.messagePanel, styles.translationPanel]}>
              <View style={styles.panelLabelRow}>
                <Text style={styles.panelEyebrow}>YOUR MESSAGE</Text>
                <View style={styles.reviewStatus}>
                  <Feather name="check" size={14} color={theme.colors.success} />
                  <Text style={styles.reviewStatusText}>Review before sending</Text>
                </View>
              </View>
              <Text style={styles.panelTitle}>Translation check</Text>
              <Text style={[styles.glossText, isLargeText && styles.glossTextLarge]}>
                {isTranslating ? "Translating your sign…" : "Your translation will appear here after you sign."}
              </Text>
              <View style={styles.sendRow}>
                <TouchButton
                  variant="primary"
                  size="md"
                  style={styles.sendButton}
                  disabled={isTranslating}
                  loading={isTranslating}
                  onPress={handleReviewAndSend}
                  icon={<Feather name="check" size={18} color="#FFFFFF" />}
                >
                  Review and send
                </TouchButton>
                <Pressable
                  onPress={() => goToStep("text")}
                  accessibilityRole="button"
                  accessibilityLabel="Edit translated message"
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Feather name="edit-2" size={19} color={theme.colors.primary} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.messagePanel, styles.staffPanel]}>
              <View style={styles.panelLabelRow}>
                <View style={styles.staffHeading}>
                  <Text style={styles.panelEyebrow}>STAFF RESPONSE</Text>
                  <Text style={styles.panelTitle}>{staff.name} · Service desk</Text>
                </View>
                <View style={styles.audioButton}>
                  <Feather name="volume-2" size={18} color={theme.colors.primary} />
                </View>
              </View>
              <Text style={styles.staffMessage}>
                {latestStaffMessage?.text || "Your teller is ready to respond."}
              </Text>
              <Text style={styles.responseHint}>Text is the main response. Audio is optional.</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}