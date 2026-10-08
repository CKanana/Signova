import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { AccessibleCard } from "../components/ui/AccessibleCard";
import { conversationStyles as styles } from "../styles/conversationStyles";

export function ConversationScreen() {
  const { messages, staff, goToStep, accessibility } = useSession();
  const scrollViewRef = useRef<ScrollView>(null);
  const isLargeText = accessibility?.largeText ?? false;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      {/* Active Service Counter Banner */}
      <View style={styles.staffHeaderBanner}>
        <View style={styles.connectedRow}>
          <View style={styles.greenPulseDot} />
          <Text style={styles.staffNameText}>
            Connected with {staff?.name || "Grace W."}
          </Text>
        </View>
        <Text style={styles.serviceSubText}>
          {staff?.serviceDesk || "Customer Support · Main Reception Desk"}
        </Text>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item) => {
          const isUser = item.sender === "user";
          return (
            <AccessibleCard
              key={item.id}
              borderLeftColor={isUser ? theme.colors.primary : theme.colors.success}
              backgroundColor={isUser ? "#FFFFFF" : "#F8EED4"}
              style={[
                styles.messageCard,
                isUser ? styles.userCard : styles.staffCard,
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text
                  style={[
                    styles.senderBadge,
                    { color: isUser ? theme.colors.primary : theme.colors.success },
                  ]}
                >
                  {isUser ? "YOU" : `STAFF · ${staff?.name?.split(" ")[0] || "GRACE"}`}
                </Text>
                <Text style={styles.timestampText}>{item.timestamp}</Text>
              </View>

              <Text style={[styles.messageBody, isLargeText && styles.messageBodyLarge]}>
                {item.text}
              </Text>
            </AccessibleCard>
          );
        })}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionRow}>
          <TouchButton
            variant="primary"
            size="touch"
            style={styles.signBtn}
            onPress={() => goToStep("live")}
            icon={
              <MaterialCommunityIcons
                name="hand-back-right"
                size={22}
                color="#FFFFFF"
              />
            }
          >
            Sign a response
          </TouchButton>

          <TouchButton
            variant="secondary"
            size="touch"
            style={styles.textBtn}
            onPress={() => goToStep("text")}
            icon={
              <MaterialCommunityIcons
                name="keyboard-outline"
                size={22}
                color={theme.colors.primary}
              />
            }
          >
            Type
          </TouchButton>

          <TouchButton
            variant="outline"
            size="touch"
            style={styles.incomingStaffPreviewBtn}
            onPress={() => goToStep("response")}
            accessibilityLabel="Preview staff response"
            icon={<Feather name="message-square" size={20} color={theme.colors.text} />}
          />
        </View>

        <TouchButton
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => goToStep("complete")}
          textStyle={styles.endBtnText}
        >
          End session
        </TouchButton>
      </View>
    </View>
  );
}
