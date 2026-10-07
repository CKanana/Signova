import React from "react";
import { useSession } from "../context/SessionContext";
import { TabletShell } from "../components/layout/TabletShell";

import { SplashScreen } from "../screens/SplashScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { MethodSelectScreen } from "../screens/MethodSelectScreen";
import { TellerSelectionScreen } from "../screens/TellerSelectionScreen";
import { TextMessageScreen } from "../screens/TextMessageScreen";
import { ConnectingScreen } from "../screens/ConnectingScreen";
import { CameraPermissionScreen } from "../screens/CameraPermissionScreen";
import { ReadyToSignScreen } from "../screens/ReadyToSignScreen";
import { LiveSigningScreen } from "../screens/LiveSigningScreen";
import { TranslatingScreen } from "../screens/TranslatingScreen";
import { ConfirmSignScreen } from "../screens/ConfirmSignScreen";
import { UncertainFallbackScreen } from "../screens/UncertainFallbackScreen";
import { MessageSentScreen } from "../screens/MessageSentScreen";
import { ConversationScreen } from "../screens/ConversationScreen";
import { StaffResponseScreen } from "../screens/StaffResponseScreen";
import { SessionCompleteScreen } from "../screens/SessionCompleteScreen";
import { AccessibilitySettingsScreen } from "../screens/AccessibilitySettingsScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { OfflineScreen } from "../screens/OfflineScreen";

export function RootNavigator() {
  const { step } = useSession();

  const renderScreen = () => {
    switch (step) {
      case "splash":
        return <SplashScreen />;
      case "welcome":
        return <WelcomeScreen />;
      case "method":
        return <MethodSelectScreen />;
      case "tellers":
        return <TellerSelectionScreen />;
      case "text":
        return <TextMessageScreen />;
      case "connecting":
        return <ConnectingScreen />;
      case "permission":
        return <CameraPermissionScreen />;
      case "ready":
        return <ReadyToSignScreen />;
      case "live":
        return <LiveSigningScreen />;
      case "translating":
        return <TranslatingScreen />;
      case "confirm":
        return <ConfirmSignScreen />;
      case "uncertain":
        return <UncertainFallbackScreen />;
      case "sent":
        return <MessageSentScreen />;
      case "conversation":
        return <ConversationScreen />;
      case "response":
        return <StaffResponseScreen />;
      case "complete":
        return <SessionCompleteScreen />;
      case "settings":
        return <AccessibilitySettingsScreen />;
      case "help":
        return <HelpScreen />;
      case "offline":
        return <OfflineScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return <TabletShell>{renderScreen()}</TabletShell>;
}
