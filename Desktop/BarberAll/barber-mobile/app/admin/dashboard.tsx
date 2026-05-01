import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { getAdminBarbers, getAdminProfile, getBookings, updateAdminProfile, type AdminBarberApi, type AdminBookingApi } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signIn, signOut } = useAuth();
  const [barbers, setBarbers] = useState<AdminBarberApi[]>([]);
  const [bookings, setBookings] = useState<AdminBookingApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [barberRows, bookingRows] = await Promise.all([
        getAdminBarbers(),
        getBookings({ status: "all" }),
      ]);
      setBarbers(barberRows);
      setBookings(bookingRows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Dashboard yuklanmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const completed = bookings.filter((item) => item.status === "completed");
    const topBarber = [...barbers].sort((a, b) => b.today_cuts - a.today_cuts || b.rating - a.rating)[0] ?? null;
    return {
      totalBookings: bookings.length,
      activeBarbers: barbers.filter((item) => item.status !== "off").length,
      completed: completed.length,
      pending: bookings.filter((item) => item.status === "pending").length,
      revenue: completed.reduce((sum, item) => sum + item.price, 0),
      averageTicket: completed.length ? Math.round(completed.reduce((sum, item) => sum + item.price, 0) / completed.length) : 0,
      topBarber,
    };
  }, [barbers, bookings]);

  const weeklyChart = useMemo(() => {
    const days = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
    return days.map((day, index) => {
      const completed = bookings.filter((_, bookingIndex) => bookingIndex % 7 === index && bookings[bookingIndex]?.status === "completed").length;
      const pending = bookings.filter((_, bookingIndex) => bookingIndex % 7 === index && bookings[bookingIndex]?.status === "pending").length;
      return { day, completed, pending };
    });
  }, [bookings]);

  const chartMax = Math.max(1, ...weeklyChart.map((item) => item.completed + item.pending));

  const adminInitials = useMemo(() => {
    const source = (profileName || session?.name || "Admin").trim();
    const parts = source.split(" ").filter(Boolean).slice(0, 2);
    if (parts.length === 0) {
      return "AD";
    }
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  }, [profileName, session?.name]);

  const openProfileEditor = async () => {
    const adminId = session?.user_id;
    if (!adminId) {
      setError("Admin sessiyasi topilmadi.");
      return;
    }

    try {
      setProfileLoading(true);
      setIsProfileOpen(true);
      const profile = await getAdminProfile(adminId);
      setProfileName(profile.name || session?.name || "");
      setProfileEmail(profile.email || session?.email || "");
      setProfilePhone(profile.phone || "");
      setProfileAvatar(profile.avatar || "");
      setProfilePassword("");
    } catch (profileError: unknown) {
      setError(profileError instanceof Error ? profileError.message : "Profilni ochib bo'lmadi.");
      setIsProfileOpen(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfileEditor = async () => {
    const adminId = session?.user_id;
    if (!adminId || !session) {
      return;
    }

    try {
      setProfileSaving(true);
      const updated = await updateAdminProfile(adminId, {
        name: profileName.trim(),
        email: profileEmail.trim().toLowerCase(),
        phone: profilePhone.trim() || undefined,
        password: profilePassword.trim() || undefined,
        avatar: profileAvatar.trim() || undefined,
      });

      await signIn({
        ...session,
        name: updated.name,
        email: updated.email,
        phone: updated.phone ?? null,
        avatar: updated.avatar ?? null,
      });

      setProfilePassword("");
      setIsProfileOpen(false);
      setError(null);
    } catch (profileError: unknown) {
      setError(profileError instanceof Error ? profileError.message : "Profilni saqlab bo'lmadi.");
    } finally {
      setProfileSaving(false);
    }
  };

  const pickAvatarFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Ruxsat kerak", "Galereyadan rasm tanlash uchun ruxsat bering.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const selected = result.assets[0];
      if (selected.base64) {
        const mime = selected.mimeType || "image/jpeg";
        setProfileAvatar(`data:${mime};base64,${selected.base64}`);
      } else if (selected.uri) {
        setProfileAvatar(selected.uri);
      }
    } catch {
      Alert.alert("Xatolik", "Rasm tanlashda xatolik bo‘ldi.");
    }
  };

  const handleLogout = () => {
    Alert.alert("Chiqish", "Hisobdan chiqishni xohlaysizmi?", [
      { text: "Bekor", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 116 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.topRow}>
          <View style={styles.topTextWrap}>
            <Text style={styles.eyebrow}>BOSHQARUV PANELI</Text>
            <Text style={styles.title}>Barber Boshqaruv Markazi</Text>
            <Text style={styles.subtitle}>Haftalik holat, bronlar va jamoa samaradorligi</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.avatarButton} onPress={openProfileEditor}>
              {session?.avatar ? (
                <Image source={{ uri: session.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{adminInitials}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutMiniButton} onPress={handleLogout}>
              <Text style={styles.logoutMiniText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickRow}>
          <QuickAction label="Bronlar" hint="Jadvalni ochish" onPress={() => router.push("/admin/bookings")} />
          <QuickAction label="Barberlar" hint="Xodimlarni boshqarish" onPress={() => router.push("/admin/barbers")} />
        </View>

        {error ? <ErrorBox message={error} onRetry={load} /> : null}

        <View style={styles.statsRow}>
          <StatCard label="Jami bron" value={String(summary.totalBookings)} color="#1d4ed8" />
          <StatCard label="Faol barber" value={String(summary.activeBarbers)} color="#111827" />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Yakunlangan" value={String(summary.completed)} color="#059669" />
          <StatCard label="Kutilmoqda" value={String(summary.pending)} color="#d97706" />
        </View>

        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Bugungi tushum</Text>
          <Text style={styles.revenueValue}>{summary.revenue.toLocaleString("uz-UZ")} so'm</Text>
          <Text style={styles.revenueSub}>{summary.completed} ta yakunlangan xizmat</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>O‘rtacha чек</Text>
            <Text style={styles.metricValue}>{summary.averageTicket.toLocaleString("uz-UZ")} so'm</Text>
            <Text style={styles.metricSub}>Faqat completed bronlar</Text>
          </View>
          <View style={styles.metricCardDark}>
            <Text style={styles.metricLabelDark}>Eng faol barber</Text>
            <Text style={styles.metricValueDark}>{summary.topBarber?.name ?? "—"}</Text>
            <Text style={styles.metricSubDark}>{summary.topBarber ? `${summary.topBarber.today_cuts} ta mijoz · ⭐ ${summary.topBarber.rating.toFixed(1)}` : "Hali ma'lumot yo'q"}</Text>
          </View>
        </View>

        <SectionTitle title="Haftalik bronlar" />
        <View style={styles.chartCard}>
          <Text style={styles.chartSub}>Yakunlangan va kutilayotgan bronlar</Text>
          <View style={styles.chartBars}>
            {weeklyChart.map((item) => (
              <View key={item.day} style={styles.chartColumn}>
                <View style={styles.chartStack}>
                  <View style={[styles.chartSegPending, { height: `${((item.pending || 0) / chartMax) * 72}%` }]} />
                  <View style={[styles.chartSegDone, { height: `${((item.completed || 0) / chartMax) * 72}%` }]} />
                </View>
                <Text style={styles.chartLabel}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionTitle title="So‘nggi bronlar" />
        {bookings.slice(0, 4).map((booking) => (
          <View key={booking.id} style={styles.listCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{booking.client}</Text>
              <Badge status={booking.status} />
            </View>
            <Text style={styles.itemSub}>{booking.barber} · {booking.service}</Text>
            <Text style={styles.itemMeta}>{booking.date} {booking.time}</Text>
          </View>
        ))}

        <SectionTitle title="Top barberlar" />
        {barbers.slice(0, 3).map((barber) => (
          <View key={barber.id} style={styles.listCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.itemTitle}>{barber.name}</Text>
                <Text style={styles.itemSub}>{barber.specialty}</Text>
              </View>
              <Text style={styles.rating}>⭐ {barber.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.itemMeta}>Bugun: {barber.today_cuts} · Jami: {barber.total_cuts}</Text>
          </View>
        ))}
      </ScrollView>

      <Modal visible={isProfileOpen} animationType="slide" transparent onRequestClose={() => setIsProfileOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.profileModalCard, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.profileHeaderRow}>
              <Text style={styles.profileTitle}>Admin profili</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsProfileOpen(false)}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
            </View>

            {profileLoading ? (
              <View style={styles.profileLoadingWrap}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={[styles.profileBody, { paddingBottom: 24 + insets.bottom }]}>
                <View style={styles.avatarEditorWrap}>
                  <View style={styles.avatarRing}>
                    {profileAvatar ? (
                      <Image source={{ uri: profileAvatar }} style={styles.profileAvatarImage} />
                    ) : (
                      <Text style={styles.profileAvatarInitials}>{adminInitials}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.clearAvatarBtn} onPress={pickAvatarFromGallery}>
                    <Text style={styles.clearAvatarText}>Rasm qo‘sh</Text>
                  </TouchableOpacity>
                </View>

                <Field label="Ism" value={profileName} onChangeText={setProfileName} placeholder="Admin User" />
                <Field label="Email" value={profileEmail} onChangeText={setProfileEmail} keyboardType="email-address" placeholder="admin@test.com" />
                <Field label="Telefon" value={profilePhone} onChangeText={setProfilePhone} keyboardType="phone-pad" placeholder="998901234567" />
                <Field label="Yangi parol (ixtiyoriy)" value={profilePassword} onChangeText={setProfilePassword} secureTextEntry placeholder="Parolni yangilash uchun kiriting" />

                <TouchableOpacity style={styles.cancelProfileBtn} onPress={() => setIsProfileOpen(false)}>
                  <Text style={styles.cancelProfileText}>Bekor qilish</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveProfileBtn, profileSaving && { opacity: 0.7 }]} onPress={saveProfileEditor} disabled={profileSaving}>
                  <Text style={styles.saveProfileText}>{profileSaving ? "Saqlanmoqda..." : "Saqlash"}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        style={styles.fieldInput}
        placeholder={props.placeholder}
        placeholderTextColor="#90a0bf"
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

function QuickAction({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress}>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickHint}>{hint}</Text>
    </TouchableOpacity>
  );
}

function Loader() {
  return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}><Text style={styles.retryText}>Qayta urinish</Text></TouchableOpacity>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}> 
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ status }: { status: AdminBookingApi["status"] }) {
  const map = {
    pending: { bg: "#fef3c7", color: "#b45309", text: "Kutilmoqda" },
    completed: { bg: "#dcfce7", color: "#166534", text: "Bajarildi" },
    cancelled: { bg: "#fee2e2", color: "#b91c1c", text: "Bekor" },
  } as const;
  const style = map[status];
  return <Text style={[styles.badge, { backgroundColor: style.bg, color: style.color }]}>{style.text}</Text>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16, paddingTop: 10, gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  topTextWrap: { flex: 1 },
  topActions: { alignItems: "flex-end", gap: 8 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { color: panelTheme.heading, fontSize: 28, fontWeight: "900", marginTop: 4 },
  subtitle: { color: panelTheme.muted, fontSize: 14, marginTop: 6, marginBottom: 12 },
  avatarButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#f59e0b", marginTop: 2 },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarInitials: { color: "#fff", fontWeight: "900", fontSize: 16 },
  logoutMiniButton: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  logoutMiniText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 6 },
  quickCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  quickLabel: { color: panelTheme.heading, fontWeight: "900", fontSize: 15 },
  quickHint: { color: panelTheme.muted, marginTop: 4, fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, borderTopWidth: 4, borderColor: "#e5e7eb" },
  statValue: { fontSize: 28, fontWeight: "900", color: panelTheme.heading },
  statLabel: { fontSize: 13, color: panelTheme.muted, marginTop: 6 },
  revenueCard: { backgroundColor: "#fff", borderRadius: 22, padding: 18, marginVertical: 8, borderWidth: 1, borderColor: "#fcd34d" },
  revenueLabel: { color: "#6b7280", fontSize: 13 },
  revenueValue: { color: "#111827", fontSize: 28, fontWeight: "900", marginTop: 6 },
  revenueSub: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  metricCard: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  metricCardDark: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  metricLabel: { color: panelTheme.muted, fontSize: 12 },
  metricValue: { color: panelTheme.heading, fontSize: 20, fontWeight: "900", marginTop: 8 },
  metricSub: { color: panelTheme.muted, fontSize: 12, marginTop: 6 },
  metricLabelDark: { color: "#6b7280", fontSize: 12 },
  metricValueDark: { color: "#111827", fontSize: 20, fontWeight: "900", marginTop: 8 },
  metricSubDark: { color: "#6b7280", fontSize: 12, marginTop: 6 },
  chartCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  chartSub: { color: panelTheme.muted, fontSize: 12, marginBottom: 12 },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120 },
  chartColumn: { flex: 1, alignItems: "center" },
  chartStack: { width: 22, height: 84, justifyContent: "flex-end", gap: 4 },
  chartSegDone: { width: "100%", backgroundColor: panelTheme.blue, borderRadius: panelTheme.radius.pill },
  chartSegPending: { width: "100%", backgroundColor: "#cbd5e1", borderRadius: panelTheme.radius.pill },
  chartLabel: { color: panelTheme.muted, fontSize: 11, marginTop: 8 },
  sectionTitle: { color: panelTheme.heading, fontSize: 18, fontWeight: "900", marginTop: 18, marginBottom: 10 },
  listCard: { backgroundColor: "#fff", borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { color: panelTheme.heading, fontSize: 15, fontWeight: "800" },
  itemSub: { color: panelTheme.text, fontSize: 13, marginTop: 4 },
  itemMeta: { color: panelTheme.muted, fontSize: 12, marginTop: 6 },
  rating: { color: panelTheme.amber, fontWeight: "800" },
  badge: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  errorBox: { backgroundColor: "#fff1f2", borderRadius: 14, padding: 14, marginBottom: 14 },
  errorText: { color: "#be123c", marginBottom: 8 },
  retryBtn: { alignSelf: "flex-start", backgroundColor: panelTheme.dark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "flex-end" },
  profileModalCard: { backgroundColor: "#ffffff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "94%", borderTopWidth: 1, borderColor: "#e2e8f0" },
  profileHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  profileTitle: { color: "#0f172a", fontSize: 22, fontWeight: "900" },
  closeBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  closeBtnText: { color: "#475569", fontSize: 32, lineHeight: 34 },
  profileLoadingWrap: { paddingVertical: 38, alignItems: "center", justifyContent: "center" },
  profileBody: { paddingHorizontal: 16, paddingTop: 4 },
  avatarEditorWrap: { alignItems: "center", marginTop: 16, marginBottom: 12, backgroundColor: "#ffffff" },
  avatarRing: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: "#2563eb", alignItems: "center", justifyContent: "center", backgroundColor: "#eff6ff" },
  profileAvatarImage: { width: 116, height: 116, borderRadius: 58 },
  profileAvatarInitials: { color: "#1d4ed8", fontSize: 40, fontWeight: "900" },
  clearAvatarBtn: { marginTop: 12, backgroundColor: "#eef2ff", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: "#c7d2fe" },
  clearAvatarText: { color: "#1d4ed8", fontWeight: "700" },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: "#334155", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  fieldInput: { backgroundColor: "#f8fafc", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: "#0f172a", borderWidth: 1, borderColor: "#dbe3ef", fontSize: 17 },
  cancelProfileBtn: { marginTop: 14, borderRadius: 16, backgroundColor: "#e2e8f0", paddingVertical: 15, alignItems: "center" },
  cancelProfileText: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  saveProfileBtn: { marginTop: 12, borderRadius: 16, backgroundColor: "#3b82f6", paddingVertical: 15, alignItems: "center" },
  saveProfileText: { color: "#fff", fontSize: 20, fontWeight: "900" },
});
