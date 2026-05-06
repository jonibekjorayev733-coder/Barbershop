import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { panelTheme } from "@/constants/panel-theme";

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f1f5f9",
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
      <Tabs.Screen name="bookings" options={{ title: "Bronlar", tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="barbers" options={{ title: "Barberlar", tabBarIcon: ({ color, size }) => <Ionicons name="cut-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
