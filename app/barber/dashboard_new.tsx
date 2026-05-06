import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import {
  getBarberDashboard,
  getBarberNotifications,
  type BarberDashboardApi,
  type BarberNotificationApi,
} from "@/services/api";
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

  // Real-time: reload when any booking event arrives for this barber
  useRealtimeChannel(
    barberId ? `barber:${barberId}` : "",
    token,
    useCallback(() => {
      load();
    }, [load]),
    !!token && !!barberId
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={barberDesign.colors.gold} />
      </View>
    );
  }

  const progressPercent = (dashboard?.progress_ratio ?? 0) * 100;
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={barberDesign.colors.gold}
          />
        }
      >
        <Text style={styles.eyebrow}>BARBER PANEL</Text>
        <Text style={styles.title}>Salom, {session?.name}</Text>
        <Text style={styles.subtitle}>Bugungi jadval va samaradorlik holati</Text>

        {/* Quick Action Cards */}
        <View style={styles.quickRow}>
          <QuickCard
            label="Jadval"
            hint="Bugungi qabul"
            icon="calendar-outline"
            onPress={() => router.push("/barber/schedule")}
          />
          <QuickCard
            label="Xabarlar"
            hint={`${unreadCount} ta o'qilmagan`}
            icon="notifications-outline"
            badge={unreadCount > 0 ? unreadCount : undefined}
            onPress={() => router.push("/barber/notifications")}
          />
        </View>

        {/* Hero Card with Progress */}
        <LinearGradient
          colors={[
            barberDesign.colors.surfaceRaised,
            barberDesign.colors.surface,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, barberDesign.shadows.large]}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroLabel}>Bugungi holat</Text>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>
                  {dashboard?.today_done ?? 0}
                </Text>
                <Text style={styles.heroSub}>/{dashboard?.today_total ?? 0}</Text>
              </View>
              <Text style={styles.heroMeta}>
                Yakunlangan / jami bronlar
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons
                name="checkmark-done-circle"
                size={48}
                color={barberDesign.colors.gold}
              />
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[barberDesign.colors.gold, barberDesign.colors.goldLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progressPercent)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <StatCard
            label="Pending"
            value={String(dashboard?.today_pending ?? 0)}
            icon="hourglass-outline"
            color={barberDesign.colors.warning}
          />
          <StatCard
            label="Unread"
            value={String(unreadCount)}
            icon="mail-outline"
            color={barberDesign.colors.info}
          />
        </View>

        {/* Next Appointment Card */}
        <Text style={styles.sectionTitle}>Keyingi mijoz</Text>
        {dashboard?.next_appointment ? (
          <LinearGradient
            colors={[barberDesign.card.bg, barberDesign.card.bgAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.appointmentCard, barberDesign.shadows.medium]}
          >
            <View style={styles.appointmentHeader}>
              <View style={styles.personIconBg}>
                <Ionicons
                  name="person-circle"
                  size={32}
                  color={barberDesign.colors.gold}
                />
              </View>
              <View style={styles.appointmentInfo}>
                <Text style={styles.appointmentName}>
                  {dashboard.next_appointment.client_name}
                </Text>
                <Text style={styles.appointmentService}>
                  {dashboard.next_appointment.service_name || "Service"}
                </Text>
              </View>
            </View>

            <View style={styles.appointmentDetails}>
              <View style={styles.detailItem}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color={barberDesign.colors.tealLight}
                />
                <Text style={styles.detailText}>
                  {dashboard.next_appointment.appointment_date}{" "}
                  {dashboard.next_appointment.appointment_time}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons
                  name="call"
                  size={16}
                  color={barberDesign.colors.tealLight}
                />
                <Text style={styles.detailText}>
                  {dashboard.next_appointment.client_phone}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.emptyCard, barberDesign.shadows.subtle]}>
            <Ionicons
              name="calendar-outline"
              size={40}
              color={barberDesign.colors.muted}
            />
            <Text style={styles.emptyText}>Bugun keyingi mijoz yo'q</Text>
          </View>
        )}

        {/* Recent Notifications */}
        <Text style={styles.sectionTitle}>Oxirgi bildirishnomalar</Text>
        {notifications.length > 0 ? (
          notifications.slice(0, 5).map((item) => (
            <LinearGradient
              key={item.id}
              colors={[barberDesign.card.bg, barberDesign.card.bgAlt]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.notificationCard, barberDesign.shadows.subtle]}
            >
              <View style={styles.notifHeader}>
                <View
                  style={[
                    styles.unreadIndicator,
                    item.read && styles.readIndicator,
                  ]}
                />
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>
                    {item.message}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          ))
        ) : (
          <Text style={styles.emptyText}>Bildirishnomalar yo'q</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickCard({
  label,
  hint,
  icon,
  badge,
  onPress,
}: {
  label: string;
  hint: string;
  icon: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.quickCard}
      activeOpacity={barberDesign.button.primary.activeOpacity}
    >
      <View style={styles.quickCardContent}>
        <View>
          <Text style={styles.quickLabel}>{label}</Text>
          <Text style={styles.quickHint}>{hint}</Text>
        </View>
        <View style={styles.quickIconContainer}>
          <LinearGradient
            colors={[barberDesign.colors.gold, barberDesign.colors.goldLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickIconBg}
          >
            <Ionicons
              name={icon as any}
              size={24}
              color={barberDesign.colors.bg}
            />
          </LinearGradient>
          {badge ? (
            <View style={styles.badgeDot}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <LinearGradient
      colors={[barberDesign.colors.surface, barberDesign.colors.surfaceAlt]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statCard, barberDesign.shadows.small]}
    >
      <View style={styles.statHeader}>
        <Text style={styles.statValue}>{value}</Text>
        <View style={[styles.statIconBg, { backgroundColor: `${color}1a` }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: barberDesign.colors.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: barberDesign.colors.bg,
  },
  content: { padding: barberDesign.spacing.lg },

  eyebrow: {
    ...barberDesign.typography.eyebrow,
    color: barberDesign.colors.textTertiary,
    marginBottom: barberDesign.spacing.xs,
  },
  title: {
    ...barberDesign.typography.h1,
    color: barberDesign.colors.text,
    marginTop: barberDesign.spacing.xs,
  },
  subtitle: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginBottom: barberDesign.spacing.lg,
  },

  quickRow: {
    flexDirection: "row",
    gap: barberDesign.spacing.md,
    marginBottom: barberDesign.spacing.lg,
  },
  quickCard: {
    flex: 1,
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: barberDesign.card.border,
    ...barberDesign.shadows.small,
  },
  quickCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: barberDesign.spacing.md,
  },
  quickLabel: {
    ...barberDesign.typography.h3,
    color: barberDesign.colors.text,
  },
  quickHint: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.xs,
  },
  quickIconContainer: {
    position: "relative",
  },
  quickIconBg: {
    width: 44,
    height: 44,
    borderRadius: barberDesign.radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDot: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: barberDesign.colors.danger,
    borderRadius: barberDesign.radii.full,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: barberDesign.colors.bg,
  },
  badgeText: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.text,
    fontWeight: "900",
  },

  heroCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.xl,
    padding: barberDesign.spacing.xl,
    marginBottom: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: barberDesign.spacing.lg,
  },
  heroLabel: {
    ...barberDesign.typography.eyebrow,
    color: barberDesign.colors.textTertiary,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: barberDesign.spacing.sm,
    marginTop: barberDesign.spacing.md,
  },
  heroValue: {
    ...barberDesign.typography.display,
    color: barberDesign.colors.gold,
  },
  heroSub: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
  },
  heroMeta: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textTertiary,
    marginTop: barberDesign.spacing.md,
  },
  heroIcon: {
    opacity: 0.8,
  },

  progressContainer: {
    gap: barberDesign.spacing.md,
  },
  progressTrack: {
    height: 8,
    backgroundColor: barberDesign.colors.surfaceAlt,
    borderRadius: barberDesign.radii.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: barberDesign.card.borderAlt,
  },
  progressFill: {
    height: "100%",
    borderRadius: barberDesign.radii.full,
  },
  progressPercent: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.gold,
    fontWeight: "900",
    textAlign: "right",
  },

  statsRow: {
    flexDirection: "row",
    gap: barberDesign.spacing.md,
    marginBottom: barberDesign.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: barberDesign.spacing.md,
  },
  statValue: {
    ...barberDesign.typography.h2,
    color: barberDesign.colors.gold,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: barberDesign.radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textSecondary,
  },

  sectionTitle: {
    ...barberDesign.typography.h2,
    color: barberDesign.colors.text,
    marginBottom: barberDesign.spacing.lg,
    marginTop: barberDesign.spacing.xl,
  },

  appointmentCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    marginBottom: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  appointmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: barberDesign.spacing.md,
    marginBottom: barberDesign.spacing.lg,
  },
  personIconBg: {
    width: 52,
    height: 52,
    borderRadius: barberDesign.radii.full,
    backgroundColor: barberDesign.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentName: {
    ...barberDesign.typography.h3,
    color: barberDesign.colors.text,
  },
  appointmentService: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.xs,
  },
  appointmentDetails: {
    gap: barberDesign.spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: barberDesign.spacing.md,
  },
  detailText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
  },

  notificationCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    marginBottom: barberDesign.spacing.md,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: barberDesign.spacing.md,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: barberDesign.radii.full,
    backgroundColor: barberDesign.colors.gold,
    marginTop: barberDesign.spacing.md,
    flexShrink: 0,
  },
  readIndicator: {
    backgroundColor: barberDesign.colors.textTertiary,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.text,
    fontWeight: "700",
  },
  notifMessage: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.xs,
  },

  emptyCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.borderAlt,
    minHeight: 120,
  },
  emptyText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.md,
    textAlign: "center",
  },
});
