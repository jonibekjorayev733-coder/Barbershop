import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { getBarberDashboard, getBarberNotifications, type BarberDashboardApi, type BarberNotificationApi } from "@/services/api";
import { barberDesign } from "@/constants/barber-design";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function BarberDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<BarberDashboardApi | null>(null);
  const [notifications, setNotifications] = useState<BarberNotificationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { colors, card } = barberDesign;

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(setToken);
  }, [session?.access_token]);

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

  useRealtimeChannel(
    barberId ? `barber:${barberId}` : "",
    token,
    useCallback(() => { load(); }, [load]),
    !!token && !!barberId,
  );

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.goldAlt} /></View>;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const progressPct = Math.round((dashboard?.progress_ratio ?? 0) * 100);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.goldAlt} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>BARBER PANEL</Text>
          <View style={styles.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: colors.text }]}>Salom, {session?.name?.split(" ")[0]}</Text>
              <Text style={[styles.greetSub, { color: colors.textTertiary }]}>Bugungi faoliyat</Text>
            </View>
            <View style={[styles.iconBadge, { backgroundColor: `${colors.goldAlt}15`, borderColor: `${colors.goldAlt}30` }]}>
              <Ionicons name="diamond" size={20} color={colors.goldAlt} />
            </View>
          </View>
        </View>

        <View style={[styles.heroCard, { backgroundColor: card.bg, borderColor: card.border }]}>
          <LinearGradient colors={[`${colors.goldAlt}20`, `${colors.goldAlt}05`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Bugungi Bronlar</Text>
              <Text style={[styles.heroValue, { color: colors.goldAlt }]}>{dashboard?.today_done ?? 0}/{dashboard?.today_total ?? 0}</Text>
              <Text style={[styles.heroSub, { color: colors.textTertiary }]}>Yakunlangan / Jami</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroPercent, { color: colors.goldAlt }]}>{progressPct}%</Text>
              <Text style={[{ color: colors.textTertiary, fontSize: 11, fontWeight: "600" }]}>Progress</Text>
            </View>
          </View>
          <View style={[styles.progressBar, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: colors.goldAlt }]} />
          </View>
        </View>

        <View style={styles.quickRow}>
          <QuickCard icon="time" label="Jadval" hint="Bugungi" color={colors.teal} onPress={() => router.push("/barber/schedule")} />
          <QuickCard icon="notifications" label="Xabarlar" hint={`${unreadCount} ta`} color={colors.info} badge={unreadCount > 0} onPress={() => router.push("/barber/notifications")} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Pending" value={String(dashboard?.today_pending ?? 0)} icon="hourglass" color={colors.warning} />
          <StatCard label="Unread" value={String(unreadCount)} icon="mail" color={colors.info} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Keyingi Mijoz</Text>
        {dashboard?.next_appointment ? (
          <View style={[styles.appointmentCard, { backgroundColor: card.bg, borderColor: card.border }]}>
            <View style={styles.appointmentHeader}>
              <View style={[styles.appointmentIcon, { backgroundColor: `${colors.goldAlt}15` }]}>
                <Ionicons name="person-circle" size={40} color={colors.goldAlt} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.appointmentName, { color: colors.text }]}>{dashboard.next_appointment.client_name}</Text>
                <Text style={[styles.appointmentService, { color: colors.textSecondary }]}>{dashboard.next_appointment.service_name || "Xizmat"}</Text>
              </View>
            </View>
            <View style={styles.appointmentMeta}>
              <MetaItem icon="calendar" text={dashboard.next_appointment.appointment_date} color={colors.teal} />
              <MetaItem icon="time" text={dashboard.next_appointment.appointment_time} color={colors.teal} />
              <MetaItem icon="call" text={dashboard.next_appointment.client_phone} color={colors.teal} />
            </View>
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>Bugun keyingi mijoz yo’q</Text>
        )}

        {notifications.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Yangi Xabarlar</Text>
            {notifications.slice(0, 3).map((item) => (
              <View key={item.id} style={[styles.notifCard, { backgroundColor: item.read ? card.bgAlt : card.bg, borderColor: item.read ? "transparent" : card.border }]}>
                <View style={[styles.notifDot, { backgroundColor: item.read ? colors.muted : colors.goldAlt }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={1}>{item.message}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickCard({ icon, label, hint, color, onPress, badge }: { icon: string; label: string; hint: string; color: string; onPress: () => void; badge?: boolean }) {
  const { card, colors } = barberDesign;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.quickCard, { backgroundColor: card.bg, borderColor: card.border }]}>
      <LinearGradient colors={[`${color}20`, `${color}05`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.quickIcon, { backgroundColor: `${color}25` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
        {badge && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
      </View>
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.quickHint, { color: colors.textSecondary }]}>{hint}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const { card, colors } = barberDesign;
  return (
    <View style={[styles.statCard, { backgroundColor: card.bg, borderColor: card.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function MetaItem({ icon, text, color }: { icon: string; text: string; color: string }) {
  const { colors } = barberDesign;
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: barberDesign.spacing.lg, paddingTop: barberDesign.spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: barberDesign.spacing.xl },
  eyebrow: { ...barberDesign.typography.eyebrow, marginBottom: barberDesign.spacing.sm },
  greetRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  greeting: { ...barberDesign.typography.h1, marginBottom: barberDesign.spacing.sm },
  greetSub: { ...barberDesign.typography.body },
  iconBadge: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroCard: { borderRadius: barberDesign.radii.lg, borderWidth: 1, padding: barberDesign.spacing.lg, marginBottom: barberDesign.spacing.xl, overflow: "hidden" },
  heroContent: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: barberDesign.spacing.lg },
  heroLabel: { ...barberDesign.typography.caption, marginBottom: barberDesign.spacing.sm },
  heroValue: { ...barberDesign.typography.display, marginBottom: barberDesign.spacing.xs },
  heroSub: { ...barberDesign.typography.caption },
  heroStat: { alignItems: "center" },
  heroPercent: { ...barberDesign.typography.h2, marginBottom: barberDesign.spacing.xs },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  quickRow: { flexDirection: "row", gap: barberDesign.spacing.md, marginBottom: barberDesign.spacing.xl },
  quickCard: { flex: 1, borderRadius: barberDesign.radii.lg, borderWidth: 1, padding: barberDesign.spacing.lg, alignItems: "center", overflow: "hidden" },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: barberDesign.spacing.md, position: "relative" },
  badge: { position: "absolute", width: 8, height: 8, borderRadius: 4, top: -2, right: -2 },
  quickLabel: { ...barberDesign.typography.bodyLg, fontWeight: "700", marginBottom: barberDesign.spacing.xs },
  quickHint: { ...barberDesign.typography.caption },
  statsGrid: { flexDirection: "row", gap: barberDesign.spacing.md, marginBottom: barberDesign.spacing.xl },
  statCard: { flex: 1, borderRadius: barberDesign.radii.lg, borderWidth: 1, padding: barberDesign.spacing.lg, alignItems: "center" },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: barberDesign.spacing.md },
  statLabel: { ...barberDesign.typography.caption, marginBottom: barberDesign.spacing.xs },
  statValue: { ...barberDesign.typography.h3 },
  sectionTitle: { ...barberDesign.typography.h3, marginBottom: barberDesign.spacing.lg, marginTop: barberDesign.spacing.md },
  appointmentCard: { borderRadius: barberDesign.radii.lg, borderWidth: 1, padding: barberDesign.spacing.lg, marginBottom: barberDesign.spacing.xl },
  appointmentHeader: { flexDirection: "row", alignItems: "center", marginBottom: barberDesign.spacing.lg, gap: barberDesign.spacing.md },
  appointmentIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  appointmentName: { ...barberDesign.typography.bodyLg, fontWeight: "700", marginBottom: barberDesign.spacing.xs },
  appointmentService: { ...barberDesign.typography.caption },
  appointmentMeta: { gap: barberDesign.spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: barberDesign.spacing.sm },
  metaText: { ...barberDesign.typography.body, flex: 1 },
  notifCard: { borderRadius: barberDesign.radii.lg, borderWidth: 1, padding: barberDesign.spacing.lg, flexDirection: "row", alignItems: "flex-start", gap: barberDesign.spacing.md, marginBottom: barberDesign.spacing.md },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifTitle: { ...barberDesign.typography.bodyLg, fontWeight: "700", marginBottom: barberDesign.spacing.xs },
  notifBody: { ...barberDesign.typography.caption },
  empty: { ...barberDesign.typography.body, textAlign: "center", marginVertical: barberDesign.spacing.xl },
});
