import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, ActivityIndicator } from "react-native";
import type { StaffInfo } from "../../../../shared/types/session";
import { useSession } from "../context/SessionContext";
import { TouchButton } from "../components/ui/TouchButton";
import { tellerSelectionStyles as styles } from "../styles/tellerSelectionStyles";

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("");
}

/** Map a backend Teller to the StaffInfo shape this screen's UI expects. */
function toStaffInfo(teller: {
	_id: string;
	name: string;
	serviceLabel: string;
	serviceDesk: string;
	counterNumber: string;
	status: string;
}): StaffInfo {
	return {
		name: teller.name,
		role: teller.serviceLabel,
		serviceDesk: teller.serviceDesk,
		counterNumber: teller.counterNumber,
		isAvailable: teller.status === "FREE",
	};
}

export function TellerSelectionScreen() {
	const { tellers, selectTeller, loadTellers, isLoadingTellers, isCreatingSession, error, accessibility } = useSession();
	const { width } = useWindowDimensions();
	const isTablet = width >= 768;
	const [selectedTeller, setSelectedTeller] = useState<StaffInfo | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const isLargeText = accessibility?.largeText ?? false;

	// The backend is the source of truth for availability. Only FREE tellers
	// are selectable; the list already reflects live status.
	const availableTellers = tellers.filter((t) => t.status === "FREE");

	const handleSelect = (teller: (typeof tellers)[number]) => {
		setSelectedTeller(toStaffInfo(teller));
		setSelectedId(teller._id);
	};

	const handleContinue = async () => {
		if (!selectedId) return;
		const teller = tellers.find((t) => t._id === selectedId);
		if (!teller) return;
		const ok = await selectTeller(teller);
		// On success the context advances to "connecting". On failure (e.g. the
		// teller became BUSY and the backend returned 409) an error is shown and
		// we stay here so the user can pick another teller.
		if (!ok) {
			// Refresh the list so the just-taken teller shows as unavailable.
			await loadTellers();
			setSelectedTeller(null);
			setSelectedId(null);
		}
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
							<Text style={styles.availabilityText}>
								{isLoadingTellers ? "LOADING TELLERS…" : `${availableTellers.length} TELLERS AVAILABLE`}
							</Text>
						</View>
						<Text style={[styles.title, isLargeText && styles.titleLarge]}>
							Choose a teller
						</Text>
						<Text style={[styles.subtitle, isLargeText && styles.subtitleLarge]}>
							Select who you would like to help with your conversation.
						</Text>
					</View>

					{isLoadingTellers && (
						<View style={styles.statusBlock}>
							<ActivityIndicator color="#5B2A86" />
							<Text style={styles.statusText}>Loading available tellers…</Text>
						</View>
					)}

					{!isLoadingTellers && availableTellers.length === 0 && !error && (
						<View style={styles.statusBlock}>
							<Text style={styles.statusTitle}>No tellers available</Text>
							<Text style={styles.statusText}>
								All counters are busy right now. Please try again in a moment.
							</Text>
							<TouchButton variant="outline" size="md" onPress={() => void loadTellers()}>
								Refresh
							</TouchButton>
						</View>
					)}

					{error && (
						<View style={styles.statusBlock}>
							<Text style={styles.statusTitle}>Something went wrong</Text>
							<Text style={styles.statusText}>{error}</Text>
							<TouchButton variant="outline" size="md" onPress={() => void loadTellers()}>
								Try again
							</TouchButton>
						</View>
					)}

					<View style={styles.tellerList}>
						{availableTellers.map((teller) => {
							const isSelected = selectedId === teller._id;
							return (
								<Pressable
									key={teller._id}
									onPress={() => handleSelect(teller)}
									accessible
									accessibilityRole="radio"
									accessibilityLabel={`${teller.name}, ${teller.serviceLabel}, ${teller.serviceDesk}, available`}
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
											{teller.serviceLabel}
										</Text>
										<View style={styles.serviceDeskRow}>
											<Feather name="map-pin" size={13} color="#77717C" />
											<Text style={styles.serviceDesk}>{teller.serviceDesk}</Text>
										</View>
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

			<View style={[styles.footer, isTablet && styles.footerTablet]}>
				<View style={styles.footerSelection}>
					<View style={[styles.footerSelectionMark, selectedTeller && styles.footerSelectionMarkActive]}>
						<Feather
							name={selectedTeller ? "check" : "users"}
							size={19}
							color={selectedTeller ? "#FFFFFF" : "#5B2A86"}
						/>
					</View>
					<View style={styles.footerSelectionCopy}>
						<Text style={styles.footerSelectionTitle}>
							{selectedTeller?.name || "Choose a teller"}
						</Text>
						<Text style={styles.footerNote}>
							{selectedTeller
								? `${selectedTeller.serviceDesk} · Counter ${selectedTeller.counterNumber}`
								: "Select someone to continue"}
						</Text>
					</View>
				</View>
				<View style={[styles.connectButtonWrap, isTablet && styles.connectButtonWrapTablet]}>
					<TouchButton
						variant="primary"
						size="touch"
						fullWidth
						disabled={!selectedId || isCreatingSession}
						loading={isCreatingSession}
						onPress={handleContinue}
						accessibilityLabel={
							selectedTeller ? `Connect with ${selectedTeller.name}` : "Choose a teller to continue"
						}
						icon={<Feather name="arrow-right" size={22} color="#FFFFFF" />}
					>
						{isCreatingSession
							? "Connecting…"
							: selectedTeller
								? `Connect with ${selectedTeller.name.split(" ")[0]}`
								: "Choose a teller"}
					</TouchButton>
				</View>
			</View>
		</View>
	);
}
