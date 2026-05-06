import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { barberDesign } from "@/constants/barber-design";

export default function BarberLayout() {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = barberDesign;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.goldAlt,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: Platform.OS === "web" ? colors.surface : `rgba(2, 8, 23, 0.92)`,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 20,
          ...(Platform.OS !== "web" && { ...shadows.large }),
          height: Platform.OS === "ios" ? 62 + Math.max(insets.bottom, 20) : 66 + Math.max(insets.bottom, 14),
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 20) : Math.max(insets.bottom, 14),
          paddingTop: 8,
        },
        tabBarItemStyle: { paddingVertical: 4, borderRadius: 12, marginHorizontal: 2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 2 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Jadval", tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Xabarlar", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
      {/* Hide old backup files from tab bar */}
      <Tabs.Screen name="dashboard_new" options={{ href: null }} />
      <Tabs.Screen name="profile_old" options={{ href: null }} />
      <Tabs.Screen name="schedule_old" options={{ href: null }} />
      <Tabs.Screen name="notifications_old" options={{ href: null }} />
    </Tabs>
  );
}
