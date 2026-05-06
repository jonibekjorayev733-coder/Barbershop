import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  approveBarberAppointment,
  completeBarberAppointment,
  getBarberAppointments,
  rejectBarberAppointment,
  type BarberAppointmentApi,
} from "@/services/api";
import { barberDesign } from "@/constants/barber-design";
import { showLocalNotification } from "@/services/NotificationService";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FILTERS: { label: string; value: "all" | "pending" | "completed" }[] = [
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
    useCallback(() => {
      load();
    }, [load]),
    !!token && !!barberId
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={barberDesign.colors.gold} />
      </View>
    );
  }

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
        <Text style={styles.eyebrow}>ISH JADVALI</Text>
        <Text style={styles.title}>Jadval</Text>
        <Text style={styles.subtitle}>Sizning barcha qabullari</Text>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                status === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setStatus(filter.value)}
              activeOpacity={barberDesign.button.primary.activeOpacity}
            >
              <Text
                style={[
                  styles.filterText,
                  status === filter.value && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Appointments List */}
        {appointments.length > 0 ? (
          appointments.map((item) => (
            <AppointmentCard
              key={item.id}
              appointment={item}
              isBusy={busyId === item.id}
              onApprove={() => runAction(item.id, "approve")}
              onReject={() => runAction(item.id, "reject")}
              onComplete={() => runAction(item.id, "complete")}
            />
          ))
        ) : (
          <View style={[styles.emptyCard, barberDesign.shadows.subtle]}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={barberDesign.colors.muted}
            />
            <Text style={styles.emptyText}>Qabullari topilmadi</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AppointmentCard({
  appointment,
  isBusy,
  onApprove,
  onReject,
  onComplete,
}: {
  appointment: BarberAppointmentApi;
  isBusy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return barberDesign.colors.warning;
      case "accepted":
        return barberDesign.colors.teal;
      case "completed":
        return barberDesign.colors.success;
      case "rejected":
      case "cancelled":
        return barberDesign.colors.danger;
      default:
        return barberDesign.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Kutilmoqda";
      case "accepted":
        return "Jarayonda";
      case "completed":
        return "Yakunlangan";
      case "rejected":
      case "cancelled":
        return "Rad etildi";
      default:
        return status;
    }
  };

  return (
    <LinearGradient
      colors={[barberDesign.card.bg, barberDesign.card.bgAlt]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.appointmentCard, barberDesign.shadows.small]}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.clientInfo}>
          <View style={styles.clientIconBg}>
            <Ionicons
              name="person"
              size={20}
              color={barberDesign.colors.gold}
            />
          </View>
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>{appointment.client_name}</Text>
            <Text style={styles.clientService}>
              {appointment.service_name || "Service"}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(appointment.status)}1a` },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
            {getStatusLabel(appointment.status)}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={barberDesign.colors.tealLight}
          />
          <Text style={styles.detailText}>
            {appointment.appointment_date} {appointment.appointment_time}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons
            name="call-outline"
            size={16}
            color={barberDesign.colors.tealLight}
          />
          <Text style={styles.detailText}>{appointment.client_phone}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {appointment.status === "pending" ? (
          <>
            <ActionButton
              title="Tasdiqlash"
              icon="checkmark-circle-outline"
              color={barberDesign.colors.success}
              disabled={isBusy}
              onPress={onApprove}
            />
            <ActionButton
              title="Rad etish"
              icon="close-circle-outline"
              color={barberDesign.colors.danger}
              disabled={isBusy}
              onPress={onReject}
            />
          </>
        ) : null}
        {appointment.status === "pending" || appointment.status === "accepted" ? (
          <ActionButton
            title="Yakunlash"
            icon="checkmark-done-circle-outline"
            color={barberDesign.colors.success}
            disabled={isBusy}
            onPress={onComplete}
          />
        ) : null}
      </View>
    </LinearGradient>
  );
}

function ActionButton({
  title,
  icon,
  color,
  disabled,
  onPress,
}: {
  title: string;
  icon: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        { backgroundColor: `${color}20`, borderColor: color },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={barberDesign.button.primary.activeOpacity}
    >
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{title}</Text>
    </TouchableOpacity>
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

  filterRow: {
    marginBottom: barberDesign.spacing.lg,
  },
  filterContent: {
    paddingRight: barberDesign.spacing.lg,
    gap: barberDesign.spacing.md,
  },
  filterChip: {
    backgroundColor: barberDesign.colors.surfaceAlt,
    borderRadius: barberDesign.radii.full,
    paddingHorizontal: barberDesign.spacing.lg,
    paddingVertical: barberDesign.spacing.md,
    marginRight: barberDesign.spacing.md,
    borderWidth: 1,
    borderColor: barberDesign.card.borderAlt,
  },
  filterChipActive: {
    backgroundColor: barberDesign.colors.gold,
    borderColor: barberDesign.colors.gold,
  },
  filterText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    fontWeight: "700",
  },
  filterTextActive: {
    color: barberDesign.colors.bg,
    fontWeight: "900",
  },

  appointmentCard: {
    backgroundColor: barberDesign.colors.surface,
    borderRadius: barberDesign.radii.lg,
    padding: barberDesign.spacing.lg,
    marginBottom: barberDesign.spacing.lg,
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: barberDesign.spacing.lg,
  },
  clientInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: barberDesign.spacing.md,
  },
  clientIconBg: {
    width: 44,
    height: 44,
    borderRadius: barberDesign.radii.md,
    backgroundColor: barberDesign.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: barberDesign.card.border,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    ...barberDesign.typography.h3,
    color: barberDesign.colors.text,
  },
  clientService: {
    ...barberDesign.typography.caption,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.xs,
  },
  statusBadge: {
    borderRadius: barberDesign.radii.md,
    paddingHorizontal: barberDesign.spacing.md,
    paddingVertical: barberDesign.spacing.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusText: {
    ...barberDesign.typography.caption,
    fontWeight: "900",
  },

  cardDetails: {
    gap: barberDesign.spacing.md,
    marginBottom: barberDesign.spacing.lg,
    paddingBottom: barberDesign.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: barberDesign.card.borderAlt,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: barberDesign.spacing.md,
  },
  detailText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
  },

  actions: {
    flexDirection: "row",
    gap: barberDesign.spacing.md,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: barberDesign.spacing.sm,
    borderRadius: barberDesign.radii.md,
    paddingHorizontal: barberDesign.spacing.md,
    paddingVertical: barberDesign.spacing.md,
    borderWidth: 1,
  },
  actionBtnText: {
    ...barberDesign.typography.caption,
    fontWeight: "900",
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
    minHeight: 200,
  },
  emptyText: {
    ...barberDesign.typography.body,
    color: barberDesign.colors.textSecondary,
    marginTop: barberDesign.spacing.lg,
    textAlign: "center",
  },
});
