import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoute";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (session) {
    return <Redirect href={getHomeRouteByRole(session.role)} />;
  }

  return <Redirect href="/(auth)/login" />;
}
