import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getUserAppointments, type UserAppointmentApi } from "@/services/api";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { userDesign } from "@/constants/user-design";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LanguageCode = "uz" | "ru" | "en";

const COPY: Record<string, Record<LanguageCode, string>> = {
  all: { uz: "Barchasi", ru: "Все", en: "All" },
  header: { uz: "MENING BRONLARIM", ru: "МОИ ЗАПИСИ", en: "MY BOOKINGS" },
  pendingShort: { uz: "kutilmoqda", ru: "ожидают", en: "pending" },
  nextBooking: { uz: "KEYINGI BRON", ru: "СЛЕДУЮЩАЯ ЗАПИСЬ", en: "NEXT BOOKING" },
  completed: { uz: "Bajarildi", ru: "Завершено", en: "Completed" },
  totalSum: { uz: "Jami so'm", ru: "Сумма", en: "Total sum" },
  loading: { uz: "Bronlaringiz yuklanmoqda...", ru: "Загружаем записи...", en: "Loading your bookings..." },
  noBookings: { uz: "Hali bron yo'q", ru: "Записей пока нет", en: "No bookings yet" },
  noBookingsSub: { uz: "Sartarosh tanlang va birinchi broningizni qiling!", ru: "Выберите барбера и сделайте первую запись!", en: "Pick a barber and make your first booking!" },
  noCategory: { uz: "Bu toifada hozircha bron mavjud emas.", ru: "В этой категории пока нет записей.", en: "No bookings in this category yet." },
  chooseBarber: { uz: "Sartarosh tanlash", ru: "Выбрать барбера", en: "Choose barber" },
  date: { uz: "Sana", ru: "Дата", en: "Date" },
  time: { uz: "Vaqt", ru: "Время", en: "Time" },
  pendingMsg: { uz: "Sartarosh hali tasdiqlamadi. Tez orada javob keladi.", ru: "Барбер еще не подтвердил. Скоро будет ответ.", en: "Barber has not confirmed yet. You will get a response soon." },
  acceptedMsg: { uz: "Sartarosh tasdiqladi — bron jarayonda.", ru: "Барбер подтвердил — запись в процессе.", en: "Barber confirmed — your booking is in progress." },
  userFallback: { uz: "Foydalanuvchi", ru: "Пользователь", en: "User" },
};

function toUz24h(timeValue: string): string {
  const value = String(timeValue || "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  accepted: "Jarayonda",
  completed: "Tugagan",
  rejected: "Rad etilgan",
  cancelled: "Rad etilgan",
};

const STATUS_LABELS_I18N: Record<LanguageCode, Record<string, string>> = {
  uz: { pending: "Kutilmoqda", accepted: "Jarayonda", completed: "Tugagan", rejected: "Rad etilgan", cancelled: "Rad etilgan" },
  ru: { pending: "Ожидает", accepted: "В процессе", completed: "Завершено", rejected: "Отклонено", cancelled: "Отклонено" },
  en: { pending: "Pending", accepted: "In progress", completed: "Done", rejected: "Rejected", cancelled: "Rejected" },
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  accepted: userDesign.accent,
  completed: "#10b981",
  rejected: "#ef4444",
  cancelled: "#ef4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "rgba(245, 158, 11, 0.15)",
  accepted: "rgba(255,122,26,0.14)",
  completed: "rgba(16, 185, 129, 0.15)",
  rejected: "rgba(239, 68, 68, 0.16)",
  cancelled: "rgba(239, 68, 68, 0.16)",
};
const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: "time-outline",
  accepted: "checkmark-circle-outline",
  completed: "checkmark-done-circle-outline",
  rejected: "close-circle-outline",
  cancelled: "close-circle-outline",
};

type FilterTab = "all" | "pending" | "accepted" | "completed" | "rejected";

export default function MyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { language } = useLanguage();
  const swipeTabs = useTabSwipeNavigation("mybookings");
  const [appointments, setAppointments] = useState<UserAppointmentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [token, setToken] = useState<string | null>(null);
  const tr = useCallback((key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz, [language]);
  const statusLabel = useCallback((status: string) => STATUS_LABELS_I18N[language]?.[status] ?? STATUS_LABELS[status] ?? status, [language]);
  const filterItems = useMemo<{ key: FilterTab; label: string }[]>(() => ([
    { key: "all" as const, label: tr("all") },
    { key: "pending" as const, label: statusLabel("pending") },
    { key: "accepted" as const, label: statusLabel("accepted") },
    { key: "completed" as const, label: statusLabel("completed") },
    { key: "rejected" as const, label: statusLabel("rejected") },
  ]), [statusLabel, tr]);

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(setToken);
  }, [session?.access_token]);

  const load = useCallback(async () => {
    if (!session?.user_id) {
      setLoading(false);
      return;
    }
    try {
      const rows = await getUserAppointments(session.user_id);
      setAppointments(rows);
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Bronlar yuklanmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRealtimeChannel(
    "bookings",
    token,
    useCallback((event, data) => {
      if (!["booking.created", "booking.accepted", "booking.completed", "booking.cancelled", "booking.rated"].includes(event)) {
        return;
      }
      if (!session?.user_id) return;
      const bookingUserId = Number(data?.student_id ?? data?.user_id ?? 0);
      if (bookingUserId && bookingUserId !== session.user_id) return;
      void load();
    }, [load, session?.user_id]),
    !!token && !!session?.user_id,
  );

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) =>
          filter === "rejected" ? a.status === "rejected" || a.status === "cancelled" : a.status === filter,
        );

  const counts: Record<FilterTab, number> = {
    all: appointments.length,
    pending: appointments.filter((a) => a.status === "pending").length,
    accepted: appointments.filter((a) => a.status === "accepted").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    rejected: appointments.filter((a) => a.status === "rejected" || a.status === "cancelled").length,
  };

  const totalSpent = appointments
    .filter((a) => a.status === "completed" && a.service_price)
    .reduce((sum, a) => sum + (a.service_price ?? 0), 0);

  const nextBooking = appointments
    .filter((a) => a.status === "pending" || a.status === "accepted")
    .sort((a, b) =>
      `${a.appointment_date} ${a.appointment_time}`.localeCompare(
        `${b.appointment_date} ${b.appointment_time}`,
      ),
    )[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} {...swipeTabs.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>{tr("header")}</Text>
          <Text style={styles.headerTitle}>{session?.name ?? tr("userFallback")}</Text>
          <Text style={styles.headerSub}>
            {appointments.length} ta bron · {counts.pending} ta {tr("pendingShort")}
          </Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/user/home")} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Keyingi bron banner */}
      {nextBooking && !loading && (
        <View style={styles.nextBanner}>
          <View style={styles.nextBannerLeft}>
            <Ionicons name="alarm-outline" size={22} color="#fde68a" />
            <View>
              <Text style={styles.nextBannerLabel}>{tr("nextBooking")}</Text>
              <Text style={styles.nextBannerBarber}>{nextBooking.barber_name ?? "Sartarosh"}</Text>
              <Text style={styles.nextBannerTime}>
                {nextBooking.appointment_date} · {toUz24h(nextBooking.appointment_time)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.nextBannerBadge,
              { backgroundColor: `${STATUS_COLORS[nextBooking.status]}28` },
            ]}
          >
            <Text
              style={[styles.nextBannerBadgeText, { color: STATUS_COLORS[nextBooking.status] }]}
            >
              {statusLabel(nextBooking.status)}
            </Text>
          </View>
        </View>
      )}

      {/* Statistika */}
      {!loading && appointments.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{counts.completed}</Text>
            <Text style={styles.statLbl}>{tr("completed")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{counts.pending}</Text>
            <Text style={styles.statLbl}>{statusLabel("pending")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: "#10b981", fontSize: 14 }]}>
              {totalSpent >= 1000 ? `${Math.round(totalSpent / 1000)}k so'm` : String(Math.round(totalSpent))}
            </Text>
            <Text style={styles.statLbl}>{tr("totalSum")}</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {filterItems.map((item) => {
            const active = filter === item.key;
            const color = item.key === "all" ? userDesign.accent : STATUS_COLORS[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
                {counts[item.key] > 0 && (
                  <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                    <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                      {counts[item.key]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Ro'yxat */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={userDesign.accent}
            colors={[userDesign.accent]}
          />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <View style={styles.loadingIconWrap}>
              <Ionicons name="calendar-outline" size={42} color={userDesign.accent} />
            </View>
            <ActivityIndicator size="large" color={userDesign.accent} style={{ marginTop: 16 }} />
            <Text style={styles.loadingText}>{tr("loading")}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-clear-outline" size={50} color={userDesign.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === "all" ? tr("noBookings") : statusLabel(filter)}
            </Text>
            <Text style={styles.emptySub}>
              {filter === "all"
                ? tr("noBookingsSub")
                : tr("noCategory")}
            </Text>
            {filter === "all" && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/user/home")} activeOpacity={0.7}>
                <Ionicons name="cut-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>{tr("chooseBarber")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((appt, idx) => (
            <BookingCard key={appt.id} appointment={appt} index={idx} tr={tr} statusLabel={statusLabel} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({
  appointment,
  index,
  tr,
  statusLabel,
}: {
  appointment: UserAppointmentApi;
  index: number;
  tr: (key: keyof typeof COPY) => string;
  statusLabel: (status: string) => string;
}) {
  const statusColor = STATUS_COLORS[appointment.status] ?? "#94a3b8";
  const statusBg = STATUS_BG[appointment.status] ?? userDesign.cardSoft;
  const statusIcon = STATUS_ICONS[appointment.status] ?? "help-circle-outline";
  const isPending = appointment.status === "pending" || appointment.status === "accepted";

  return (
    <View style={[styles.card, index > 0 && { marginTop: 12 }]}>
      <View style={[styles.cardBar, { backgroundColor: statusColor }]} />
      <View style={styles.cardBody}>
        {/* Avatar + ism + status */}
        <View style={styles.cardTop}>
          <View style={[styles.cardAvatar, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.cardAvatarLetter, { color: statusColor }]}>
              {(appointment.barber_name ?? "S")[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardBarberName}>{appointment.barber_name ?? "Sartarosh"}</Text>
            <Text style={styles.cardServiceName}>{appointment.barber_specialty ?? "Xizmat"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Ionicons name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabel(appointment.status)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sana · Vaqt · Narx */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={14} color={userDesign.accent} />
            </View>
            <View>
              <Text style={styles.infoLabel}>{tr("date")}</Text>
              <Text style={styles.infoValue}>{appointment.appointment_date}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="time-outline" size={14} color={userDesign.accent} />
            </View>
            <View>
              <Text style={styles.infoLabel}>{tr("time")}</Text>
              <Text style={styles.infoValue}>{toUz24h(appointment.appointment_time)}</Text>
            </View>
          </View>
          {appointment.service_price != null && (
            <View style={styles.priceChip}>
              <Text style={styles.priceChipText}>
                {Math.round(appointment.service_price).toLocaleString("uz-UZ")} so&apos;m
              </Text>
            </View>
          )}
        </View>

        {/* Holat xabardorlik */}
        {isPending && (
          <View style={styles.notice}>
            <Ionicons
              name={appointment.status === "pending" ? "information-circle-outline" : "checkmark-circle-outline"}
              size={15}
              color={appointment.status === "pending" ? "#f59e0b" : "#10b981"}
            />
            <Text style={styles.noticeText}>
              {appointment.status === "pending"
                ? tr("pendingMsg")
                : tr("acceptedMsg")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: userDesign.page },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: userDesign.card,
    borderBottomWidth: 1,
    borderBottomColor: userDesign.line,
    ...Platform.select({
      ios: { shadowColor: "#111111", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  headerLabel: { fontSize: 10, fontWeight: "700", color: userDesign.accentStrong, letterSpacing: 1.2, marginBottom: 3 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: userDesign.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: userDesign.textMuted, marginTop: 2 },
  newBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: userDesign.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.4)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 12px rgba(255, 122, 26, 0.25)" }
      : { shadowColor: "#ff7a1a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 5 }),
  },

  nextBanner: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 14, backgroundColor: userDesign.card,
    padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1,
    borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(17, 17, 17, 0.08)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  nextBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  nextBannerLabel: { fontSize: 10, fontWeight: "700", color: userDesign.textMuted, letterSpacing: 1.1 },
  nextBannerBarber: { fontSize: 14, fontWeight: "900", color: userDesign.text, marginTop: 2 },
  nextBannerTime: { fontSize: 12, color: userDesign.accent, marginTop: 2, fontWeight: "700" },
  nextBannerBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  nextBannerBadgeText: { fontSize: 12, fontWeight: "900" },

  statsRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: userDesign.card,
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 6px rgba(17, 17, 17, 0.06)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }),
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 30, backgroundColor: userDesign.line },
  statNum: { fontSize: 20, fontWeight: "900", color: userDesign.text },
  statLbl: { fontSize: 10, color: userDesign.textMuted, fontWeight: "600", marginTop: 1 },

  filterSection: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: userDesign.card,
    borderWidth: 1,
    borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 3px 8px rgba(17, 17, 17, 0.06)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }),
  },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 10, gap: 8, paddingVertical: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: userDesign.line, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#ffffff",
  },
  filterChipText: { fontSize: 12, fontWeight: "700", color: userDesign.textMuted },
  filterChipTextActive: { color: "#fff" },
  chipBadge: {
    backgroundColor: "rgba(15,23,42,0.08)", borderRadius: 999, minWidth: 20, height: 20,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.24)" },
  chipBadgeText: { fontSize: 11, fontWeight: "900", color: userDesign.text },
  chipBadgeTextActive: { color: "#fff" },

  listContent: { paddingHorizontal: 16, paddingTop: 14 },

  centered: { alignItems: "center", paddingTop: 60 },
  loadingIconWrap: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: "rgba(255,122,26,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: userDesign.textMuted, fontSize: 13, fontWeight: "600" },

  emptyWrap: { alignItems: "center", paddingTop: 50, paddingHorizontal: 24 },
  emptyBox: {
    width: 88, height: 88, borderRadius: 18, backgroundColor: "rgba(255,122,26,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.22)",
    alignItems: "center", justifyContent: "center", marginBottom: 22,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 12px rgba(255,122,26,0.15)" }
      : { shadowColor: "rgba(255,122,26,0.22)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 }),
  },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: userDesign.text, textAlign: "center", marginBottom: 8 },
  emptySub: { fontSize: 13, color: userDesign.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: userDesign.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.4)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 12px rgba(255,122,26,0.28)" }
      : { shadowColor: "rgba(255,122,26,0.3)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 3 }),
  },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  card: {
    backgroundColor: userDesign.card, borderRadius: userDesign.radius.lg, overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 14px rgba(17, 17, 17, 0.07)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }),
    borderWidth: 1, borderColor: userDesign.line,
  },
  cardBar: { height: 4 },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardAvatar: {
    width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  cardAvatarLetter: { fontSize: 18, fontWeight: "900" },
  cardMeta: { flex: 1 },
  cardBarberName: { fontSize: 15, fontWeight: "900", color: userDesign.text },
  cardServiceName: { fontSize: 12, color: userDesign.textMuted, marginTop: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "rgba(148,163,184,0.12)", marginVertical: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(255,122,26,0.10)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,122,26,0.2)" },
  infoLabel: { fontSize: 10, color: userDesign.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: "800", color: userDesign.text, marginTop: 1 },
  priceChip: {
    marginLeft: "auto",
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priceChipText: { fontSize: 13, fontWeight: "900", color: "#10b981" },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  noticeText: { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18, fontWeight: "600" },
});
