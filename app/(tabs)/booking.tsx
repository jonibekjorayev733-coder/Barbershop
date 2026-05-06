import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
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
  getUserProfile,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { showLocalNotification } from "@/services/NotificationService";
import { formatUzbekPhone, hasOnlyPrefix, isCompleteUzbekPhone, toUzbekPhoneApi, UZBEKISTAN_PHONE_DISPLAY_MAX } from "@/lib/phone";
import { Ionicons } from "@expo/vector-icons";
import { userDesign } from "@/constants/user-design";

// Premium Design Colors with enhanced variants
const accent = userDesign.accent;
const accentDark = "#3a2612";
const accentLight = "#ffd8b6";
const pageBg = userDesign.page;
const cardBg = userDesign.card;
const cardBgAlt = userDesign.cardSoft;
const textDark = userDesign.text;
const textMuted = userDesign.textMuted;
const successColor = userDesign.success;

type Step = "datetime" | "details" | "success";

function toLocalISODate(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
}

function getTodayLocalISO() {
  return toLocalISODate(new Date());
}

function getDates(count = 14) {
  const dates = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(toLocalISODate(d));
  }
  return dates;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const weekday = d.toLocaleDateString("uz-UZ", { weekday: "short" });
  return { day, weekday };
}

function toUz24h(timeValue: string) {
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

function parseTimeToMinutes(timeValue: string) {
  const normalized = toUz24h(timeValue);
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function isPastSlot(dateISO: string, slotTime: string, now: Date) {
  const today = getTodayLocalISO();
  if (dateISO !== today) return false;
  const slotMinutes = parseTimeToMinutes(slotTime);
  if (slotMinutes == null) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes <= nowMinutes;
}

export default function BookingScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barberId: string; barberName: string }>();
  const barberId = Number(params.barberId);
  const barberName = params.barberName ?? "Sartarosh";

  const [step, setStep] = useState<Step>("datetime");
  const [dates] = useState(getDates());
  const [selectedDate, setSelectedDate] = useState(getTodayLocalISO());
  const [availability, setAvailability] = useState<BarberAvailabilityApi | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [nowTick, setNowTick] = useState(() => new Date());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState(session?.name ?? "");
  const [clientPhone, setClientPhone] = useState(() => formatUzbekPhone(session?.phone ?? ""));
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState<UserBookingConfirmationApi | null>(null);
  const [specialists, setSpecialists] = useState<UserBookingBarberApi[]>([]);
  
  const selectedBarber = specialists.find((item) => item.id === barberId);
  const barberAddress = selectedBarber?.barbershop_address || selectedBarber?.barbershop_name || barberName;
  const hasBarberCoords =
    typeof selectedBarber?.location_latitude === "number" &&
    typeof selectedBarber?.location_longitude === "number";

  const availableSlots = useMemo(
    () =>
      availability?.slots.filter(
        (slot) => slot.status === "available" && !isPastSlot(selectedDate, slot.time, nowTick),
      ) ?? [],
    [availability, nowTick, selectedDate],
  );

  const blurFocusedElementWeb = useCallback(() => {
    if (Platform.OS !== "web") return;
    const activeElement = (globalThis as { document?: { activeElement?: { blur?: () => void } } })?.document?.activeElement;
    activeElement?.blur?.();
  }, []);

  const openRouteToBarber = useCallback(async () => {
    try {
      const lat = selectedBarber?.location_latitude;
      const lng = selectedBarber?.location_longitude;
      const encodedAddress = encodeURIComponent(barberAddress);

      const preferredUrl = hasBarberCoords
        ? Platform.select({
            ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
            android: `google.navigation:q=${lat},${lng}&mode=d`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
          })
        : Platform.select({
            ios: `http://maps.apple.com/?q=${encodedAddress}`,
            android: `geo:0,0?q=${encodedAddress}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
          });

      const fallbackUrl = hasBarberCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

      if (preferredUrl && (await Linking.canOpenURL(preferredUrl))) {
        await Linking.openURL(preferredUrl);
        return;
      }

      await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert("Xatolik", "Xaritani ochib bo'lmadi. Keyinroq qayta urinib ko'ring.");
    }
  }, [barberAddress, hasBarberCoords, selectedBarber?.location_latitude, selectedBarber?.location_longitude]);

  const fetchSlots = useCallback(async (date: string) => {
    if (!barberId) return;
    setLoadingSlots(true);
    setSelectedTime("");
    try {
      // Retry with exponential backoff
      let attempt = 0;
      let lastError: any;
      while (attempt < 3) {
        try {
          const data = await getBarberAvailability(barberId, date);
          setAvailability(data);
          return;
        } catch (err) {
          lastError = err;
          attempt++;
          if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
      throw lastError;
    } catch {
      setAvailability(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [barberId]);

  useEffect(() => { fetchSlots(selectedDate); }, [selectedDate, fetchSlots]);

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

  useEffect(() => {
    return () => {
      blurFocusedElementWeb();
    };
  }, [blurFocusedElementWeb]);

  useEffect(() => {
    if (!session?.user_id) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const profile = await getUserProfile(session.user_id);
        if (!active) {
          return;
        }

        setClientPhone(formatUzbekPhone(profile.phone || session.phone || ""));
        setClientName((prev) => {
          if (prev.trim()) {
            return prev;
          }
          return profile.name || session.name || "";
        });
      } catch {
        if (active) {
          setClientPhone(formatUzbekPhone(session.phone || ""));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [session?.name, session?.phone, session?.user_id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTime) return;
    if (!availableSlots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime("");
    }
  }, [availableSlots, selectedTime]);

  const handleBook = async () => {
    if (!clientName.trim()) {
      Alert.alert("Xatolik", "Ismni to'g'ri kiriting");
      return;
    }

    if (hasOnlyPrefix(clientPhone) || !isCompleteUzbekPhone(clientPhone)) {
      Alert.alert("Xatolik", "Telefon raqam profilingizdan olinadi. Iltimos, profil bo'limida raqamni to'liq kiriting.");
      return;
    }
    if (isPastSlot(selectedDate, selectedTime, nowTick)) {
      Alert.alert("Vaqt o'tib ketgan", "Tanlangan vaqt allaqachon o'tib ketdi. Iltimos, yangi vaqt tanlang.");
      setStep("datetime");
      setSelectedTime("");
      return;
    }

    setBooking(true);
    try {
      const conf = await createBooking({
        barber_id: barberId,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        client_name: clientName.trim(),
        client_phone: toUzbekPhoneApi(clientPhone),
        user_id: session?.user_id,
      });
      setConfirmation(conf);
      await showLocalNotification(
        "Bron qabul qilindi",
        `${barberName} uchun navbatingiz muvaffaqiyatli yaratildi`,
        "booking_created"
      );
      setStep("success");
    } catch (e: any) {
      // Handle 409 Conflict - existing pending booking
      if (e.status === 409 || e.response?.status === 409) {
        Alert.alert(
          "Allaqachon bron qilgansiz",
          "Siz avval bron qilgansiz. Sartarosh tasdiqlagach yana bron qilishingiz mumkin. Sartarosh tomonidan tasdiqlangan bronlarga 'Mening bronlarim' sahifasidan qarang.",
          [
            {
              text: "Mening bronlarim",
              onPress: () => {
                blurFocusedElementWeb();
                router.push("/user/mybookings");
              },
            },
            { text: "Tugatish", onPress: () => { blurFocusedElementWeb(); } },
          ]
        );
        return;
      }
      Alert.alert("Xatolik", e.message || "Bron qilishda xatolik yuz berdi");
    } finally {
      setBooking(false);
    }
  };

  // ── Success State ──
  if (step === "success" && confirmation) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-done" size={56} color={successColor} />
          </View>
          <Text style={styles.successEyebrow}>PREMIUM BRON TAYYOR</Text>
          <Text style={styles.successTitle}>Tabriklaymiz!</Text>
          <Text style={styles.successSub}>Sizning navbatingiz muvaffaqiyatli yaratildi. Endi manzilga bir bosishda yo&apos;l oling.</Text>

          <View style={styles.successHeroCard}>
            {selectedBarber?.photo_url || confirmation.barber_photo_url ? (
              <Image source={{ uri: selectedBarber?.photo_url || confirmation.barber_photo_url || undefined }} style={styles.successHeroAvatar} />
            ) : (
              <View style={styles.successHeroFallback}>
                <Text style={styles.successHeroInitial}>{confirmation.barber_name[0]}</Text>
              </View>
            )}
            <View style={styles.successHeroBody}>
              <Text style={styles.successHeroName}>{confirmation.barber_name}</Text>
              <Text style={styles.successHeroSub}>{confirmation.barber_specialty || selectedBarber?.specialty || "Premium barber"}</Text>
              <View style={styles.successHeroChips}>
                <View style={styles.successChip}>
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text style={styles.successChipText}>{selectedBarber?.rating?.toFixed(1) || "5.0"}</Text>
                </View>
                <View style={styles.successChip}>
                  <Ionicons name="location-outline" size={12} color={accent} />
                  <Text style={styles.successChipText} numberOfLines={1}>{barberAddress}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.confirmCard}>
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelWrap}>
                <Ionicons name="person-outline" size={16} color={textMuted} />
                <Text style={styles.confirmLabel}>Mutaxassis</Text>
              </View>
              <Text style={styles.confirmValue}>{confirmation.barber_name}</Text>
            </View>
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelWrap}>
                <Ionicons name="calendar-outline" size={16} color={textMuted} />
                <Text style={styles.confirmLabel}>Sana</Text>
              </View>
              <Text style={styles.confirmValue}>{confirmation.appointment_date}</Text>
            </View>
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelWrap}>
                <Ionicons name="time-outline" size={16} color={textMuted} />
                <Text style={styles.confirmLabel}>Vaqt</Text>
              </View>
              <Text style={styles.confirmValue}>{toUz24h(confirmation.appointment_time)}</Text>
            </View>
            <View style={[styles.confirmRow, styles.confirmRowHighlight]}>
              <View style={styles.confirmLabelWrap}>
                <Ionicons name="cash-outline" size={16} color={textMuted} />
                <Text style={styles.confirmLabel}>Narx</Text>
              </View>
              <Text style={styles.confirmValuePrice}>{Math.round(confirmation.service_price || 0).toLocaleString()} so&apos;m</Text>
            </View>
            <View style={[styles.confirmRow, styles.confirmRowLast]}>
              <View style={styles.confirmLabelWrap}>
                <Ionicons name="location-outline" size={16} color={textMuted} />
                <Text style={styles.confirmLabel}>Manzil</Text>
              </View>
              <Text style={styles.confirmValueAddress}>{barberAddress}</Text>
            </View>
          </View>

          <View style={styles.successActions}>
            <Pressable style={({ pressed }) => [styles.routeBtn, pressed && styles.pressed]} onPress={() => void openRouteToBarber()}>
              <View style={styles.routeBtnIcon}>
                <Ionicons name="navigate" size={18} color="#0f172a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeBtnTitle}>Sartarosh tomon yo&apos;nalish</Text>
                <Text style={styles.routeBtnSub}>Map ochiladi va marshrut chiziladi</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#0f172a" />
            </Pressable>

            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => { blurFocusedElementWeb(); router.replace("/user/home"); }}>
              <Ionicons name="home" size={20} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Bosh sahifaga</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
          onPress={() => {
            blurFocusedElementWeb();
            if (step === "details") {
              setStep("datetime");
              return;
            }
            router.back();
          }}
        >
          <Ionicons name="chevron-back" size={24} color={textDark} />
        </Pressable>
        <Text style={styles.headerTitle}>{step === "datetime" ? "Vaqtni tanlang" : "Ma’lumotlar"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {step === "datetime" ? (
          <>
            {/* Barber Summary */}
            <View style={styles.heroCard}>
              {selectedBarber?.photo_url ? (
                <Image source={{ uri: selectedBarber.photo_url }} style={styles.heroAvatar} />
              ) : (
                <View style={styles.heroAvatarFallback}>
                  <Text style={styles.heroAvatarFallbackText}>{barberName[0] || "B"}</Text>
                </View>
              )}
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{barberName}</Text>
                <Text style={styles.heroSub}>{selectedBarber?.specialty || "Professional"}</Text>
                {selectedBarber && (
                  <View style={styles.heroMeta}>
                    <View style={styles.heroMetaItem}>
                      <Ionicons name="star" size={12} color={accent} />
                      <Text style={styles.heroMetaText}>{selectedBarber.rating.toFixed(1)}</Text>
                    </View>
                    {selectedBarber.years_experience && (
                      <View style={styles.heroMetaItem}>
                        <Ionicons name="briefcase-outline" size={12} color={accent} />
                        <Text style={styles.heroMetaText}>{selectedBarber.years_experience}+ yosh</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Date Selection */}
            <Text style={styles.sectionTitle}>Sana</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateList}>
              {dates.map((d) => {
                const { day, weekday } = formatDate(d);
                const active = selectedDate === d;
                return (
                  <Pressable key={d} style={({ pressed }) => [styles.dateCard, active && styles.dateCardActive, pressed && styles.pressed]} onPress={() => setSelectedDate(d)}>
                    <Text style={[styles.dateWeek, active && styles.activeText]}>{weekday.toUpperCase()}</Text>
                    <Text style={[styles.dateDay, active && styles.activeText]}>{day}</Text>
                    {active && <View style={styles.activeDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time Slots */}
            <Text style={styles.sectionTitle}>Bo&apos;sh vaqtlar</Text>
            {loadingSlots ? (
              <ActivityIndicator color={accent} style={{ marginTop: 30 }} />
            ) : availableSlots.length === 0 ? (
              <View style={styles.emptySlots}><Text style={styles.emptyText}>Bugun uchun bo&apos;sh vaqt qolmagan</Text></View>
            ) : (
              <View style={styles.slotsGrid}>
                {availableSlots.map((s) => (
                  <Pressable 
                    key={s.time} 
                    style={({ pressed }) => [styles.slotItem, selectedTime === s.time && styles.slotItemActive, pressed && styles.pressed]}
                    onPress={() => setSelectedTime(s.time)}
                  >
                    <Text style={[styles.slotText, selectedTime === s.time && styles.activeText]}>{toUz24h(s.time)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.detailsPadding}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Bron tafsilotlari</Text>
              <Row label="Sana" value={selectedDate} />
              <Row label="Vaqt" value={toUz24h(selectedTime)} />
            </View>

            <Text style={styles.label}>Ismingiz</Text>
            <TextInput 
              style={styles.input} 
              value={clientName} 
              onChangeText={setClientName} 
              placeholder="Ismingizni kiriting" 
              placeholderTextColor="#475569" 
            />

            <Text style={styles.label}>Telefon raqamingiz</Text>
            <TextInput 
              style={[styles.input, styles.inputReadonly]} 
              value={clientPhone} 
              keyboardType="phone-pad" 
              editable={false}
              showSoftInputOnFocus={false}
              selectTextOnFocus={false}
              contextMenuHidden
              maxLength={UZBEKISTAN_PHONE_DISPLAY_MAX}
            />
            <Text style={styles.hint}>Telefon raqami profilingizdan avtomatik olinadi</Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Bar */}
      {selectedTime !== "" && (
        <View style={[styles.bottomFloating, { paddingBottom: insets.bottom + 15 }]}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomTime}>{toUz24h(selectedTime)}</Text>
            <Text style={styles.bottomDate}>{selectedDate}</Text>
          </View>
          <Pressable 
            style={styles.actionBtn} 
            onPress={() => {
              if (step === "datetime") {
                if (isPastSlot(selectedDate, selectedTime, nowTick)) {
                  Alert.alert("Vaqt o'tib ketgan", "Tanlangan vaqt allaqachon o'tib ketdi. Iltimos, yangi vaqt tanlang.");
                  setSelectedTime("");
                  return;
                }
                setStep("details");
                return;
              }
              void handleBook();
            }}
            disabled={booking}
          >
            {booking ? <ActivityIndicator color="#ffffff" /> : (
              <>
                <Text style={styles.actionBtnText}>{step === "datetime" ? "Davom etish" : "Tasdiqlash"}</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </Pressable>
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
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,122,26,0.14)" },
  label: { color: textMuted, fontSize: 14, fontWeight: "700" },
  value: { color: textDark, fontSize: 14, fontWeight: "700", textAlign: "right" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pageBg },
  
  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.16)" },
  backCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: cardBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.24)", ...(Platform.OS === "web" ? { boxShadow: "0px 6px 12px rgba(2, 6, 23, 0.18)" } : { shadowColor: "#020617", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 2 }) },
  headerTitle: { color: textDark, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  
  // Hero Card
  heroCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 24, padding: 16, backgroundColor: cardBgAlt, borderRadius: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", ...(Platform.OS === "web" ? { boxShadow: "0px 10px 18px rgba(2, 6, 23, 0.22)" } : { shadowColor: "#020617", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 4 }) },
  heroAvatar: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, borderColor: userDesign.accentSoft },
  heroAvatarFallback: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, borderColor: userDesign.accentSoft, backgroundColor: userDesign.accentSoft, alignItems: "center", justifyContent: "center" },
  heroAvatarFallbackText: { color: userDesign.accentStrong, fontWeight: "900", fontSize: 24 },
  heroInfo: { marginLeft: 12, flex: 1 },
  heroName: { color: textDark, fontSize: 15, fontWeight: "900" },
  heroSub: { color: textMuted, fontSize: 12, marginTop: 1, fontWeight: "600" },
  heroMeta: { flexDirection: "row", gap: 8, marginTop: 6 },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroMetaText: { color: accent, fontSize: 12, fontWeight: "700" },
  
  // Section Title
  sectionTitle: { color: textDark, fontSize: 16, fontWeight: "800", marginLeft: 16, marginTop: 16, marginBottom: 12, letterSpacing: -0.3 },
  
  // Date Selection
  dateList: { paddingLeft: 16, marginBottom: 24 },
  dateCard: { width: 68, height: 92, backgroundColor: cardBg, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", ...(Platform.OS === "web" ? { boxShadow: "0px 6px 12px rgba(2, 6, 23, 0.16)" } : { shadowColor: "#020617", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 }) },
  dateCardActive: { backgroundColor: accent, borderColor: "rgba(255,122,26,0.45)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 14px rgba(255,122,26,0.26)" } : { shadowColor: "rgba(255,122,26,0.3)", shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 }) },
  dateWeek: { color: textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  dateDay: { color: textDark, fontSize: 22, fontWeight: "900", marginTop: 3 },
  activeText: { color: "#eaf2ff" },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#eaf2ff", marginTop: 6 },
  
  // Time Slots
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  slotItem: { width: "30.5%", paddingVertical: 14, backgroundColor: cardBg, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", ...(Platform.OS === "web" ? { boxShadow: "0px 4px 10px rgba(2, 6, 23, 0.16)" } : { shadowColor: "#020617", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 }) },
  slotItemActive: { backgroundColor: accent, borderColor: "rgba(255,122,26,0.45)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 14px rgba(255,122,26,0.26)" } : { shadowColor: "rgba(255,122,26,0.3)", shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 }) },
  slotText: { color: textDark, fontWeight: "800", fontSize: 14 },
  emptySlots: { alignItems: "center", padding: 40, marginTop: 20 },
  emptyText: { color: textMuted, fontSize: 15, fontWeight: "600" },
  
  // Details Section
  detailsPadding: { paddingHorizontal: 16, paddingTop: 8 },
  summaryBox: { padding: 16, backgroundColor: cardBg, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" },
  summaryTitle: { color: accent, fontWeight: "800", marginBottom: 12, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8 },
  label: { color: textDark, fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: cardBg, borderRadius: 12, padding: 14, color: textDark, fontSize: 15, fontWeight: "500", borderWidth: 1, borderColor: "rgba(148,163,184,0.26)" },
  inputReadonly: { backgroundColor: "#f8fafc", color: "#0f172a" },
  hint: { color: textMuted, fontSize: 12, marginTop: 6, fontWeight: "600" },
  
  // Bottom Floating Bar
  bottomFloating: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: cardBg, paddingHorizontal: 16, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.2)", ...(Platform.OS === "web" ? { boxShadow: "0px -10px 18px rgba(2, 6, 23, 0.22)" } : { shadowColor: "#020617", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 }) },
  bottomInfo: { flex: 1 },
  bottomTime: { color: textDark, fontSize: 18, fontWeight: "900" },
  bottomDate: { color: textMuted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  actionBtn: { backgroundColor: accent, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,122,26,0.45)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 14px rgba(255,122,26,0.26)" } : { shadowColor: "rgba(255,122,26,0.3)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 }) },
  actionBtnText: { color: "#ffffff", fontWeight: "900", fontSize: 15 },
  
  // Success State
  successContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 52 },
  successIconBadge: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(16, 185, 129, 0.12)", alignItems: "center", justifyContent: "center", marginBottom: 24, borderWidth: 2, borderColor: "rgba(16, 185, 129, 0.25)" },
  successIcon: { fontSize: 56, fontWeight: "900", color: successColor },
  successEyebrow: { color: accentLight, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  successTitle: { color: textDark, fontSize: 26, fontWeight: "900", textAlign: "center" },
  successSub: { color: textMuted, textAlign: "center", marginTop: 6, marginBottom: 18, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  successHeroCard: { width: "100%", flexDirection: "row", alignItems: "center", backgroundColor: cardBgAlt, borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,122,26,0.16)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 14px rgba(255,122,26,0.14)" } : { shadowColor: "rgba(255,122,26,0.2)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 3 }) },
  successHeroAvatar: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: accent },
  successHeroFallback: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", backgroundColor: accentDark, borderWidth: 2, borderColor: accent },
  successHeroInitial: { color: "#fff", fontSize: 28, fontWeight: "900" },
  successHeroBody: { flex: 1, marginLeft: 14 },
  successHeroName: { color: textDark, fontSize: 19, fontWeight: "900" },
  successHeroSub: { color: textMuted, fontSize: 13, fontWeight: "600", marginTop: 3 },
  successHeroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  successChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: "100%" },
  successChipText: { color: textDark, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  
  // Confirm Card
  confirmCard: { width: "100%", backgroundColor: cardBg, padding: 20, borderRadius: 14, marginBottom: 32, borderWidth: 1, borderColor: "rgba(148,163,184,0.24)" },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,122,26,0.12)" },
  confirmRowHighlight: { borderBottomWidth: 0, backgroundColor: "rgba(255,122,26,0.08)", marginHorizontal: -20, paddingHorizontal: 20, borderRadius: 10, marginVertical: 4 },
  confirmRowLast: { borderBottomWidth: 0, alignItems: "flex-start", gap: 12 },
  confirmLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  confirmLabel: { color: textMuted, fontSize: 14, fontWeight: "700" },
  confirmValue: { color: textDark, fontSize: 14, fontWeight: "800" },
  confirmValuePrice: { color: accent, fontSize: 16, fontWeight: "900" },
  confirmValueAddress: { color: textDark, fontSize: 14, fontWeight: "800", flex: 1, textAlign: "right", marginLeft: 18 },
  
  // Primary Button
  successActions: { width: "100%", gap: 14 },
  routeBtn: { width: "100%", backgroundColor: "rgba(255,122,26,0.10)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(255,122,26,0.24)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 14px rgba(255,122,26,0.2)" } : { shadowColor: "rgba(255,122,26,0.22)", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 4 }) },
  routeBtnIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,122,26,0.2)", alignItems: "center", justifyContent: "center" },
  routeBtnTitle: { color: textDark, fontWeight: "900", fontSize: 14 },
  routeBtnSub: { color: "#334155", fontWeight: "600", fontSize: 12, marginTop: 2 },
  primaryBtn: { width: "100%", backgroundColor: accent, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "rgba(255,122,26,0.45)", ...(Platform.OS === "web" ? { boxShadow: "0px 8px 16px rgba(255,122,26,0.28)" } : { shadowColor: "rgba(255,122,26,0.3)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 }) },
  primaryBtnText: { color: "#eaf2ff", fontWeight: "900", fontSize: 16 },
  pressed: {
    opacity: 0.7,
  },
});