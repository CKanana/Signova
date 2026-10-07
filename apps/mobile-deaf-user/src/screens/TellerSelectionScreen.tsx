import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { StaffInfo } from "../../../../shared/types/session";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { tellerSelectionStyles as styles } from "../styles/tellerSelectionStyles";

const AVAILABLE_TELLERS: StaffInfo[] = [
	{
		name: "Grace Wanjiku",
		role: "Kenyan Sign Language · English",
		serviceDesk: "Customer Support · Main Reception",
		counterNumber: "04",
		isAvailable: true,
	},
	{
		name: "Brian Otieno",
		role: "Kenyan Sign Language · English",
		serviceDesk: "Patient Services · West Wing",
		counterNumber: "02",
		isAvailable: true,
	},
	{
		name: "Njeri Kamau",
		role: "Kenyan Sign Language · English",
		serviceDesk: "Outpatient Services · Ground Floor",
		counterNumber: "07",
		isAvailable: true,
	},
];

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("");
}

export function TellerSelectionScreen() {
	const { goToStep, setStaff, accessibility } = useSession();
	const [selectedTeller, setSelectedTeller] = useState<StaffInfo | null>(null);
	const isLargeText = accessibility?.largeText ?? false;

	const handleContinue = () => {
		if (!selectedTeller) return;
		setStaff(selectedTeller);
		goToStep("connecting");
	};

	return (
		<View style={styles.screen}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				bounces={false}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.content}>
					<View style={styles.intro}>
						<View style={styles.availabilityLabel}>
							<View style={styles.availabilityDot} />
							  <Text style={styles.availabilityText}>{AVAILABLE_TELLERS.length} TELLERS AVAILABLE</Text>
						</View>
						<Text style={[styles.title, isLargeText && styles.titleLarge]}>
							Choose a teller
						</Text>
						<Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
							Select who you would like to help with your conversation.
						</Text>
					</View>

					<View style={styles.tellerList}>
						{AVAILABLE_TELLERS.map((teller) => {
							const isSelected = selectedTeller?.name === teller.name;
							return (
								<Pressable
									key={teller.name}
									onPress={() => setSelectedTeller(teller)}
									accessible
									accessibilityRole="radio"
									accessibilityLabel={`${teller.name}, ${teller.role}, ${teller.serviceDesk}, available`}
									accessibilityState={{ selected: isSelected }}
									style={({ pressed }) => [
										styles.tellerOption,
										isSelected && styles.tellerOptionSelected,
										pressed && styles.tellerOptionPressed,
									]}
								>
									<View
										style={[
											styles.avatar,
											isSelected && styles.avatarSelected,
											teller.name === "Grace Wanjiku" && styles.avatarWithPhoto,
											isSelected && teller.name === "Grace Wanjiku" && styles.avatarPhotoSelected,
										]}
									>
										{teller.name === "Grace Wanjiku" ? (
											<Image
												source={require("../assets/kenyan-staff-portrait.jpg")}
												style={styles.avatarImage}
												resizeMode="cover"
												accessible={false}
											/>
										) : (
											<Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
												{getInitials(teller.name)}
											</Text>
										)}
									</View>

									<View style={styles.tellerDetails}>
										<View style={styles.nameAndStatus}>
											<Text style={[styles.tellerName, isLargeText && styles.tellerNameLarge]}>
												{teller.name}
											</Text>
											<View style={styles.inlineAvailability}>
												<View style={styles.availabilityDot} />
												<Text style={styles.inlineAvailabilityText}>Available</Text>
											</View>
										</View>
										<Text style={[styles.tellerRole, isLargeText && styles.tellerRoleLarge]}>
											{teller.role}
										</Text>
										<Text style={styles.serviceDesk}>{teller.serviceDesk}</Text>
									</View>

									<View style={[styles.radio, isSelected && styles.radioSelected]}>
										{isSelected && <View style={styles.radioInner} />}
									</View>
								</Pressable>
							);
						})}
					</View>
				</View>
			</ScrollView>

			<View style={styles.footer}>
				<Text style={styles.footerNote}>You can ask for another teller at any time.</Text>
				<TouchButton
					variant="primary"
					size="touch"
					fullWidth
					disabled={!selectedTeller}
					onPress={handleContinue}
					accessibilityLabel={
						selectedTeller ? `Connect with ${selectedTeller.name}` : "Choose a teller to continue"
					}
					icon={<Feather name="arrow-right" size={22} color="#FFFFFF" />}
				>
					{selectedTeller ? `Connect with ${selectedTeller.name.split(" ")[0]}` : "Choose a teller"}
				</TouchButton>
			</View>
		</View>
	);
}
