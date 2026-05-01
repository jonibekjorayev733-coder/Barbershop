import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { getBarberDashboard, getBarberNotifications, type BarberDashboardApi, type BarberNotificationApi } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";

export default function BarberDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [dashboard, setDashboard] = useState<BarberDashboardApi | null>(null);
  const [notifications, setNotifications] = useState<BarberNotificationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!barberId) return;
    const [dashboardData, notificationRows] = await Promise.all([
      getBarberDashboard(barberId),
      getBarberNotifications(barberId),
    ]);
    setDashboard(dashboardData);
    setNotifications(notificationRows);
    setLoading(false);
    setRefreshing(false);
  }, [barberId]);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0f766e" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.eyebrow}>BARBER PANEL</Text>
        <Text style={styles.title}>Salom, {session?.name}</Text>
        <Text style={styles.subtitle}>Bugungi jadval va samaradorlik holati</Text>

        <View style={styles.quickRow}>
          <QuickCard label="Jadval" hint="Bugungi qabul" onPress={() => router.push("/barber/schedule")} />
          <QuickCard label="Xabarlar" hint={`${notifications.filter((item) => !item.read).length} ta unread`} onPress={() => router.push("/barber/notifications")} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Bugungi holat</Text>
          <Text style={styles.heroValue}>{dashboard?.today_done ?? 0}/{dashboard?.today_total ?? 0}</Text>
          <Text style={styles.heroSub}>Yakunlangan / jami bronlar</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((dashboard?.progress_ratio ?? 0) * 100)}%` }]} /></View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Pending" value={String(dashboard?.today_pending ?? 0)} />
          <Stat label="Notifications" value={String(notifications.filter((n) => !n.read).length)} />
        </View>

        <Text style={styles.sectionTitle}>Keyingi mijoz</Text>
        {dashboard?.next_appointment ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{dashboard.next_appointment.client_name}</Text>
            <Text style={styles.cardSub}>{dashboard.next_appointment.service_name || dashboard.barber_name}</Text>
            <Text style={styles.cardMeta}>{dashboard.next_appointment.appointment_date} {dashboard.next_appointment.appointment_time}</Text>
            <Text style={styles.cardMeta}>📞 {dashboard.next_appointment.client_phone}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>Bugun keyingi mijoz yo‘q</Text>
        )}

        <Text style={styles.sectionTitle}>Oxirgi bildirishnomalar</Text>
        {notifications.slice(0, 5).map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.message}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Bugungi ro‘yxat</Text>
        {dashboard?.today_appointments?.slice(0, 4).map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.client_name}</Text>
              <Text style={styles.badge}>{item.status}</Text>
            </View>
            <Text style={styles.cardSub}>{item.service_name || "Xizmat"}</Text>
            <Text style={styles.cardMeta}>{item.appointment_date} {item.appointment_time}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickCard({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickCard} activeOpacity={0.85}>
      <Text style={styles.quickLabel}>{label}{"\n"}</Text>
      <Text style={styles.quickHint}>{hint}</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: panelTheme.page },
  content: { padding: 16, paddingBottom: 30 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginTop: 2 },
  subtitle: { color: panelTheme.muted, marginTop: 4, marginBottom: 14 },
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  quickCard: { flex: 1, backgroundColor: panelTheme.surface, borderRadius: panelTheme.radius.md, padding: 14, overflow: "hidden", borderWidth: 1, borderColor: panelTheme.border },
  quickLabel: { fontWeight: "900", fontSize: 15, color: panelTheme.heading },
  quickHint: { color: panelTheme.muted, fontSize: 12 },
  heroCard: { backgroundColor: panelTheme.dark, borderRadius: panelTheme.radius.lg, padding: 18, shadowColor: "#0f172a", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  heroLabel: { color: "#cbd5e1", fontSize: 13 },
  heroValue: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 8 },
  heroSub: { color: "#94a3b8", marginTop: 6 },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, marginTop: 12, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#60a5fa" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  stat: { flex: 1, backgroundColor: panelTheme.surface, borderRadius: panelTheme.radius.md, padding: 16, borderWidth: 1, borderColor: panelTheme.border },
  statValue: { fontSize: 24, fontWeight: "900", color: panelTheme.heading },
  statLabel: { color: panelTheme.muted, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: panelTheme.heading, marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: panelTheme.surface, borderRadius: panelTheme.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: panelTheme.border, shadowColor: "#0f172a", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: panelTheme.heading },
  cardSub: { color: panelTheme.text, marginTop: 4 },
  cardMeta: { color: panelTheme.muted, marginTop: 6 },
  badge: { color: panelTheme.teal, fontWeight: "800", textTransform: "capitalize" },
  empty: { color: panelTheme.muted, marginTop: 8 },
});
