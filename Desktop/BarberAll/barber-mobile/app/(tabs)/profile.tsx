import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { getUserAppointments, getUserProfile, submitBarberRating, updateUserProfile, UserAppointmentApi } from "@/services/api";
import { router } from "expo-router";
import { panelTheme } from "@/constants/panel-theme";

const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ Kutilmoqda",
  completed: "✅ Bajarildi",
  cancelled: "❌ Bekor qilindi",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#f4b942",
  completed: "#34a853",
  cancelled: "#ea4335",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [appointments, setAppointments] = useState<UserAppointmentApi[]>([]);
  const [profileName, setProfileName] = useState(session?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(session?.email ?? "");
  const [profilePassword, setProfilePassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<number | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!session?.user_id) return;
    try {
      setError(null);
      const [data, profile] = await Promise.all([
        getUserAppointments(session.user_id),
        getUserProfile(session.user_id),
      ]);
      setAppointments(data);
      setProfileName(profile.name || session.name || "");
      setProfileEmail(profile.email || session.email || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [session?.user_id]);

  const saveProfile = async () => {
    if (!session?.user_id) {
      return;
    }
    try {
      setSavingProfile(true);
      await updateUserProfile(session.user_id, {
        name: profileName.trim(),
        email: profileEmail.trim() || undefined,
        password: profilePassword.trim() || undefined,
      });
      setProfilePassword("");
      Alert.alert("Saqlandi", "Profil yangilandi");
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSavingProfile(false);
    }
  };

  const sendRating = async (appointment: UserAppointmentApi) => {
    if (!appointment.barber_id || ratingScore < 1) {
      Alert.alert("Baho", "1 dan 5 gacha yulduz tanlang");
      return;
    }
    try {
      setRatingLoading(true);
      await submitBarberRating(appointment.barber_id, {
        score: ratingScore,
        user_name: profileName || session?.name,
      });
      Alert.alert("Rahmat", "Bahoyingiz yuborildi");
      setRatingTarget(null);
      setRatingScore(0);
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Baho yuborilmadi");
    } finally {
      setRatingLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleLogout = () => {
    Alert.alert("Chiqish", "Hisobdan chiqmoqchimisiz?", [
      { text: "Yo'q", style: "cancel" },
      {
        text: "Ha, chiqish",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profileName || session?.name || "U")}</Text>
          </View>
          <Text style={styles.headerTitle}>Mening profilim</Text>
          <Text style={styles.name}>{profileName || session?.name}</Text>
          <Text style={styles.email}>{profileEmail || session?.email}</Text>

          <TouchableOpacity style={styles.editProfileBtn} onPress={() => setShowEditForm((prev) => !prev)}>
            <Text style={styles.editProfileText}>{showEditForm ? "Yopish" : "Tahrirlash"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {showEditForm ? (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Profil boshqaruvi</Text>
            <Field label="Ism" value={profileName} onChangeText={setProfileName} />
            <Field label="Email" value={profileEmail} onChangeText={setProfileEmail} keyboardType="email-address" />
            <Field label="Yangi parol" value={profilePassword} onChangeText={setProfilePassword} secureTextEntry />
            <TouchableOpacity style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]} onPress={saveProfile} disabled={savingProfile}>
              <Text style={styles.saveBtnText}>{savingProfile ? "Saqlanmoqda..." : "Profilni saqlash"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.settingsTitle}>Hisob sozlamalari</Text>
        <View style={styles.settingsCard}>
          <SettingRow label="Shaxsiy ma'lumotlar" />
          <SettingRow label="Parol va xavfsizlik" />
          <SettingRow label="Bildirishnoma sozlamasi" />
        </View>

        <Text style={styles.settingsTitle}>Qo‘shimcha</Text>
        <View style={styles.settingsCard}>
          <SettingRow label="Aloqa va support" />
          <SettingRow label="Til va mintaqa" />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{appointments.length}</Text>
            <Text style={styles.statLabel}>Jami bron</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {appointments.filter((a) => a.status === "completed").length}
            </Text>
            <Text style={styles.statLabel}>Bajarildi</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {appointments.filter((a) => a.status === "pending").length}
            </Text>
            <Text style={styles.statLabel}>Kutilmoqda</Text>
          </View>
        </View>

        {/* Appointments */}
        <Text style={styles.sectionTitle}>📋 Bronlar tarixi</Text>

        {loading ? (
          <ActivityIndicator color="#1a73e8" style={{ marginTop: 30 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchAppointments}>
              <Text style={styles.retryText}>Qayta urinish</Text>
            </TouchableOpacity>
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>Hali bron yo'q</Text>
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => router.push("/user/home")}
            >
              <Text style={styles.bookNowText}>Sartarosh bron qilish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.appointmentsList}>
            {appointments.map((apt) => (
              <View key={apt.id} style={styles.aptCard}>
                <View style={styles.aptTop}>
                  <View>
                    <Text style={styles.aptBarber}>{apt.barber_name ?? "Sartarosh"}</Text>
                    <Text style={styles.aptSpecialty}>{apt.barber_specialty ?? ""}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: STATUS_COLORS[apt.status] + "22" },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: STATUS_COLORS[apt.status] }]}>
                      {STATUS_LABELS[apt.status]}
                    </Text>
                  </View>
                </View>
                <View style={styles.aptBottom}>
                  <Text style={styles.aptDate}>
                    📅 {apt.appointment_date} {apt.appointment_time}
                  </Text>
                  {apt.service_price != null && (
                    <Text style={styles.aptPrice}>
                      {Math.round(apt.service_price).toLocaleString("uz-UZ")} so'm
                    </Text>
                  )}
                </View>
                {apt.status === "completed" ? (
                  <View style={styles.ratingBox}>
                    <Text style={styles.ratingLabel}>Baholash</Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((score) => (
                        <TouchableOpacity key={score} onPress={() => { setRatingTarget(apt.id); setRatingScore(score); }}>
                          <Text style={[styles.star, ratingTarget === apt.id && ratingScore >= score ? styles.starActive : null]}>★</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={[styles.rateBtn, ratingLoading && { opacity: 0.7 }]} onPress={() => sendRating(apt)} disabled={ratingLoading}>
                      <Text style={styles.rateBtnText}>{ratingLoading && ratingTarget === apt.id ? "Yuborilmoqda..." : "Bahoni yuborish"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        style={styles.input}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  header: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: { color: "#111827", fontSize: 28, fontWeight: "700" },
  headerTitle: { color: "#111827", fontSize: 28, fontWeight: "900", marginBottom: 10 },
  name: { color: "#111827", fontSize: 20, fontWeight: "800", marginTop: 10 },
  email: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  editProfileBtn: { marginTop: 12, backgroundColor: "#fff7ed", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: "#fed7aa" },
  editProfileText: { color: "#b45309", fontWeight: "800" },
  logoutBtn: {
    marginTop: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  logoutBtnText: { color: "#0f172a", fontWeight: "800", fontSize: 13 },
  profileCard: { backgroundColor: panelTheme.surface, margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: panelTheme.border },
  profileTitle: { color: panelTheme.heading, fontWeight: "900", fontSize: 16, marginBottom: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: panelTheme.text, fontWeight: "800", marginBottom: 6 },
  input: { backgroundColor: panelTheme.surface, borderRadius: 12, borderWidth: 1, borderColor: panelTheme.border, paddingHorizontal: 14, paddingVertical: 12, color: panelTheme.heading },
  saveBtn: { backgroundColor: panelTheme.dark, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "900" },
  settingsTitle: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, color: "#111827", fontSize: 18, fontWeight: "800" },
  settingsCard: { marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  settingLabel: { color: "#374151", fontSize: 15 },
  settingArrow: { color: "#9ca3af", fontSize: 20, fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    margin: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: panelTheme.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: panelTheme.border,
  },
  statNum: { fontSize: 22, fontWeight: "900", color: panelTheme.blue },
  statLabel: { fontSize: 12, color: panelTheme.muted, marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: panelTheme.heading,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  appointmentsList: { paddingHorizontal: 16 },
  aptCard: {
    backgroundColor: panelTheme.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: panelTheme.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  aptTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  aptBarber: { fontSize: 15, fontWeight: "800", color: panelTheme.heading },
  aptSpecialty: { fontSize: 12, color: panelTheme.muted, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  aptBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  aptDate: { fontSize: 13, color: panelTheme.text },
  aptPrice: { fontSize: 13, fontWeight: "800", color: panelTheme.blue },
  ratingBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  ratingLabel: { color: panelTheme.text, fontWeight: "800", marginBottom: 6 },
  ratingRow: { flexDirection: "row", gap: 4, marginBottom: 10 },
  star: { fontSize: 22, color: "#cbd5e1" },
  starActive: { color: "#f59e0b" },
  rateBtn: { alignSelf: "flex-start", backgroundColor: panelTheme.dark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  rateBtnText: { color: "#fff", fontWeight: "800" },
  errorBox: { padding: 24, alignItems: "center" },
  errorText: { color: "#ea4335", fontSize: 14, marginBottom: 12 },
  retryBtn: { backgroundColor: panelTheme.dark, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600" },
  emptyBox: { alignItems: "center", padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: panelTheme.muted, marginTop: 12 },
  bookNowBtn: {
    backgroundColor: panelTheme.dark,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  bookNowText: { color: "#fff", fontWeight: "800" },
});

function SettingRow({ label }: { label: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingArrow}>›</Text>
    </View>
  );
}
