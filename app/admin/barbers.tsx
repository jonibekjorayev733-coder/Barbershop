import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { createAdminBarber, deleteAdminBarber, getAdminBarbers, updateAdminBarber, type AdminBarberApi, type AdminBarberUpdatePayload } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";

const EMPTY_FORM: AdminBarberUpdatePayload = {
  name: "",
  specialty: "",
  phone: "",
  rating: 4.8,
  total_cuts: 0,
  today_cuts: 0,
  status: "available",
  photo_url: "",
  years_experience: 1,
  username: "",
  password: "",
  bio: "",
};

export default function AdminBarbersScreen() {
  const insets = useSafeAreaInsets();
  const [barbers, setBarbers] = useState<AdminBarberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<AdminBarberApi | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminBarberUpdatePayload>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await getAdminBarbers();
      setBarbers(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Barberlar yuklanmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, [load]);

  const stats = useMemo(() => ({
    total: barbers.length,
    available: barbers.filter((barber) => barber.status === "available").length,
    busy: barbers.filter((barber) => barber.status === "busy").length,
    off: barbers.filter((barber) => barber.status === "off").length,
  }), [barbers]);

  const openEditor = (barber: AdminBarberApi) => {
    setSelectedBarber(barber);
    setIsEditorOpen(true);
    setForm({
      name: barber.name,
      specialty: barber.specialty,
      phone: barber.phone,
      rating: barber.rating,
      total_cuts: barber.total_cuts,
      today_cuts: barber.today_cuts,
      status: barber.status,
      photo_url: barber.photo_url ?? "",
      years_experience: barber.years_experience ?? 0,
      username: barber.username ?? "",
      password: "",
      bio: barber.bio ?? "",
    });
  };

  const openCreate = () => {
    setSelectedBarber(null);
    setForm(EMPTY_FORM);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) {
      return;
    }
    setSelectedBarber(null);
    setIsEditorOpen(false);
  };

  const saveBarber = async () => {
    if (!form.name.trim() || !form.specialty.trim() || !form.phone.trim()) {
      Alert.alert("Ma'lumot yetarli emas", "Ism, yo'nalish va telefonni kiriting.");
      return;
    }

    try {
      setSaving(true);
      if (selectedBarber) {
        await updateAdminBarber(selectedBarber.id, {
          ...form,
          name: form.name.trim(),
          specialty: form.specialty.trim(),
          phone: form.phone.trim(),
          username: form.username?.trim().toLowerCase(),
          password: form.password?.trim() || undefined,
          bio: form.bio?.trim() || undefined,
          photo_url: form.photo_url?.trim() || undefined,
        });
      } else {
        if (!form.username?.trim() || !form.password?.trim()) {
          Alert.alert("Ma'lumot yetarli emas", "Yangi sartarosh uchun email va parol majburiy.");
          setSaving(false);
          return;
        }
        await createAdminBarber({
          name: form.name.trim(),
          specialty: form.specialty.trim(),
          phone: form.phone.trim(),
          rating: Number(form.rating) || 4.8,
          total_cuts: Number(form.total_cuts) || 0,
          today_cuts: Number(form.today_cuts) || 0,
          status: form.status,
          photo_url: form.photo_url?.trim() || undefined,
          years_experience: Number(form.years_experience) || 1,
          username: form.username.trim().toLowerCase(),
          password: form.password.trim(),
          bio: form.bio?.trim() || undefined,
        });
      }

      await load();
      closeEditor();
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeBarber = (barber: AdminBarberApi) => {
    Alert.alert("Sartaroshni o‘chirish", `${barber.name} ni rostdan ham o‘chirasizmi?`, [
      { text: "Bekor", style: "cancel" },
      {
        text: "O‘chirish",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAdminBarber(barber.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Xatolik", e instanceof Error ? e.message : "O‘chirilmadi");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text style={styles.eyebrow}>JAMOA</Text>
        <Text style={styles.title}>Sartaroshlar</Text>
        <Text style={styles.subtitle}>{barbers.length} ta ro‘yxat</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Sartarosh qo‘shish</Text>
        </TouchableOpacity>
        <View style={styles.statsRow}>
          <StatPill label="Jami" value={stats.total} tone="#1d4ed8" bg="#dbeafe" />
          <StatPill label="Bo‘sh" value={stats.available} tone="#166534" bg="#dcfce7" />
          <StatPill label="Band" value={stats.busy} tone="#b45309" bg="#fef3c7" />
          <StatPill label="Off" value={stats.off} tone="#475569" bg="#e2e8f0" />
        </View>
        {loading ? <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {barbers.map((barber) => (
          <View key={barber.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.name}>{barber.name}</Text>
                <Text style={styles.spec}>{barber.specialty}</Text>
              </View>
              <StatusBadge status={barber.status} />
            </View>
            <Text style={styles.meta}>⭐ {barber.rating.toFixed(1)} · Tajriba: {barber.years_experience ?? 0} yil</Text>
            <Text style={styles.meta}>📞 {barber.phone}</Text>
            <Text style={styles.meta}>Bugun {barber.today_cuts} · Jami {barber.total_cuts}</Text>
            {!!barber.bio && <Text style={styles.bio}>{barber.bio}</Text>}
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, barber.today_cuts * 14)}%`, backgroundColor: barber.status === "available" ? "#2563eb" : barber.status === "busy" ? "#d97706" : "#94a3b8" }]} /></View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openEditor(barber)}><Text style={styles.secondaryBtnText}>Tahrirlash</Text></TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeBarber(barber)}><Text style={styles.deleteBtnText}>O‘chirish</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={isEditorOpen} animationType="slide" transparent onRequestClose={closeEditor}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedBarber ? "Sartaroshni tahrirlash" : "Yangi sartarosh qo‘shish"}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Ism" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
              <Field label="Yo‘nalish" value={form.specialty} onChangeText={(value) => setForm((current) => ({ ...current, specialty: value }))} />
              <Field label="Telefon" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} />
              <Field label="Email" value={form.username ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, username: value }))} />
              <Field label="Yangi parol" value={form.password ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} secureTextEntry />
              <Field label="Foto URL" value={form.photo_url ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, photo_url: value }))} />
              <Field label="Bio" value={form.bio ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, bio: value }))} multiline />
              <View style={styles.rowInputs}>
                <Field compact label="Reyting" value={String(form.rating)} keyboardType="numeric" onChangeText={(value) => setForm((current) => ({ ...current, rating: Number(value) || 0 }))} />
                <Field compact label="Tajriba" value={String(form.years_experience ?? 0)} keyboardType="numeric" onChangeText={(value) => setForm((current) => ({ ...current, years_experience: Number(value) || 0 }))} />
              </View>
              <View style={styles.rowInputs}>
                <Field compact label="Bugun" value={String(form.today_cuts)} keyboardType="numeric" onChangeText={(value) => setForm((current) => ({ ...current, today_cuts: Number(value) || 0 }))} />
                <Field compact label="Jami" value={String(form.total_cuts)} keyboardType="numeric" onChangeText={(value) => setForm((current) => ({ ...current, total_cuts: Number(value) || 0 }))} />
              </View>
              <Text style={styles.fieldLabel}>Holat</Text>
              <View style={styles.statusRow}>
                {(["available", "busy", "off"] as const).map((status) => (
                  <TouchableOpacity key={status} style={[styles.statusChip, form.status === status && styles.statusChipActive]} onPress={() => setForm((current) => ({ ...current, status }))}>
                    <Text style={[styles.statusChipText, form.status === status && styles.statusChipTextActive]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={closeEditor} disabled={saving}><Text style={styles.secondaryBtnText}>Bekor</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={saveBarber} disabled={saving}><Text style={styles.primaryBtnText}>{saving ? "Saqlanmoqda..." : "Saqlash"}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatPill({ label, value, tone, bg }: { label: string; value: number; tone: string; bg: string }) {
  return <Text style={[styles.statPill, { color: tone, backgroundColor: bg }]}>{label}: {value}</Text>;
}

function StatusBadge({ status }: { status: AdminBarberApi["status"] }) {
  const config = status === "available"
    ? { bg: "#dcfce7", color: "#166534", label: "AVAILABLE" }
    : status === "busy"
      ? { bg: "#fef3c7", color: "#92400e", label: "BUSY" }
      : { bg: "#e2e8f0", color: "#475569", label: "OFF" };

  return <Text style={[styles.statusBadge, { backgroundColor: config.bg, color: config.color }]}>{config.label}</Text>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; secureTextEntry?: boolean; keyboardType?: "default" | "numeric" | "email-address"; compact?: boolean }) {
  return (
    <View style={[styles.fieldWrap, props.compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        multiline={props.multiline}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginTop: 2 },
  subtitle: { color: panelTheme.muted, marginTop: 4, marginBottom: 16 },
  addBtn: { alignSelf: "flex-start", backgroundColor: "#111827", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12 },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statPill: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontWeight: "900", overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0", fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e8edf5", boxShadow: "0px 4px 10px rgba(15, 23, 42, 0.06)", elevation: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 24, fontWeight: "900", color: panelTheme.heading },
  spec: { color: panelTheme.text, marginTop: 4, fontSize: 15 },
  meta: { color: "#64748b", marginTop: 7, fontSize: 15 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, fontWeight: "900", fontSize: 11, overflow: "hidden", letterSpacing: 0.4 },
  bio: { color: panelTheme.text, marginTop: 8, lineHeight: 20, fontSize: 14 },
  progressTrack: { height: 12, backgroundColor: "#e2e8f0", borderRadius: 999, marginTop: 12, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: panelTheme.radius.pill, backgroundColor: panelTheme.blue },
  actions: { flexDirection: "row", gap: 12, marginTop: 14 },
  secondaryBtn: { flex: 1, borderRadius: 18, backgroundColor: "#dfe6f0", paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: "#111827", fontWeight: "900", fontSize: 16 },
  deleteBtn: { flex: 1, borderRadius: 18, backgroundColor: "#fde2e2", paddingVertical: 14, alignItems: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "900", fontSize: 16 },
  errorText: { color: "#b91c1c", marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "88%" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: panelTheme.heading, marginBottom: 12 },
  fieldWrap: { marginBottom: 12 },
  fieldCompact: { flex: 1 },
  fieldLabel: { color: panelTheme.text, fontWeight: "800", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: panelTheme.heading, backgroundColor: panelTheme.surface },
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
  rowInputs: { flexDirection: "row", gap: 10 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  statusChip: { borderRadius: panelTheme.radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#e2e8f0" },
  statusChipActive: { backgroundColor: panelTheme.dark },
  statusChipText: { color: panelTheme.text, fontWeight: "800" },
  statusChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12, paddingBottom: 10 },
  primaryBtn: { flex: 1, borderRadius: panelTheme.radius.sm, backgroundColor: panelTheme.dark, paddingVertical: 11, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
});
