import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { getBarberNotifications, markBarberNotificationRead, type BarberNotificationApi } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";
import { showLocalNotification } from "@/services/NotificationService";

export default function BarberNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [notifications, setNotifications] = useState<BarberNotificationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const announcedIdsRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!barberId) {
      return;
    }
    try {
      const rows = await getBarberNotifications(barberId);
      setNotifications(rows);

      const unreadRows = rows.filter((item) => !item.read);
      for (const item of unreadRows) {
        if (!announcedIdsRef.current.has(item.id)) {
          announcedIdsRef.current.add(item.id);
          try {
            await showLocalNotification(item.title || "Yangi xabar", item.message || "Sizga yangi bildirishnoma keldi", item.type || "barber_notification");
          } catch {
            // local notification muvaffaqiyatsiz bo'lsa UI ishlashi davom etadi
          }
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [barberId]);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  const markRead = async (notificationId: number) => {
    try {
      setBusyId(notificationId);
      await markBarberNotificationRead(barberId, notificationId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.eyebrow}>XABARLAR</Text>
        <Text style={styles.title}>Bildirishnomalar</Text>
        <Text style={styles.subtitle}>{notifications.filter((item) => !item.read).length} ta o‘qilmagan xabar</Text>

        {loading ? <ActivityIndicator size="large" color="#0f766e" style={{ marginTop: 40 }} /> : null}

        {notifications.map((item) => (
          <View key={item.id} style={[styles.card, !item.read && styles.cardUnread]}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={[styles.typeBadge, item.read ? styles.typeRead : styles.typeUnread]}>{item.read ? "read" : item.type}</Text>
            </View>
            <Text style={styles.cardSub}>{item.message}</Text>
            {!!item.created_at && <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleString("uz-UZ")}</Text>}
            {!item.read ? (
              <TouchableOpacity style={[styles.readBtn, busyId === item.id && { opacity: 0.7 }]} onPress={() => markRead(item.id)} disabled={busyId === item.id}>
                <Text style={styles.readBtnText}>{busyId === item.id ? "Belgilanyapti..." : "O‘qildi deb belgilash"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  content: { padding: 16 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginTop: 2 },
  subtitle: { color: panelTheme.muted, marginTop: 4, marginBottom: 14 },
  card: { backgroundColor: panelTheme.surface, borderRadius: panelTheme.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: panelTheme.border, shadowColor: "#0f172a", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardUnread: { borderWidth: 1, borderColor: "#93c5fd" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: panelTheme.heading, flex: 1 },
  cardSub: { color: panelTheme.text, marginTop: 6, lineHeight: 20 },
  cardMeta: { color: panelTheme.muted, marginTop: 8, fontSize: 12 },
  typeBadge: { borderRadius: panelTheme.radius.pill, paddingHorizontal: 10, paddingVertical: 4, fontWeight: "900", overflow: "hidden" },
  typeUnread: { backgroundColor: "#dbeafe", color: "#1e3a8a" },
  typeRead: { backgroundColor: "#e2e8f0", color: "#475569" },
  readBtn: { alignSelf: "flex-start", marginTop: 12, backgroundColor: panelTheme.dark, borderRadius: panelTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  readBtnText: { color: "#fff", fontWeight: "900" },
});
