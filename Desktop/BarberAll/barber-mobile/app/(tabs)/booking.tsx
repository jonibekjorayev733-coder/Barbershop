import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  getBarberAvailability,
  createBooking,
  BarberAvailabilityApi,
  UserBookingConfirmationApi,
  getBarbers,
  UserBookingBarberApi,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { panelTheme } from "@/constants/panel-theme";
import { showLocalNotification } from "@/services/NotificationService";

type Step = "datetime" | "details" | "success";

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function getDates(count = 14) {
  const dates = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", { weekday: "short", month: "short", day: "numeric" });
}

export default function BookingScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barberId: string; barberName: string }>();
  const barberId = Number(params.barberId);
  const barberName = params.barberName ?? "Sartarosh";

  const [step, setStep] = useState<Step>("datetime");
  const [dates] = useState(getDates());
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [availability, setAvailability] = useState<BarberAvailabilityApi | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState(session?.name ?? "");
  const [clientPhone, setClientPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState<UserBookingConfirmationApi | null>(null);
  const [specialists, setSpecialists] = useState<UserBookingBarberApi[]>([]);

  const fetchSlots = useCallback(async (date: string) => {
    if (!barberId) return;
    setLoadingSlots(true);
    setSelectedTime("");
    try {
      const data = await getBarberAvailability(barberId, date);
      setAvailability(data);
    } catch {
      setAvailability(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [barberId]);

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await getBarbers();
        setSpecialists(rows.slice(0, 8));
      } catch {
        setSpecialists([]);
      }
    })();
  }, []);

  const handleBook = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      Alert.alert("Xatolik", "Ism va telefon raqamni kiriting");
      return;
    }
    setBooking(true);
    try {
      const conf = await createBooking({
        barber_id: barberId,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        user_id: session?.user_id,
      });
      setConfirmation(conf);
      await showLocalNotification(
        "✅ Bron qabul qilindi",
        `${barberName} uchun ${selectedDate} ${selectedTime} vaqtga bron yaratildi`,
        "booking_created",
      );
      setStep("success");
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Bron qilishda xatolik");
    } finally {
      setBooking(false);
    }
  };

  if (!barberId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Sartarosh tanlanmagan</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Orqaga</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ──
  if (step === "success" && confirmation) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={[styles.successContainer, { paddingBottom: 96 + insets.bottom }]}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Bron tasdiqlandi!</Text>
          <Text style={styles.successSub}>Sizning broningiz muvaffaqiyatli yaratildi</Text>

          <View style={styles.confirmCard}>
            <Row label="Sartarosh" value={confirmation.barber_name} />
            <Row label="Sana" value={confirmation.appointment_date} />
            <Row label="Vaqt" value={confirmation.appointment_time} />
            <Row label="Mijoz" value={confirmation.client_name} />
            <Row label="Telefon" value={confirmation.client_phone} />
            {confirmation.service_price != null && (
              <Row
                label="Narx"
                value={`${Math.round(confirmation.service_price).toLocaleString("uz-UZ")} so'm`}
              />
            )}
            <Row label="Holat" value="⏳ Kutilmoqda" />
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace("/user/home")}
          >
            <Text style={styles.doneBtnText}>Bosh sahifaga</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Details ──
  if (step === "details") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setStep("datetime")}>
            <Text style={styles.backArrow}>← Orqaga</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Ma'lumotlar</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.padded, { paddingBottom: 96 + insets.bottom }]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📋 Bron xulosasi</Text>
            <Row label="Sartarosh" value={barberName} />
            <Row label="Sana" value={selectedDate} />
            <Row label="Vaqt" value={selectedTime} />
          </View>

          <Text style={styles.sectionTitle}>Sizning ma'lumotlaringiz</Text>

          <Text style={styles.label}>Ism *</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Ismingizni kiriting"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Telefon raqam *</Text>
          <TextInput
            style={styles.input}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="+998 90 123 45 67"
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={[styles.nextBtn, booking && styles.btnDisabled]}
            onPress={handleBook}
            disabled={booking}
          >
            {booking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>✅ Bronni tasdiqlash</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── DateTime ──
  const availableSlots = availability?.slots.filter((s) => s.status === "available") ?? [];
  const bookingSteps = ["Booking", "Personal Info", "Checkout", "Confirm"];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>← Orqaga</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{barberName}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 108 + insets.bottom }}>
        <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginTop: 16 }]}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
          {dates.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dateChip, selectedDate === d && styles.dateChipActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.dateChipText, selectedDate === d && styles.dateChipTextActive]}>
                {formatDate(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.stepperWrap}>
          {bookingSteps.map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, index === 0 && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, index === 0 && styles.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>Select Experts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expertsRow}>
          {specialists.map((item) => {
            const active = item.id === barberId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.expertChip, active && styles.expertChipActive]}
                onPress={() =>
                  router.replace({
                    pathname: "/user/booking",
                    params: { barberId: String(item.id), barberName: item.name },
                  })
                }
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.expertAvatar} />
                ) : (
                  <View style={styles.expertFallback}><Text style={styles.expertFallbackText}>{item.name[0]?.toUpperCase() ?? "S"}</Text></View>
                )}
                <Text numberOfLines={1} style={[styles.expertName, active && styles.expertNameActive]}>{item.name}</Text>
                <Text style={[styles.expertExp, active && styles.expertExpActive]}>{Math.max(1, item.years_experience || 1)} yrs exp</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginTop: 8 }]}>Date & Time</Text>

        {loadingSlots ? (
          <ActivityIndicator color="#1a73e8" style={{ marginTop: 20 }} />
        ) : availableSlots.length === 0 ? (
          <Text style={styles.noSlots}>Bu kunda bo'sh vaqt yo'q</Text>
        ) : (
          <View style={styles.slotsGrid}>
            {availableSlots.map((s) => (
              <TouchableOpacity
                key={s.time}
                style={[styles.slot, selectedTime === s.time && styles.slotActive]}
                onPress={() => setSelectedTime(s.time)}
              >
                <Text style={[styles.slotText, selectedTime === s.time && styles.slotTextActive]}>
                  {s.time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Next button */}
      {selectedTime !== "" && (
        <View style={[styles.bottomBar, { paddingBottom: 14 + insets.bottom }]}> 
          <View>
            <Text style={styles.selectedInfo}>{selectedDate} — {selectedTime}</Text>
            <Text style={styles.selectedSub}>{barberName}</Text>
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep("details")}>
            <Text style={styles.nextBtnText}>Davom →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  label: { color: "#888", fontSize: 14 },
  value: { color: "#1a1a2e", fontSize: 14, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: panelTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: panelTheme.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backArrow: { color: panelTheme.heading, fontSize: 15, fontWeight: "700" },
  topBarTitle: { color: panelTheme.heading, fontSize: 17, fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: panelTheme.heading, marginBottom: 10 },
  datePicker: { paddingLeft: 16, marginBottom: 8 },
  dateChip: {
    backgroundColor: panelTheme.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: panelTheme.border,
  },
  dateChipActive: { backgroundColor: panelTheme.dark, borderColor: panelTheme.dark },
  dateChipText: { color: panelTheme.text, fontSize: 13, fontWeight: "700" },
  dateChipTextActive: { color: "#fff" },
  stepperWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 16, marginTop: 2 },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#d1d5db", marginBottom: 6 },
  stepDotActive: { backgroundColor: "#111827" },
  stepLabel: { fontSize: 11, color: "#9ca3af", textAlign: "center" },
  stepLabelActive: { color: "#111827", fontWeight: "700" },
  expertsRow: { gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  expertChip: { width: 90, borderRadius: 18, backgroundColor: "#ffffff", padding: 8, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  expertChipActive: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  expertAvatar: { width: 44, height: 44, borderRadius: 14 },
  expertFallback: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827" },
  expertFallbackText: { color: "#fff", fontWeight: "800" },
  expertName: { marginTop: 6, color: "#111827", fontWeight: "700", fontSize: 12 },
  expertNameActive: { color: "#fff" },
  expertExp: { color: "#6b7280", fontSize: 10, marginTop: 2 },
  expertExpActive: { color: "#ffedd5" },
  noSlots: { textAlign: "center", color: panelTheme.muted, marginTop: 20, fontSize: 14 },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  slot: {
    backgroundColor: panelTheme.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: panelTheme.border,
    minWidth: "28%",
    alignItems: "center",
  },
  slotActive: { backgroundColor: panelTheme.dark, borderColor: panelTheme.dark },
  slotText: { color: panelTheme.heading, fontSize: 14, fontWeight: "700" },
  slotTextActive: { color: "#fff" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: panelTheme.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: panelTheme.border,
  },
  selectedInfo: { fontWeight: "800", fontSize: 14, color: panelTheme.heading },
  selectedSub: { fontSize: 12, color: panelTheme.muted, marginTop: 2 },
  padded: { padding: 16 },
  summaryCard: {
    backgroundColor: panelTheme.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: panelTheme.border,
  },
  summaryTitle: { fontWeight: "800", fontSize: 15, marginBottom: 10, color: panelTheme.heading },
  label: { fontSize: 14, fontWeight: "700", color: panelTheme.heading, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: panelTheme.surface,
    borderWidth: 1,
    borderColor: panelTheme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: panelTheme.heading,
  },
  nextBtn: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  successContainer: { padding: 24, alignItems: "center" },
  successEmoji: { fontSize: 72, marginTop: 40 },
  successTitle: { fontSize: 24, fontWeight: "800", color: panelTheme.heading, marginTop: 16 },
  successSub: { fontSize: 14, color: panelTheme.muted, marginTop: 8, marginBottom: 28 },
  confirmCard: {
    backgroundColor: panelTheme.surface,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: panelTheme.border,
  },
  doneBtn: {
    backgroundColor: panelTheme.dark,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 15,
    marginTop: 28,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#ea4335", fontSize: 15, marginBottom: 16 },
  backBtn: { backgroundColor: panelTheme.dark, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: "#fff", fontWeight: "700" },
});
