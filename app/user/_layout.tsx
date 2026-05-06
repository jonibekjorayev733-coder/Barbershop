import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userDesign } from "@/constants/user-design";
import { useAuth } from "@/context/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoute";

export default function UserLayout() {
  const insets = useSafeAreaInsets();
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: userDesign.page }}>
        <ActivityIndicator size="large" color={userDesign.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if ((session.role || "student").toLowerCase() !== "student") {
    return <Redirect href={getHomeRouteByRole(session.role)} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: userDesign.accentStrong,
        tabBarInactiveTintColor: userDesign.textMuted,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.95)",
          borderTopColor: userDesign.line,
          borderTopWidth: 0.5,
          elevation: 6,
          ...(Platform.OS === "web"
            ? { boxShadow: "0px -10px 24px rgba(17, 24, 39, 0.06)" }
            : {
                shadowColor: "#111827",
                shadowOpacity: 0.06,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: -8 },
              }),
          height: Platform.OS === "ios" ? 74 + Math.max(insets.bottom, 18) : 78 + Math.max(insets.bottom, 10),
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 18) : Math.max(insets.bottom, 10),
          paddingTop: 10,
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 4, letterSpacing: -0.1 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Sartaroshlar",
          tabBarIcon: ({ color, size }) => <Ionicons name="cut-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: "Bron",
          href: null,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mybookings"
        options={{
          title: "Bronlarim",
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="personal-info"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="language"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="display-mode"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
