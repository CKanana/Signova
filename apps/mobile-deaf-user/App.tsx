import { SafeAreaView, StatusBar, Text, View } from "react-native";
import { theme } from "../../shared/constants/theme";
import { appStyles } from "./src/styles/appStyles";

export default function App() {
  return (
    <SafeAreaView style={appStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <View style={appStyles.content}>
        <View style={appStyles.brandMark}>
          <Text style={appStyles.brandMarkText}>S</Text>
        </View>
        <Text style={appStyles.brandName}>Signova</Text>
        <Text style={appStyles.eyebrow}>COMMUNICATION SUPPORT</Text>
        <Text style={appStyles.title}>Welcome</Text>
        <Text style={appStyles.body}>
          Sign language and text communication, designed around you.
        </Text>
        <View style={appStyles.status}>
          <View style={appStyles.statusDot} />
          <Text style={appStyles.statusText}>Mobile theme is ready</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}