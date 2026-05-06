import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getBookings, type AdminBookingApi } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FILTERS: Array<{ label: string; value: "all" | "pending" | "completed" | "cancelled" }> = [
  { label: "Hammasi", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bookings, setBookings] = useState<AdminBookingApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsIndicator = useRef(false);

  // Load token for WS auth
  useEffect(() => {
    AsyncStorage.getItem("access_token").then(setToken);
  }, [session?.access_token]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await getBookings({ status, date: selectedDate });
      setBookings(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bronlar yuklanmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, status]);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  // Real-time: reload when any booking event arrives on "bookings" channel
  useRealtimeChannel(
    "bookings",
    token,
    useCallback(() => {
      wsIndicator.current = true;
      load();
    }, [load]),
    !!token,
  );

  const totalAmount = useMemo(() => bookings.reduce((sum, item) => sum + item.price, 0), [bookings]);
  const doneCount = useMemo(() => bookings.filter((item) => item.status === "completed").length, [bookings]);
  const pendingCount = useMemo(() => bookings.filter((item) => item.status === "pending").length, [bookings]);

  const shiftDate = (days: number) => {
    const next = new Date(`${selectedDate}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    setSelectedDate(next.toISOString().split("T")[0]);
  };

  const formattedDate = useMemo(
    () => new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("uz-UZ", { weekday: "long", month: "short", day: "numeric" }),
    [selectedDate],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.eyebrow}>BUYURTMALAR</Text>
        <Text style={styles.title}>Bronlar</Text>
        <Text style={styles.subtitle}>{bookings.length} ta bron · {totalAmount.toLocaleString("uz-UZ")} so&apos;m</Text>

        <View style={styles.dateBar}>
          <TouchableOpacity style={styles.dateNav} onPress={() => shiftDate(-1)}>
            <Text style={styles.dateNavText}>←</Text>
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dateLabel}>Tanlangan kun</Text>
            <Text style={styles.dateValue}>{formattedDate}</Text>
          </View>
          <TouchableOpacity style={styles.dateNav} onPress={() => shiftDate(1)}>
            <Text style={styles.dateNavText}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryChip, styles.summaryChipTotal]}>{bookings.length} jami</Text>
          <Text style={[styles.summaryChip, styles.summaryChipDone]}>{doneCount} done</Text>
          <Text style={[styles.summaryChip, styles.summaryChipPending]}>{pendingCount} pending</Text>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity key={filter.value} style={[styles.filterChip, status === filter.value && styles.filterChipActive]} onPress={() => setStatus(filter.value)}>
              <Text style={[styles.filterText, status === filter.value && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {bookings.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.client}>{booking.client}</Text>
              <Badge status={booking.status} />
            </View>
            <Text style={styles.meta}>{booking.barber} · {booking.service}</Text>
            <Text style={styles.meta}>📞 {booking.phone}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.time}>{booking.date} {booking.time}</Text>
              <Text style={styles.price}>{booking.price.toLocaleString("uz-UZ")} so&apos;m</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ status }: { status: AdminBookingApi["status"] }) {
  const colors = {
    pending: ["#fef3c7", "#b45309", "Pending"],
    completed: ["#dcfce7", "#166534", "Completed"],
    cancelled: ["#fee2e2", "#b91c1c", "Cancelled"],
  } as const;
  const [bg, color, label] = colors[status];
  return <Text style={[styles.badge, { backgroundColor: bg, color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginTop: 2 },
  subtitle: { color: panelTheme.muted, marginTop: 4, marginBottom: 14, fontSize: 15 },
  dateBar: { backgroundColor: "#fff", borderRadius: 24, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#e5e7eb", boxShadow: "0px 3px 8px rgba(15, 23, 42, 0.05)", elevation: 2 },
  dateNav: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  dateNavText: { color: panelTheme.heading, fontSize: 18, fontWeight: "900" },
  dateCenter: { flex: 1, alignItems: "center" },
  dateLabel: { color: panelTheme.muted, fontSize: 14 },
  dateValue: { color: panelTheme.heading, fontSize: 23, fontWeight: "900", marginTop: 4, textTransform: "lowercase" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  summaryChip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontWeight: "900", overflow: "hidden", fontSize: 15, borderWidth: 1, borderColor: "#e5e7eb" },
  summaryChipTotal: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  summaryChipDone: { backgroundColor: "#dcfce7", color: "#166534" },
  summaryChipPending: { backgroundColor: "#fef3c7", color: "#b45309" },
  filterRow: { marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { backgroundColor: "#e9edf4", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  filterChipActive: { backgroundColor: panelTheme.dark },
  filterText: { color: panelTheme.text, fontWeight: "800", fontSize: 14 },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb", boxShadow: "0px 3px 8px rgba(15, 23, 42, 0.05)", elevation: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  client: { fontSize: 22, fontWeight: "900", color: panelTheme.heading },
  meta: { color: panelTheme.text, marginTop: 6, fontSize: 14 },
  time: { color: "#64748b", marginTop: 9, fontSize: 12 },
  price: { color: panelTheme.dark, fontWeight: "900", marginTop: 8, fontSize: 18 },
  badge: { fontSize: 14, fontWeight: "800", borderRadius: panelTheme.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  errorText: { color: "#b91c1c", marginBottom: 10 },
});
