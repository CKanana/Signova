import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../../../shared/constants/theme";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { conversationStyles as styles } from "../styles/conversationStyles";

export function ConversationScreen() {
  const { messages, staff, goToStep, endSession, accessibility } = useSession();
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeText = accessibility?.largeText ?? false;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      {/* Connected Banner */}
      <View style={[
        styles.staffHeaderBanner,
        isTablet && { paddingHorizontal: 32, paddingVertical: 18, minHeight: 76 },
      ]}>
        <View style={styles.connectedRow}>
          <View style={styles.greenPulseDot} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.staffNameText, isTablet && { fontSize: 18 }]}>
              {staff?.name ? `Connected · ${staff.name}` : "Connected to counter"}
            </Text>
            <Text style={[styles.serviceSubText, isTablet && { fontSize: 14, marginTop: 3 }]}>
              {staff?.serviceDesk || "Service counter"}
              {staff?.counterNumber ? `  ·  Counter ${staff.counterNumber}` : ""}
            </Text>
          </View>
          <View style={styles.liveChip}>
            <Text style={styles.liveChipText}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* Message Thread */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={[
          styles.messagesContainer,
          isTablet && { paddingHorizontal: 32, paddingVertical: 24, gap: 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: "rgba(91,42,134,0.08)", alignItems: "center",
              justifyContent: "center", marginBottom: 8,
            }}>
              <MaterialCommunityIcons name="hand-back-right" size={28} color={theme.colors.primary} />
            </View>
            <Text style={{
              fontSize: isTablet ? 20 : 16, fontWeight: "700",
              color: theme.colors.mutedText, textAlign: "center",
            }}>
              No messages yet
            </Text>
            <Text style={{
              fontSize: isTablet ? 16 : 14, color: theme.colors.mutedText,
              textAlign: "center", maxWidth: 320, lineHeight: 22, opacity: 0.7,
            }}>
              Use the buttons below to sign or type your message.
            </Text>
          </View>
        )}
        {messages.map((item) => {
          const isUser = item.sender === "user";
          return (
            <View
              key={item.id}
              style={[
                styles.messageCard,
                isUser ? styles.userCard : styles.staffCard,
                isTablet && {
                  maxWidth: "60%",
                  padding: 18,
                  borderRadius: 24,
                },
              ]}
              accessible
              accessibilityLabel={`${isUser ? "You" : staff?.name ?? "Staff"}: ${item.text}`}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[
                  styles.senderBadge,
                  { color: isUser ? "rgba(255,255,255,0.65)" : theme.colors.mutedText },
                ]}>
                  {isUser ? "YOU" : (staff?.name?.split(" ")[0]?.toUpperCase() ?? "STAFF")}
                </Text>
                <Text style={[
                  styles.timestampText,
                  { color: isUser ? "rgba(255,255,255,0.5)" : theme.colors.mutedText },
                ]}>
                  {item.timestamp}
                </Text>
              </View>
              <Text style={[
                styles.messageBody,
                !isUser && styles.messageBodyStaff,
                isLargeText && styles.messageBodyLarge,
                isTablet && { fontSize: 19, lineHeight: 28 },
              ]}>
                {item.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Action Bar */}
      <View style={[
        styles.actionBar,
        isTablet && { paddingHorizontal: 32, paddingVertical: 20, gap: 14 },
      ]}>
        <View style={[styles.actionRow, isTablet && { gap: 14 }]}>
          <TouchButton
            variant="primary"
            size={isTablet ? "lg" : "touch"}
            style={[styles.signBtn, isTablet && { minHeight: 60 }]}
            onPress={() => goToStep("live")}
            icon={<MaterialCommunityIcons name="hand-back-right" size={isTablet ? 24 : 20} color="#FFFFFF" />}
          >
            {isTablet ? "Sign language" : "Sign"}
          </TouchButton>

          <TouchButton
            variant="secondary"
            size={isTablet ? "lg" : "touch"}
            style={[styles.textBtn, isTablet && { minHeight: 60 }]}
            onPress={() => goToStep("text")}
            icon={<MaterialCommunityIcons name="keyboard-outline" size={isTablet ? 24 : 20} color={theme.colors.primary} />}
          >
            {isTablet ? "Type message" : "Type"}
          </TouchButton>

          <TouchButton
            variant="outline"
            size={isTablet ? "lg" : "touch"}
            style={[styles.incomingStaffPreviewBtn, isTablet && { minWidth: 60, minHeight: 60 }]}
            onPress={() => goToStep("response")}
            accessibilityLabel="View latest staff reply"
            icon={<Feather name="message-square" size={isTablet ? 22 : 18} color={theme.colors.mutedText} />}
          />
        </View>

        <TouchButton
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => void endSession()}
          textStyle={[styles.endBtnText, isTablet && { fontSize: 16 }]}
        >
          End session
        </TouchButton>
      </View>
    </View>
  );
}
