import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotificationsWS, type WsNotificationPayload } from "@/hooks/useNotificationsWS";
import {
  markNotificationRead,
  getUserNotifications,
  type UserNotificationApi,
} from "@/services/api";
import { requestNotificationPermission } from "@/services/NotificationService";
import { userDesign } from "@/constants/user-design";

function mapWsNotification(
  payload: WsNotificationPayload,
  defaults: { title: string; message: string },
): UserNotificationApi {
  return {
    id: payload.id,
    type: payload.type || "booking_update",
    title: payload.title || defaults.title,
    message: payload.message || defaults.message,
    barber_id: payload.barber_id ?? null,
    appointment_id: payload.appointment_id ?? null,
    sms_sent: Boolean(payload.sms_sent),
    voice_sent: Boolean(payload.voice_sent),
    is_read: Boolean(payload.is_read),
    created_at: payload.created_at ?? null,
  };
}

function formatTime(dateStr: string | null, language: "uz" | "ru" | "en"): string {
  if (!dateStr) return language === "ru" ? "Сейчас" : language === "en" ? "Now" : "Hozir";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return language === "ru" ? "Только что" : language === "en" ? "Just now" : "Hozirgina";
  if (diffMin < 60) {
    if (language === "ru") return `${diffMin} мин назад`;
    if (language === "en") return `${diffMin} min ago`;
    return `${diffMin} daq. oldin`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    if (language === "ru") return `${diffH} ч назад`;
    if (language === "en") return `${diffH} h ago`;
    return `${diffH} soat oldin`;
  }
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

type IconName = keyof typeof Ionicons.glyphMap;
const TYPE_META: Record<string, { icon: IconName; color: string; bg: string }> = {
  booking_confirmed: { icon: "checkmark-circle",  color: "#10b981", bg: "#d1fae5" },
  booking_update:    { icon: "refresh-circle",    color: "#f59e0b", bg: "#fef3c7" },
  booking_cancelled: { icon: "close-circle",      color: "#ef4444", bg: "#fee2e2" },
  reminder:          { icon: "alarm",             color: "#8b5cf6", bg: "#ede9fe" },
  default:           { icon: "notifications",     color: userDesign.accent, bg: "#fff1e6" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.default;
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<UserNotificationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const COPY = useMemo(() => ({
    fallbackTitle: { uz: "Yangi bildirishnoma", ru: "Новое уведомление", en: "New notification" },
    fallbackMessage: { uz: "Sizga yangi xabar keldi", ru: "У вас новое сообщение", en: "You have a new message" },
    errorTitle: { uz: "Xatolik", ru: "Ошибка", en: "Error" },
    loadError: { uz: "Bildirishnomalarni yuklab bo'lmadi.", ru: "Не удалось загрузить уведомления.", en: "Could not load notifications." },
    updateError: { uz: "Bildirishnoma yangilanmadi.", ru: "Не удалось обновить уведомление.", en: "Could not update notification." },
    headerTitle: { uz: "Bildirishnomalar", ru: "Уведомления", en: "Notifications" },
    enabled: { uz: "Yoqildi", ru: "Включено", en: "Enabled" },
    permissionRequired: { uz: "Ruxsat kerak", ru: "Нужно разрешение", en: "Permission required" },
    pushEnabled: { uz: "Push xabarlari faollashtirildi.", ru: "Push-уведомления включены.", en: "Push notifications enabled." },
    pushSettings: { uz: "Telefon sozlamalaridan ruxsat bering.", ru: "Разрешите уведомления в настройках телефона.", en: "Allow notifications in phone settings." },
    heroTitle: { uz: "SMS va bron xabarlari", ru: "SMS и сообщения о записях", en: "SMS and booking updates" },
    heroSub: { uz: "Har bir yangilanish premium kartalarda, bir qarashda tushunarli.", ru: "Каждое обновление в понятных премиум-карточках.", en: "Every update appears in clean premium cards." },
    total: { uz: "Jami", ru: "Всего", en: "Total" },
    new: { uz: "Yangi", ru: "Новые", en: "New" },
    sms: { uz: "SMS", ru: "SMS", en: "SMS" },
    subtitle: { uz: "Barcha bron yangilanishlari real vaqtda shu yerda ko'rinadi.", ru: "Все обновления записей отображаются здесь в реальном времени.", en: "All booking updates appear here in real time." },
    emptyTitle: { uz: "Hozircha xabar yo'q", ru: "Пока нет уведомлений", en: "No notifications yet" },
    emptyMsg: { uz: "Bron yoki status yangilanishlarida xabar keladi.", ru: "Уведомления появятся при новых записях и изменениях статуса.", en: "You’ll get updates for bookings and status changes." },
    smsSent: { uz: "SMS yuborildi", ru: "SMS отправлено", en: "SMS sent" },
    voice: { uz: "Ovozli", ru: "Голосовое", en: "Voice" },
  } as const), []);

  const tr = useCallback(
    (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz,
    [COPY, language],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getUserNotifications();
      setNotifications(rows);
    } catch (error: unknown) {
      Alert.alert(tr("errorTitle"), error instanceof Error ? error.message : tr("loadError"));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useNotificationsWS(
    session?.user_id,
    session?.access_token ?? null,
    useCallback((payload) => {
      const nextItem = mapWsNotification(payload, {
        title: tr("fallbackTitle"),
        message: tr("fallbackMessage"),
      });
      setNotifications((prev) =>
        prev.some((item) => item.id === nextItem.id) ? prev : [nextItem, ...prev],
      );
    }, [tr]),
    Boolean(session?.user_id && session?.access_token),
  );

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);
  const smsCount = useMemo(() => notifications.filter((item) => item.sms_sent).length, [notifications]);

  const markAsRead = async (id: number) => {
    try {
      setBusyId(id);
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
    } catch (error: unknown) {
      Alert.alert(tr("errorTitle"), error instanceof Error ? error.message : tr("updateError"));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: UserNotificationApi }) => {
    const meta = getTypeMeta(item.type);
    return (
      <Pressable
        style={[styles.bubble, !item.is_read && styles.bubbleUnread, busyId === item.id && styles.rowBusy]}
        disabled={busyId === item.id}
        onPress={() => !item.is_read && void markAsRead(item.id)}
      >
        <View style={[styles.bubbleIcon, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.bubbleBody}>
          <View style={styles.bubbleTopRow}>
            <Text style={styles.bubbleTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.bubbleTime}>{formatTime(item.created_at ?? null, language)}</Text>
          </View>
          <Text style={styles.bubbleMsg}>{item.message}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: meta.bg }]}> 
              <Text style={[styles.metaBadgeText, { color: meta.color }]}>{item.type.replaceAll("_", " ")}</Text>
            </View>
            {item.sms_sent ? (
              <View style={[styles.metaBadge, styles.smsBadge]}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color="#0f766e" />
                <Text style={[styles.metaBadgeText, { color: "#0f766e" }]}>{tr("smsSent")}</Text>
              </View>
            ) : null}
            {item.voice_sent ? (
              <View style={[styles.metaBadge, styles.voiceBadge]}>
                <Ionicons name="volume-high-outline" size={12} color="#7c3aed" />
                <Text style={[styles.metaBadgeText, { color: "#7c3aed" }]}>{tr("voice")}</Text>
              </View>
            ) : null}
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={userDesign.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{tr("headerTitle")}</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.permBtn}
          onPress={async () => {
            const granted = await requestNotificationPermission();
            Alert.alert(
              granted ? tr("enabled") : tr("permissionRequired"),
              granted ? tr("pushEnabled") : tr("pushSettings"),
            );
          }}
        >
          <Ionicons name="settings-outline" size={20} color={userDesign.textMuted} />
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>LIVE INBOX</Text>
            <Text style={styles.heroTitle}>{tr("heroTitle")}</Text>
            <Text style={styles.heroSub}>{tr("heroSub")}</Text>
          </View>
          <View style={styles.heroBell}>
            <Ionicons name="notifications" size={22} color={userDesign.accent} />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNum}>{notifications.length}</Text>
            <Text style={styles.heroStatLabel}>{tr("total")}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNum}>{unreadCount}</Text>
            <Text style={styles.heroStatLabel}>{tr("new")}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatNum}>{smsCount}</Text>
            <Text style={styles.heroStatLabel}>{tr("sms")}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>{tr("subtitle")}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={userDesign.accent} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={40} color={userDesign.accent} />
          </View>
          <Text style={styles.emptyTitle}>{tr("emptyTitle")}</Text>
          <Text style={styles.emptyMsg}>{tr("emptyMsg")}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: userDesign.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: userDesign.card,
    borderBottomWidth: 1,
    borderBottomColor: userDesign.line,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: userDesign.cardSoft, alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: userDesign.line,
  },
  headerCenter: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: userDesign.text },
  headerBadge: {
    backgroundColor: userDesign.accent, borderRadius: 999,
    minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  headerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  permBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: userDesign.cardSoft, alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: userDesign.line,
  },
  subtitle: {
    fontSize: 12, color: userDesign.textMuted, fontWeight: "500",
    marginHorizontal: 16, marginTop: 10, marginBottom: 10,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: userDesign.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: userDesign.line,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 12px rgba(17, 17, 17, 0.08)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -50,
    backgroundColor: "rgba(255,122,26,0.08)",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  heroEyebrow: { fontSize: 10, fontWeight: "700", color: userDesign.accent, letterSpacing: 1.2 },
  heroTitle: { fontSize: 18, fontWeight: "900", color: userDesign.text, marginTop: 4 },
  heroSub: { fontSize: 12, lineHeight: 18, fontWeight: "500", color: userDesign.textMuted, marginTop: 4, maxWidth: "88%" },
  heroBell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,122,26,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.22)",
  },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  heroStatCard: {
    flex: 1,
    backgroundColor: userDesign.cardSoft,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: userDesign.line,
  },
  heroStatNum: { fontSize: 16, fontWeight: "900", color: userDesign.text },
  heroStatLabel: { fontSize: 10, fontWeight: "800", color: userDesign.textMuted, marginTop: 2 },
  bubble: {
    flexDirection: "row", gap: 10, backgroundColor: userDesign.card,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(17, 17, 17, 0.08)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }),
  },
  rowBusy: {
    opacity: 0.7,
  },
  bubbleUnread: {
    borderColor: "rgba(255,122,26,0.45)", borderWidth: 1, backgroundColor: "rgba(255,122,26,0.05)",
  },
  bubbleIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubbleBody: { flex: 1 },
  bubbleTopRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8,
  },
  bubbleTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: userDesign.text },
  bubbleTime: { fontSize: 10, color: userDesign.textMuted, fontWeight: "500", flexShrink: 0 },
  bubbleMsg: { marginTop: 4, fontSize: 12, color: userDesign.textMuted, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  smsBadge: { backgroundColor: "#ccfbf1" },
  voiceBadge: { backgroundColor: "#ede9fe" },
  unreadDot: {
    position: "absolute", top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: userDesign.accent, borderWidth: 2, borderColor: userDesign.card,
  },
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: "rgba(255,122,26,0.10)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,122,26,0.22)",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: userDesign.text },
  emptyMsg: { fontSize: 12, color: userDesign.textMuted, textAlign: "center", lineHeight: 18 },
});
