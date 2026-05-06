import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getUserAppointments,
  getAppSupportConfig,
  getUserNotifications,
  getUserProfile,
  type AppSupportConfigApi,
  type UserAppointmentApi,
  type UserNotificationApi,
} from "@/services/api";
import { useNotificationsWS, type WsNotificationPayload } from "@/hooks/useNotificationsWS";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { requestNotificationPermission } from "@/services/NotificationService";
import { userDesign } from "@/constants/user-design";
import { LANGUAGE_LABELS } from "@/lib/userPreferences";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";

type LanguageCode = "uz" | "ru" | "en";

const STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  accepted: "Tasdiqlangan",
  completed: "Bajarildi",
  cancelled: "Bekor qilindi",
};

const STATUS_LABELS_I18N: Record<LanguageCode, Record<string, string>> = {
  uz: { pending: "Kutilmoqda", accepted: "Tasdiqlangan", completed: "Bajarildi", cancelled: "Bekor qilindi" },
  ru: { pending: "Ожидает", accepted: "Подтверждено", completed: "Завершено", cancelled: "Отменено" },
  en: { pending: "Pending", accepted: "Accepted", completed: "Completed", cancelled: "Cancelled" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  accepted: userDesign.accent,
  completed: "#10b981",
  cancelled: "#ef4444",
};

const COPY: Record<string, Record<LanguageCode, string>> = {
  logoutTitle: { uz: "Chiqish", ru: "Выход", en: "Log out" },
  logoutBody: { uz: "Hisobdan chiqmoqchimisiz?", ru: "Выйти из аккаунта?", en: "Do you want to sign out?" },
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  confirmLogout: { uz: "Ha, chiqish", ru: "Да, выйти", en: "Yes, sign out" },
  userFallback: { uz: "Foydalanuvchi", ru: "Пользователь", en: "User" },
  profileHint: { uz: "+998 bilan profilingizni to'ldiring", ru: "Заполните профиль с +998", en: "Complete profile with +998" },
  newCount: { uz: "yangi", ru: "новых", en: "new" },
  editProfile: { uz: "Profilni tahrirlash", ru: "Редактировать профиль", en: "Edit profile" },
  messages: { uz: "Xabarlar", ru: "Сообщения", en: "Messages" },
  statActive: { uz: "Faol bron", ru: "Активные", en: "Active" },
  statDone: { uz: "Bajarilgan", ru: "Завершено", en: "Completed" },
  statTotal: { uz: "Jami", ru: "Всего", en: "Total" },
  updatingProfile: { uz: "Profil ma'lumotlari yangilanmoqda...", ru: "Профиль обновляется...", en: "Updating profile..." },
  settings: { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
  refresh: { uz: "Yangilash", ru: "Обновить", en: "Refresh" },
  personalInfo: { uz: "Shaxsiy ma'lumotlar", ru: "Личные данные", en: "Personal info" },
  personalInfoSub: { uz: "Ism, telefon, email va avatar", ru: "Имя, телефон, email и аватар", en: "Name, phone, email and avatar" },
  security: { uz: "Parol va xavfsizlik", ru: "Пароль и безопасность", en: "Password & security" },
  securitySub: { uz: "Parolni yangilang va hisobni himoya qiling", ru: "Обновите пароль и защитите аккаунт", en: "Update password and secure account" },
  notifications: { uz: "Bildirishnomalar", ru: "Уведомления", en: "Notifications" },
  notificationsSubDefault: { uz: "Push xabarlarini ulash", ru: "Подключить push-уведомления", en: "Enable push notifications" },
  notificationsEnabledTitle: { uz: "Yoqildi", ru: "Включено", en: "Enabled" },
  notificationsEnabledMsg: { uz: "Telefon bildirishnomalari faollashtirildi.", ru: "Уведомления телефона включены.", en: "Phone notifications enabled." },
  notificationsDeniedTitle: { uz: "Ruxsat kerak", ru: "Нужно разрешение", en: "Permission required" },
  notificationsDeniedMsg: { uz: "Telefon sozlamalaridan bildirishnoma ruxsatini yoqing.", ru: "Включите разрешение уведомлений в настройках телефона.", en: "Enable notifications permission in phone settings." },
  notifCountSub: { uz: "ta yangi xabar mavjud", ru: "новых сообщений", en: "new messages" },
  support: { uz: "Aloqa va support", ru: "Связь и поддержка", en: "Support" },
  supportSub: { uz: "Call center, Telegram va email yordam", ru: "Call center, Telegram и email", en: "Call center, Telegram and email" },
  mode: { uz: "Rejim", ru: "Режим", en: "Mode" },
  modeSub: { uz: "Tungi/kunduzgi va yorug'lik sozlamalari", ru: "Тема и ручная яркость", en: "Theme and manual brightness" },
  language: { uz: "Til o'zgartirish", ru: "Смена языка", en: "Language" },
  quickSupport: { uz: "Tez aloqa", ru: "Быстрая связь", en: "Quick support" },
  call: { uz: "Qo'ng'iroq", ru: "Звонок", en: "Call" },
  telegram: { uz: "Telegram", ru: "Telegram", en: "Telegram" },
  emailShort: { uz: "Email", ru: "Email", en: "Email" },
  lastBookings: { uz: "Oxirgi bronlar", ru: "Последние записи", en: "Recent bookings" },
  all: { uz: "Hammasi", ru: "Все", en: "All" },
  noBookings: { uz: "Bronlar hali yo'q", ru: "Записей пока нет", en: "No bookings yet" },
  noBookingsSub: { uz: "Yaqin ustani tanlang va bir necha bosishda navbat oling.", ru: "Выберите барбера рядом и забронируйте быстро.", en: "Pick a nearby barber and book quickly." },
  bookNow: { uz: "Yangi bron qilish", ru: "Создать запись", en: "Book now" },
  barber: { uz: "Sartarosh", ru: "Барбер", en: "Barber" },
  service: { uz: "Xizmat", ru: "Услуга", en: "Service" },
  latestNotifications: { uz: "So'nggi bildirishnomalar", ru: "Последние уведомления", en: "Latest notifications" },
  noMessages: { uz: "Hozircha xabar yo'q", ru: "Пока нет уведомлений", en: "No notifications yet" },
  noMessagesSub: { uz: "Yangi bron yoki status yangilanishlari shu yerda ko'rinadi.", ru: "Новые записи и статусы появятся здесь.", en: "New booking/status updates appear here." },
  read: { uz: "O'qilgan", ru: "Прочитано", en: "Read" },
  newBadge: { uz: "Yangi", ru: "Новый", en: "New" },
  signOut: { uz: "Hisobdan chiqish", ru: "Выйти", en: "Sign out" },
  logoutSub: {
    uz: "Hisobdan xavfsiz chiqish",
    ru: "Безопасный выход из аккаунта",
    en: "Securely sign out",
  },
};

const FALLBACK_SUPPORT_CONFIG: AppSupportConfigApi = {
  call_center_phone: "+998 90 777 77 77",
  telegram_username: "@sharpcuts_support",
  telegram_url: "https://t.me/sharpcuts_support",
  email: "support@sharpcuts.uz",
  work_hours: "Dushanba - Yakshanba: 09:00 - 22:00",
  extra_hint: "Telegram va email orqali 24/7 xabar qoldirishingiz mumkin.",
  updated_at: null,
};

function formatMoneyCompact(value: number, language: LanguageCode): string {
  if (!value) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1000)}K`;
  }
  return Math.round(value).toString();
}

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

function mapWsNotification(payload: WsNotificationPayload): UserNotificationApi {
  return {
    id: payload.id,
    type: payload.type || "booking_update",
    title: payload.title || "Yangi bildirishnoma",
    message: payload.message || "Sizga yangi xabar keldi",
    barber_id: payload.barber_id ?? null,
    appointment_id: payload.appointment_id ?? null,
    sms_sent: Boolean(payload.sms_sent),
    voice_sent: Boolean(payload.voice_sent),
    is_read: Boolean(payload.is_read),
    created_at: payload.created_at ?? null,
  };
}

export default function ProfileHubScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { language } = useLanguage();
  const swipeTabs = useTabSwipeNavigation("profile");
  const [appointments, setAppointments] = useState<UserAppointmentApi[]>([]);
  const [notifications, setNotifications] = useState<UserNotificationApi[]>([]);
  const [profileName, setProfileName] = useState(session?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(session?.email ?? "");
  const [profilePhone, setProfilePhone] = useState(session?.phone ?? "");
  const [profileAvatar, setProfileAvatar] = useState(session?.avatar ?? "");
  const [supportConfig, setSupportConfig] = useState<AppSupportConfigApi>(FALLBACK_SUPPORT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!session?.user_id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [appointmentRows, profile, notificationRows, supportRow] = await Promise.all([
        getUserAppointments(session.user_id),
        getUserProfile(session.user_id),
        getUserNotifications().catch(() => []),
        getAppSupportConfig().catch(() => FALLBACK_SUPPORT_CONFIG),
      ]);

      setAppointments(appointmentRows);
      setNotifications(notificationRows);
      setSupportConfig({ ...FALLBACK_SUPPORT_CONFIG, ...supportRow });
      setProfileName(profile.name || session.name || "");
      setProfileEmail(profile.email || session.email || "");
      setProfilePhone(profile.phone || session.phone || "");
      setProfileAvatar(profile.avatar || session.avatar || "");
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Profilni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useNotificationsWS(
    session?.user_id,
    session?.access_token ?? null,
    useCallback((payload) => {
      const nextNotification = mapWsNotification(payload);
      setNotifications((prev) => (prev.some((item) => item.id === nextNotification.id) ? prev : [nextNotification, ...prev]));
      if (payload.appointment_id) {
        void loadDashboard();
      }
    }, [loadDashboard]),
    Boolean(session?.user_id && session?.access_token),
  );

  useRealtimeChannel(
    "bookings",
    session?.access_token ?? null,
    useCallback((event) => {
      if (event === "app.support.updated") {
        void getAppSupportConfig()
          .then((row) => setSupportConfig({ ...FALLBACK_SUPPORT_CONFIG, ...row }))
          .catch(() => undefined);
      }
    }, []),
    Boolean(session?.access_token),
  );

  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);
  const activeAppointments = useMemo(
    () => appointments.filter((item) => item.status === "pending" || item.status === "accepted").length,
    [appointments],
  );
  const completedAppointments = useMemo(
    () => appointments.filter((item) => item.status === "completed").length,
    [appointments],
  );
  const totalSpent = useMemo(
    () => appointments.reduce((sum, item) => sum + (item.service_price ?? 0), 0),
    [appointments],
  );
  const tr = useMemo(() => (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz, [language]);
  const statusLabel = useCallback(
    (status: string) => STATUS_LABELS_I18N[language]?.[status] ?? STATUS_LABELS[status] ?? status,
    [language],
  );

  const performLogout = useCallback(async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await signOut();
    } finally {
      setIsLoggingOut(false);
      router.replace("/(auth)/login");
    }
  }, [isLoggingOut, signOut]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      void performLogout();
      return;
    }

    Alert.alert(tr("logoutTitle"), tr("logoutBody"), [
      { text: tr("cancel"), style: "cancel" },
      {
        text: tr("confirmLogout"),
        style: "destructive",
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const openLink = useCallback(async (target: string) => {
    const canOpen = await Linking.canOpenURL(target);
    if (!canOpen) {
      return;
    }
    await Linking.openURL(target);
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    Alert.alert(
      granted ? tr("notificationsEnabledTitle") : tr("notificationsDeniedTitle"),
      granted ? tr("notificationsEnabledMsg") : tr("notificationsDeniedMsg"),
    );
    router.push("/user/notifications");
  }, [tr]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} {...swipeTabs.panHandlers}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              {profileAvatar ? (
                <Image source={{ uri: profileAvatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{getInitials(profileName || session?.name || "U")}</Text>
                </View>
              )}
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroBadge}>Barber Club</Text>
              <Text style={styles.heroTitle}>{profileName || tr("userFallback")}</Text>
              <Text style={styles.heroSubtitle}>{profileEmail || profilePhone || tr("profileHint")}</Text>
              <View style={styles.inlineMetaRow}>
                <View style={styles.metaPill}>
                  <Ionicons name="notifications-outline" size={14} color={userDesign.accent} />
                  <Text style={styles.metaPillText}>{unreadNotifications} {tr("newCount")}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Ionicons name="language-outline" size={14} color={userDesign.accent} />
                  <Text style={styles.metaPillText}>{LANGUAGE_LABELS[language]}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroActionPrimary} onPress={() => router.push("/user/personal-info")} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color="#eff6ff" />
              <Text style={styles.heroActionPrimaryText}>{tr("editProfile")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroActionSecondary} onPress={() => router.push("/user/notifications")} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={18} color="#fff" />
              <Text style={styles.heroActionSecondaryText}>{tr("messages")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label={tr("statActive")} value={String(activeAppointments)} icon="flash-outline" />
          <StatCard label={tr("statDone")} value={String(completedAppointments)} icon="checkmark-done-outline" />
          <StatCard label={tr("statTotal")} value={formatMoneyCompact(totalSpent, language)} icon="wallet-outline" />
        </View>

        {loading ? (
          <View style={styles.sectionCard}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={userDesign.accent} />
              <Text style={styles.loadingCardText}>{tr("updatingProfile")}</Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.sectionCard}>
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={22} color="#ea580c" />
              <Text style={styles.errorCardText}>{error}</Text>
            </View>
          </View>
        ) : null}

        <SectionHeader title={tr("settings")} actionLabel={tr("refresh")} onPress={() => void loadDashboard()} />
        <View style={styles.sectionCard}>
          <MenuRow
            icon="person-circle-outline"
            title={tr("personalInfo")}
            subtitle={tr("personalInfoSub")}
            onPress={() => router.push("/user/personal-info")}
          />
          <MenuRow
            icon="shield-checkmark-outline"
            title={tr("security")}
            subtitle={tr("securitySub")}
            onPress={() => router.push("/user/security")}
          />
          <MenuRow
            icon="notifications-outline"
            title={tr("notifications")}
            subtitle={unreadNotifications > 0 ? `${unreadNotifications} ${tr("notifCountSub")}` : tr("notificationsSubDefault")}
            onPress={() => {
              void handleEnableNotifications();
            }}
          />
          <MenuRow
            icon="headset-outline"
            title={tr("support")}
            subtitle={`${supportConfig.call_center_phone} · ${supportConfig.telegram_username}`}
            onPress={() => router.push("/user/support")}
          />
          <MenuRow
            icon="contrast-outline"
            title={tr("mode")}
            subtitle={tr("modeSub")}
            onPress={() => router.push("/user/display-mode")}
          />
          <MenuRow
            icon="language-outline"
            title={tr("language")}
            subtitle={LANGUAGE_LABELS[language]}
            onPress={() => router.push("/user/language")}
          />
          <MenuRow
            icon={isLoggingOut ? "hourglass-outline" : "log-out-outline"}
            title={tr("signOut")}
            subtitle={tr("logoutSub")}
            onPress={handleLogout}
            isLast
            danger
          />
        </View>

        <SectionHeader title={tr("quickSupport")} actionLabel={tr("all")} onPress={() => router.push("/user/support")} />
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.notificationPreview} onPress={() => void openLink(`tel:${supportConfig.call_center_phone.replace(/[^\d+]/g, "")}`)} activeOpacity={0.7}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="call-outline" size={18} color={userDesign.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notificationTopRow}>
                <Text style={styles.notificationTitle}>{tr("call")}</Text>
              </View>
              <Text style={styles.notificationMessage}>{supportConfig.call_center_phone}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationPreview} onPress={() => void openLink(supportConfig.telegram_url)} activeOpacity={0.7}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="chatbubbles-outline" size={18} color={userDesign.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notificationTopRow}>
                <Text style={styles.notificationTitle}>{tr("telegram")}</Text>
              </View>
              <Text style={styles.notificationMessage}>{supportConfig.telegram_username}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.notificationPreview, styles.menuRowLast]} onPress={() => void openLink(`mailto:${supportConfig.email}`)} activeOpacity={0.7}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="mail-outline" size={18} color={userDesign.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notificationTopRow}>
                <Text style={styles.notificationTitle}>{tr("emailShort")}</Text>
              </View>
              <Text style={styles.notificationMessage}>{supportConfig.email}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <SectionHeader title={tr("lastBookings")} actionLabel={tr("all")} onPress={() => router.push("/user/mybookings")} />
        <View style={styles.appointmentsWrap}>
          {appointments.length === 0 ? (
            <View style={styles.appointmentCard}>
              <EmptyState
                icon="calendar-clear-outline"
                title={tr("noBookings")}
                subtitle={tr("noBookingsSub")}
              />
              <TouchableOpacity style={styles.bookButton} onPress={() => router.push("/user/home")} activeOpacity={0.7}>
                <Text style={styles.bookButtonText}>{tr("bookNow")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            appointments.slice(0, 2).map((item) => (
              <View key={item.id} style={styles.appointmentCard}>
                <View style={styles.appointmentTopRow}>
                  <View style={styles.notificationIconWrap}>
                    <Ionicons name="cut-outline" size={18} color={userDesign.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appointmentName}>{item.barber_name || tr("barber")}</Text>
                    <Text style={styles.appointmentSub}>{item.service_name || item.barber_specialty || tr("service")}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[item.status] ?? "#64748b"}18` }]}>
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[item.status] ?? "#64748b" }]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.appointmentMetaRow}>
                  <View style={styles.appointmentMetaItem}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.appointmentMetaText}>{item.appointment_date}</Text>
                  </View>
                  <View style={styles.appointmentMetaItem}>
                    <Ionicons name="time-outline" size={14} color="#64748b" />
                    <Text style={styles.appointmentMetaText}>{toUz24h(item.appointment_time)}</Text>
                  </View>
                </View>

                {item.service_price != null ? (
                  <Text style={styles.priceText}>{Math.round(item.service_price).toLocaleString("uz-UZ")} so&apos;m</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <SectionHeader title={tr("latestNotifications")} actionLabel={tr("all")} onPress={() => router.push("/user/notifications")} />
        <View style={styles.sectionCard}>
          {notifications.length === 0 ? (
            <EmptyState
              icon="notifications-off-outline"
              title={tr("noMessages")}
              subtitle={tr("noMessagesSub")}
            />
          ) : (
            notifications.slice(0, 3).map((item) => (
              <TouchableOpacity key={item.id} style={[styles.notificationPreview, !item.is_read && styles.notificationPreviewUnread]} onPress={() => router.push("/user/notifications")} activeOpacity={0.7}>
                <View style={styles.notificationIconWrap}>
                  <Ionicons name="sparkles-outline" size={18} color={userDesign.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notificationTopRow}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={[styles.notificationBadge, item.is_read ? styles.notificationBadgeMuted : styles.notificationBadgeActive]}>
                      {item.is_read ? tr("read") : tr("newBadge")}
                    </Text>
                  </View>
                  <Text style={styles.notificationMessage}>{item.message}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color={userDesign.accent} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, actionLabel, onPress }: { title: string; actionLabel: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MenuRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.menuRow, props.isLast && styles.menuRowLast]} onPress={props.onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, props.danger && styles.menuIconWrapDanger]}>
        <Ionicons name={props.icon} size={20} color={props.danger ? "#fca5a5" : "#93c5fd"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, props.danger && styles.menuTitleDanger]}>{props.title}</Text>
        <Text style={styles.menuSubtitle}>{props.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={props.danger ? "#fca5a5" : "#64748b"} />
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={24} color={userDesign.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: userDesign.page,
  },
  heroCard: {
    backgroundColor: userDesign.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: userDesign.radius.lg,
    padding: 20,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  avatarWrap: {
    alignSelf: "flex-start",
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  avatarText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },
  heroCopy: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: userDesign.accentSoft,
    color: userDesign.accentStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  heroTitle: {
    color: userDesign.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  heroSubtitle: {
    color: userDesign.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    letterSpacing: -0.1,
  },
  inlineMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: userDesign.cardSoft,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    color: userDesign.text,
    fontWeight: "600",
    fontSize: 12,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  heroActionPrimary: {
    flex: 1,
    backgroundColor: userDesign.accent,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    borderRadius: userDesign.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  heroActionPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: -0.1,
  },
  heroActionSecondary: {
    width: 132,
    backgroundColor: userDesign.cardSoft,
    borderRadius: userDesign.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  heroActionSecondaryText: {
    color: userDesign.text,
    fontWeight: "700",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: userDesign.card,
    borderRadius: userDesign.radius.lg,
    padding: 16,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    color: userDesign.text,
    fontSize: 18,
    fontWeight: "900",
    includeFontPadding: false,
  },
  statLabel: {
    color: userDesign.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "700",
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  loadingCardText: {
    color: userDesign.text,
    fontWeight: "700",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff7ed",
  },
  errorCardText: {
    flex: 1,
    color: "#9a3412",
    fontWeight: "700",
    lineHeight: 20,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: userDesign.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionAction: {
    color: userDesign.accentStrong,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: userDesign.card,
    borderColor: userDesign.line,
    marginHorizontal: 16,
    borderRadius: userDesign.radius.lg,
    borderWidth: 0.5,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: userDesign.line,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 18,
    backgroundColor: userDesign.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  menuIconWrapDanger: {
    backgroundColor: "#FEF2F2",
  },
  menuTitle: {
    color: userDesign.text,
    fontSize: 15,
    fontWeight: "700",
  },
  menuTitleDanger: {
    color: "#ef4444",
  },
  menuSubtitle: {
    color: userDesign.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 1,
  },
  notificationPreview: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: userDesign.line,
  },
  notificationPreviewUnread: {
    backgroundColor: "#F8FAFC",
  },
  notificationIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 18,
    backgroundColor: userDesign.cardSoft,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notificationTopRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationTitle: {
    flex: 1,
    color: userDesign.text,
    fontWeight: "800",
    fontSize: 13,
  },
  notificationBadge: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  notificationBadgeActive: {
    color: userDesign.accent,
  },
  notificationBadgeMuted: {
    color: userDesign.textMuted,
  },
  notificationMessage: {
    color: userDesign.textMuted,
    lineHeight: 18,
    marginTop: 4,
    fontSize: 12,
  },
  appointmentsWrap: {
    paddingHorizontal: 14,
    gap: 10,
  },
  appointmentCard: {
    backgroundColor: userDesign.card,
    borderColor: userDesign.line,
    borderRadius: userDesign.radius.lg,
    padding: 16,
    borderWidth: 0.5,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  appointmentTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  appointmentName: {
    color: userDesign.text,
    fontSize: 15,
    fontWeight: "900",
  },
  appointmentSub: {
    color: userDesign.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  appointmentMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  appointmentMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  appointmentMetaText: {
    color: userDesign.textMuted,
    fontSize: 12,
  },
  priceText: {
    color: userDesign.accent,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 10,
  },
  ratingBox: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
  },
  ratingLabel: {
    color: userDesign.text,
    fontWeight: "800",
    marginBottom: 10,
  },
  starRow: {
    flexDirection: "row",
    gap: 6,
  },
  rateButton: {
    alignSelf: "flex-start",
    backgroundColor: userDesign.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  rateButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: userDesign.cardSoft,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: userDesign.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: userDesign.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    letterSpacing: -0.1,
  },
  bookButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: userDesign.accent,
    borderRadius: userDesign.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  bookButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.7,
  },
});
