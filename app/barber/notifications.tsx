import { useCallback, useEffect, useState } from "react";
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
  getBarberNotifications,
  markBarberNotificationRead,
  type BarberNotificationApi,
} from "@/services/api";
import { barberDesign } from "@/constants/barber-design";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function BarberNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<BarberNotificationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(setToken);
  }, [session?.access_token]);

  const load = useCallback(async () => {
    if (!barberId) {
      return;
    }
    try {
      const rows = await getBarberNotifications(barberId);
      setNotifications(rows);
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

  // Real-time via barber channel events
  useRealtimeChannel(
    barberId ? `barber:${barberId}` : "",
    token,
    useCallback(() => {
      load();
    }, [load]),
    !!token && !!barberId
  );

  const markRead = async (notificationId: number) => {
    try {
      setBusyId(notificationId);
      await markBarberNotificationRead(barberId, notificationId);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={barberDesign.colors.gold} />
      </View>
    );
  }

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.bellIconBg}>
            <Ionicons
              name="notifications-outline"
              size={32}
              color={barberDesign.colors.gold}
            />
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>XABARLAR</Text>
            <Text style={styles.title}>Bildirishnomalar</Text>
            <Text style={styles.subtitle}>
              {unreadCount} ta o’qilmagan xabar
            </Text>
          </View>
        </View>

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <View style={styles.listContainer}>
            {notifications.map((item, index) => (
              <NotificationItem
                key={item.id}
                notification={item}
                isBusy={busyId === item.id}
                onMarkRead={() => markRead(item.id)}
                isLast={index === notifications.length - 1}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, barberDesign.shadows.subtle]}>
            <Ionicons
              name="mail-open-outline"
              size={48}
              color={barberDesign.colors.muted}
            />
            <Text style={styles.emptyText}>Bildirishnomalar yo’q</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationItem({
  notification,
  isBusy,
  onMarkRead,
  isLast,
}: {
  notification: BarberNotificationApi;
  isBusy: boolean;
  onMarkRead: () => void;
  isLast: boolean;
}) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "booking":
        return "calendar-outline";
      case "reminder":
        return "alarm-outline";
      case "payment":
        return "card-outline";
      case "message":
        return "chatbubble-outline";
      default:
        return "notifications-outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "booking":
        return barberDesign.colors.tealLight;
      case "reminder":
        return barberDesign.colors.warning;
      case "payment":
        return barberDesign.colors.success;
      case "message":
        return barberDesign.colors.gold;
      default:
        return barberDesign.colors.info;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins} minut oldin`;
      if (diffHours < 24) return `${diffHours} soat oldin`;
      if (diffDays < 7) return `${diffDays} kun oldin`;
      return date.toLocaleDateString("uz-UZ");
    } catch {
      return dateStr;
    }
  };

  return (
    <LinearGradient
      colors={[
        notification.read
          ? barberDesign.card.bgAlt
          : barberDesign.card.bg,
        notification.read
          ? barberDesign.colors.surfaceAlt
          : barberDesign.card.bgAlt,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.notificationCard,
        barberDesign.shadows.small,
        !isLast && styles.notificationCardBorder,
      ]}
    >
      {/* Icon and Content */}
      <View style={styles.notifContent}>
        <View
          style={[
            styles.typeIconBg,
            { backgroundColor: `${getTypeColor(notification.type)}20` },
          ]}
        >
          <Ionicons
            name={getTypeIcon(notification.type) as any}
            size={20}
            color={getTypeColor(notification.type)}
          />
        </View>

        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            {!notification.read && (
              <View style={styles.unreadDot} />
            )}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={styles.notifTime}>
            {notification.created_at
              ? formatDate(notification.created_at)
              : ""}
          </Text>
        </View>
      </View>

      {/* Action Button */}
      {!notification.read && (
        <TouchableOpacity
          style={[
            styles.markReadBtn,
            isBusy && { opacity: 0.5 },
          ]}
          onPress={onMarkRead}
          disabled={isBusy}
          activeOpacity={barberDesign.button.primary.activeOpacity}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={18}
            color={barberDesign.colors.gold}
          />
        </TouchableOpacity>
      )}
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

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: barberDesign.spacing.lg,
    marginBottom: barberDesign.spacing.xl,
    paddingBottom: barberDesign.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: barberDesign.card.border,
  },
  bellIconBg: {
    position: "relative",
    width: 56,
    height: 56,
    borderRadius: barberDesign.radii.lg,
    backgroundColor: barberDesign.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  headerBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: barberDesign.colors.danger,
    borderRadius: barberDesign.radii.full,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: barberDesign.colors.bg,
  },
  headerBadgeText: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.text,
    fontWeight: "900",
  },
  headerContent: {
    flex: 1,
  },
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
    marginTop: barberDesign.spacing.xs,
  },

  listContainer: {
    gap: barberDesign.spacing.md,
  },
  notificationCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  notificationCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: barberDesign.card.borderAlt,
  },
  notifContent: {
    flex: 1,
    flexDirection: "row",
    gap: barberDesign.spacing.md,
  },
  typeIconBg: {
    width: 44,
    height: 44,
    borderRadius: barberDesign.radii.md,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  textContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: barberDesign.spacing.sm,
    marginBottom: barberDesign.spacing.xs,
  },
  notifTitle: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.text,
    fontWeight: "700",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: barberDesign.radii.full,
    backgroundColor: barberDesign.colors.gold,
    flexShrink: 0,
  },
  notifMessage: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginBottom: barberDesign.spacing.md,
    lineHeight: 20,
  },
  notifTime: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textTertiary,
  },

  markReadBtn: {
    width: 36,
    height: 36,
    borderRadius: barberDesign.radii.md,
    backgroundColor: barberDesign.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: barberDesign.card.border,
    marginLeft: barberDesign.spacing.md,
    flexShrink: 0,
  },

  emptyCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: barberDesign.spacing.xl,
    borderWidth: 1,
    borderColor: barberDesign.card.borderAlt,
    minHeight: 280,
  },
  emptyText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.lg,
    textAlign: "center",
  },
});
