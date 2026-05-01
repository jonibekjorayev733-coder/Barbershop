import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { panelTheme } from "@/constants/panel-theme";

export default function BarberLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: panelTheme.teal,
        tabBarInactiveTintColor: panelTheme.muted,
        tabBarStyle: {
          backgroundColor: panelTheme.surface,
          borderTopColor: panelTheme.border,
          elevation: 10,
          height: Platform.OS === "ios" ? 62 + Math.max(insets.bottom, 20) : 66 + Math.max(insets.bottom, 14),
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 20) : Math.max(insets.bottom, 14),
          paddingTop: 8,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Jadval", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Xabarlar", tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
