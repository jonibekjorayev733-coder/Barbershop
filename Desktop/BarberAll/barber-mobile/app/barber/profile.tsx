import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getBarberProfile, updateBarberProfile } from "@/services/api";
import { panelTheme } from "@/constants/panel-theme";

export default function BarberProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const barberId = session?.user_id ?? 0;
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [specialty, setSpecialty] = useState("");
  const [directions, setDirections] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!barberId) return;
    const profile = await getBarberProfile(barberId);
    setName(profile.name || "");
    setEmail(profile.email || "");
    setSpecialty(profile.specialty || "");
    setDirections(profile.work_directions || "");
    setPrice(profile.service_price != null ? String(profile.service_price) : "");
    setDiscount(profile.discount_percent != null ? String(profile.discount_percent) : "0");
    setAddress(profile.location_address || "");
  }, [barberId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateBarberProfile(barberId, {
        name,
        email,
        specialty,
        work_directions: directions,
        service_price: price ? Number(price) : undefined,
        discount_percent: discount ? Number(discount) : undefined,
        location_address: address,
        password: password || undefined,
      });
      setPassword("");
      Alert.alert("Saqlandi", "Profil yangilandi");
    } catch (e: unknown) {
      Alert.alert("Xatolik", e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]}>
        <Text style={styles.eyebrow}>SHAXSIY MA'LUMOT</Text>
        <Text style={styles.title}>Barber Profili</Text>
        <Field label="Ism" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} />
        <Field label="Specialty" value={specialty} onChangeText={setSpecialty} />
        <Field label="Yo'nalishlar" value={directions} onChangeText={setDirections} multiline />
        <Field label="Narx" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Field label="Skidka %" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
        <Field label="Manzil" value={address} onChangeText={setAddress} multiline />
        <Field label="Yangi parol" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? "Saqlanmoqda..." : "Saqlash"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onLogout}>
          <Text style={styles.secondaryText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (text: string) => void; multiline?: boolean; secureTextEntry?: boolean; keyboardType?: "default" | "numeric" | "email-address"; }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} style={[styles.input, props.multiline && styles.multiline]} placeholderTextColor="#94a3b8" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panelTheme.page },
  content: { padding: 16 },
  eyebrow: { color: panelTheme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 28, fontWeight: "900", color: panelTheme.heading, marginBottom: 10, marginTop: 2 },
  fieldWrap: { marginBottom: 14 },
  label: { color: panelTheme.text, fontWeight: "800", marginBottom: 6 },
  input: { backgroundColor: panelTheme.surface, borderRadius: 14, borderWidth: 1, borderColor: panelTheme.border, paddingHorizontal: 14, paddingVertical: 12, color: panelTheme.heading },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  primaryBtn: { backgroundColor: panelTheme.dark, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8, shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  secondaryBtn: { backgroundColor: "#e2e8f0", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#cbd5e1" },
  secondaryText: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
});
