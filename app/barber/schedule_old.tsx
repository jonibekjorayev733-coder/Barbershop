import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { approveBarberAppointment, completeBarberAppointment, getBarberAppointments, rejectBarberAppointment, type BarberAppointmentApi } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";
import { showLocalNotification } from "@/services/NotificationService";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FILTERS: Array<{ label: string; value: "all" | "pending" | "completed" }> = [
  { label: "Hammasi", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default function BarberScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [appointments, setAppointments] = useState<BarberAppointmentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(setToken);
  }, [session?.access_token]);

  const load = useCallback(async () => {
    if (!barberId) return;
    const rows = await getBarberAppointments(barberId, { status });
    setAppointments(rows);
    setLoading(false);
    setRefreshing(false);
  }, [barberId, status]);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  // Real-time: reload when new booking for this barber arrives
  useRealtimeChannel(
    barberId ? `barber:${barberId}` : "",
    token,
    useCallback(() => { load(); }, [load]),
    !!token && !!barberId,
  );

  const runAction = async (id: number, action: "approve" | "reject" | "complete") => {
    try {
      setBusyId(id);
      if (action === "approve") await approveBarberAppointment(barberId, id);
      if (action === "reject") await rejectBarberAppointment(barberId, id);
      if (action === "complete") await completeBarberAppointment(barberId, id);
      if (action === "approve") {
        await showLocalNotification("✅ Bron tasdiqlandi", "Mijoz broni tasdiqlandi", "booking_approved");
      }
      if (action === "reject") {
        await showLocalNotification("❌ Bron rad etildi", "Mijoz broni rad etildi", "booking_rejected");
      }
      if (action === "complete") {
        await showLocalNotification("🏁 Xizmat yakunlandi", "Bron completed holatiga o'tkazildi", "booking_completed");
      }
      await load();
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Amal bajarilmadi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.eyebrow}>ISH JADVALI</Text>
        <Text style={styles.title}>Jadval</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity key={filter.value} style={[styles.filterChip, status === filter.value && styles.filterChipActive]} onPress={() => setStatus(filter.value)}>
              <Text style={[styles.filterText, status === filter.value && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator size="large" color="#0f766e" style={{ marginTop: 40 }} /> : null}

        {appointments.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.client_name}</Text>
            <Text style={styles.cardSub}>{item.service_name || "Xizmat"}</Text>
            <Text style={styles.cardMeta}>{item.appointment_date} {item.appointment_time}</Text>
            <Text style={styles.cardMeta}>📞 {item.client_phone}</Text>
            <View style={styles.actions}>
              {item.status === "pending" ? (
                <>
                  <ActionButton title="Approve" color="#0f766e" disabled={busyId === item.id} onPress={() => runAction(item.id, "approve")} />
                  <ActionButton title="Reject" color="#dc2626" disabled={busyId === item.id} onPress={() => runAction(item.id, "reject")} />
                </>
              ) : null}
              {item.status === "completed" ? null : (
                <ActionButton title="Complete" color="#2563eb" disabled={busyId === item.id} onPress={() => runAction(item.id, "complete")} />
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ title, color, onPress, disabled }: { title: string; color: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }, disabled && { opacity: 0.6 }]} onPress={onPress} disabled={disabled}><Text style={styles.actionText}>{title}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  content: { padding: 16 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginTop: 2 },
  filterRow: { marginTop: 12, marginBottom: 14 },
  filterChip: { backgroundColor: "#e0f2fe", borderRadius: panelTheme.radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: "#bfdbfe" },
  filterChipActive: { backgroundColor: panelTheme.dark },
  filterText: { color: panelTheme.blue, fontWeight: "800", fontSize: 13 },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: panelTheme.surface, borderRadius: panelTheme.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: panelTheme.border, boxShadow: "0px 3px 8px rgba(15, 23, 42, 0.04)", elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: panelTheme.heading },
  cardSub: { color: panelTheme.text, marginTop: 4 },
  cardMeta: { color: panelTheme.muted, marginTop: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  actionText: { color: "#fff", fontWeight: "800" },
});
