import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "@/context/AuthContext";
import { getBarberProfile, updateBarberProfile } from "@/services/api";
import { barberDesign } from "@/constants/barber-design";

const { width: SW } = Dimensions.get("window");
const { colors, card, radii, spacing, shadows, typography, button } = barberDesign;

//  Specialty options 
const SPECIALTIES = [
  { id: "soch", label: "Soch kesish", icon: "cut" },
  { id: "soqol", label: "Soqol olish", icon: "man" },
  { id: "bola", label: "Bola soch", icon: "happy" },
  { id: "dizayn", label: "Soch dizayn", icon: "color-wand" },
  { id: "boy", label: "Bo'yash", icon: "color-palette" },
  { id: "klassik", label: "Klassik", icon: "star" },
  { id: "zamonaviy", label: "Zamonaviy", icon: "flash" },
  { id: "sport", label: "Sport soch", icon: "fitness" },
];

//  Section wrapper 
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.sectionIconBg}>
          <Ionicons name={icon as any} size={16} color={colors.goldAlt} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

//  Single input row 
function Row({
  label,
  value,
  onChange,
  icon,
  keyboard,
  secure,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
  keyboard?: any;
  secure?: boolean;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.rowWrap}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={[s.rowInput, focused ? s.rowInputFocused : null, multiline ? { height: 72, alignItems: "flex-start" as const } : null]}>
        <Ionicons name={icon as any} size={17} color={focused ? colors.goldAlt : colors.muted} style={{ marginTop: multiline ? 2 : 0 }} />
        <TextInput
          style={[s.input, multiline ? { textAlignVertical: "top" as const } : null]}
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={colors.muted}
          keyboardType={keyboard}
          secureTextEntry={secure}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

//  Map picker modal 
function MapModal({
  visible,
  lat,
  lng,
  address,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  lat: number | null;
  lng: number | null;
  address: string;
  onConfirm: (lat: number, lng: number, addr: string) => void;
  onClose: () => void;
}) {
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(
    typeof lat === "number" && typeof lng === "number" ? { latitude: lat, longitude: lng } : null
  );
  const [locating, setLocating] = useState(false);
  const [addr, setAddr] = useState(address);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setMarker(typeof lat === "number" && typeof lng === "number" ? { latitude: lat, longitude: lng } : null);
    setAddr(address || "");
  }, [address, lat, lng, visible]);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.district, r.city, r.region, r.postalCode, r.country].filter(Boolean);
        setAddr(parts.join(", "));
      }
    } catch {
      setAddr(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
  };

  const onPress = async (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    if (!Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) {
      Alert.alert("Xatolik", "Koordinata noto'g'ri qaytdi. Qayta urinib ko'ring.");
      return;
    }
    setMarker(coord);
    await reverseGeocode(coord.latitude, coord.longitude);
  };

  const gotoMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ruxsat kerak", "Joylashuv ruxsatini bering");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMarker(coord);
      await reverseGeocode(coord.latitude, coord.longitude);
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!marker) { Alert.alert("Xaritada joy belgilang"); return; }
    onConfirm(marker.latitude, marker.longitude, addr);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={ms.topBar}>
          <TouchableOpacity onPress={onClose} style={ms.topBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={ms.topTitle}>Joylashuvni belgilang</Text>
          <TouchableOpacity onPress={confirm} style={ms.topConfirm}>
            <Text style={ms.topConfirmText}>Saqlash</Text>
          </TouchableOpacity>
        </View>

        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: marker?.latitude ?? 39.7747,
            longitude: marker?.longitude ?? 64.4286,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={onPress}
          showsUserLocation
          showsMyLocationButton={false}
          mapType="standard"
        >
          {marker && <Marker coordinate={marker} pinColor={colors.goldAlt} />}
        </MapView>

        <View style={ms.bottomBar}>
          <TouchableOpacity style={ms.myLocBtn} onPress={gotoMyLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator size="small" color={colors.goldAlt} />
              : <Ionicons name="locate" size={22} color={colors.goldAlt} />}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ms.addrLabel}>Tanlangan manzil</Text>
            <Text style={ms.addrText} numberOfLines={2}>{addr || "Xaritada bosing..."}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

//  Price/Discount modal 
function PriceModal({
  visible,
  price,
  discount,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  price: string;
  discount: string;
  onConfirm: (p: string, d: string) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(price);
  const [d, setD] = useState(discount);
  useEffect(() => { setP(price); setD(discount); }, [price, discount, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={pm.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={pm.sheet}>
        <LinearGradient colors={[card.bg, card.bgAlt ?? card.bg]} style={pm.inner}>
          <View style={pm.handle} />
          <Text style={pm.title}>Narx va Chegirma</Text>

          <Text style={pm.label}>Xizmat narxi (so&apos;m)</Text>
          <View style={pm.inputRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.goldAlt} />
            <TextInput style={pm.input} value={p} onChangeText={setP} keyboardType="numeric" placeholder="Masalan: 60000" placeholderTextColor={colors.muted} />
          </View>

          <Text style={pm.label}>Chegirma (%)</Text>
          <View style={pm.inputRow}>
            <Ionicons name="gift-outline" size={18} color={colors.teal} />
            <TextInput style={pm.input} value={d} onChangeText={setD} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} />
          </View>

          {p || d ? (
            <View style={pm.preview}>
              <Text style={pm.previewText}>
                {p ? `${Number(p).toLocaleString()} so'm` : ""}
                {p && d && Number(d) > 0 ? "    " : ""}
                {d && Number(d) > 0 && p ? `${Math.round(Number(p) * (1 - Number(d) / 100)).toLocaleString()} so'm (${d}% off)` : ""}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={pm.saveBtn} onPress={() => { onConfirm(p, d); onClose(); }} activeOpacity={0.8}>
            <LinearGradient colors={[colors.gold, colors.goldLight ?? colors.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pm.saveBtnGrad}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.bg} />
              <Text style={pm.saveBtnText}>Saqlash</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

//  Password change modal 
function PasswordModal({ visible, onConfirm, onClose }: { visible: boolean; onConfirm: (p: string) => void; onClose: () => void }) {
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={pm.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={pm.sheet}>
        <LinearGradient colors={[card.bg, card.bgAlt ?? card.bg]} style={pm.inner}>
          <View style={pm.handle} />
          <Text style={pm.title}>Yangi Parol</Text>
          <Text style={pm.label}>Yangi parol</Text>
          <View style={pm.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              style={[pm.input, { flex: 1 }]}
              value={val}
              onChangeText={setVal}
              placeholder="Kamida 8 ta belgi"
              placeholderTextColor={colors.muted}
              secureTextEntry={!show}
            />
            <TouchableOpacity onPress={() => setShow(!show)}>
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[pm.saveBtn, (!val || val.length < 6) ? { opacity: 0.5 } : null]}
            onPress={() => { if (!val || val.length < 6) { Alert.alert("Kamida 6 ta belgi kiriting"); return; } onConfirm(val); setVal(""); onClose(); }}
            activeOpacity={0.8}
            disabled={!val || val.length < 6}
          >
            <LinearGradient colors={[colors.gold, colors.goldLight ?? colors.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pm.saveBtnGrad}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.bg} />
              <Text style={pm.saveBtnText}>Yangilash</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

//  MAIN SCREEN 
export default function BarberProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const barberId = session?.user_id ?? 0;

  const [name, setName] = useState(session?.name ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(session?.email ?? "");
  const [specialty, setSpecialty] = useState("");
  const [directions, setDirections] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMap, setShowMap] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    if (!barberId) return;
    const p = await getBarberProfile(barberId);
    setName(p.name ?? "");
    setEmail(p.email ?? "");
    setSpecialty(p.specialty ?? "");
    setDirections(p.work_directions ? p.work_directions.split(",").map((x) => x.trim()).filter(Boolean) : []);
    setPrice(p.service_price != null ? String(p.service_price) : "");
    setDiscount(p.discount_percent != null ? String(p.discount_percent) : "0");
    setAddress(p.location_address ?? "");
    setLat(p.location_latitude ?? null);
    setLng(p.location_longitude ?? null);
  }, [barberId]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const toggleDirection = (val: string) => {
    setDirections((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  };

  const onSave = async () => {
    try {
      setSaving(true);
      await updateBarberProfile(barberId, {
        name,
        email,
        specialty,
        work_directions: directions.join(", "),
        service_price: price ? Number(price) : undefined,
        discount_percent: discount ? Number(discount) : undefined,
        location_address: address,
        location_latitude: lat ?? undefined,
        location_longitude: lng ?? undefined,
        password: password || undefined,
      });
      setPassword("");
      Alert.alert(" Saqlandi", "Profil muvaffaqiyatli yangilandi");
    } catch (e: unknown) {
      Alert.alert(" Xatolik", e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    Alert.alert("Chiqish", "Hisobdan chiqmoqchimisiz?", [
      { text: "Bekor qilish" },
      { text: "Chiqish", style: "destructive", onPress: async () => { await signOut(); router.replace("/(auth)/login"); } },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/*  Header  */}
      <View style={s.topBar}>
        <View style={s.avatar}>
          <Ionicons name="person" size={28} color={colors.goldAlt} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.topName}>{name || "Barber"}</Text>
          <Text style={s.topSub}>{email || "Profil sozlamalari"}</Text>
        </View>
        <TouchableOpacity onPress={onSave} disabled={saving} style={[s.saveTopBtn, saving ? { opacity: 0.6 } : null]}>
          {saving ? <ActivityIndicator size="small" color={colors.goldAlt} /> : <Text style={s.saveTopText}>Saqlash</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>

        {/* 1. ASOSIY MA'LUMOTLAR */}
        <Section title="Asosiy ma'lumotlar" icon="person-outline">
          <Row label="Ism Familiya" value={name} onChange={setName} icon="person-outline" />
          <Row label="Telefon" value={phone} onChange={setPhone} icon="call-outline" keyboard="phone-pad" />
          <Row label="Email" value={email} onChange={setEmail} icon="mail-outline" keyboard="email-address" />
        </Section>

        {/* 2. MUTAXASSISLIK */}
        <Section title="Mutaxassislik" icon="cut-outline">
          <Text style={s.subLabel}>Asosiy yo&apos;nalish</Text>
          <FlatList
            data={SPECIALTIES}
            keyExtractor={(i) => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            renderItem={({ item }) => {
              const active = specialty === item.id;
              return (
                <TouchableOpacity
                  style={[s.specCard, active ? s.specCardActive : null]}
                  onPress={() => setSpecialty(active ? "" : item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.specIcon, active ? { backgroundColor: `${colors.goldAlt}25` } : null]}>
                    <Ionicons name={item.icon as any} size={20} color={active ? colors.goldAlt : colors.muted} />
                  </View>
                  <Text style={[s.specLabel, active ? { color: colors.goldAlt } : null]}>{item.label}</Text>
                  {active && <View style={s.specCheck}><Ionicons name="checkmark-circle" size={14} color={colors.goldAlt} /></View>}
                </TouchableOpacity>
              );
            }}
          />

          <Text style={[s.subLabel, { marginTop: spacing.lg }]}>Qo&apos;shimcha yo&apos;nalishlar</Text>
          <View style={s.directionGrid}>
            {SPECIALTIES.map((item) => {
              const active = directions.includes(item.id);
              return (
                <TouchableOpacity key={item.id} style={[s.dirChip, active ? s.dirChipActive : null]} onPress={() => toggleDirection(item.id)} activeOpacity={0.7}>
                  <Ionicons name={item.icon as any} size={13} color={active ? colors.goldAlt : colors.muted} />
                   <Text style={[s.dirChipText, active ? { color: colors.goldAlt } : null]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* 3. NARX VA CHEGIRMA */}
        <Section title="Narx va Chegirma" icon="pricetag-outline">
          <TouchableOpacity style={s.settingRow} onPress={() => setShowPrice(true)} activeOpacity={0.7}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: `${colors.goldAlt}20` }]}>
                <Ionicons name="cash-outline" size={18} color={colors.goldAlt} />
              </View>
              <View>
                <Text style={s.settingLabel}>Xizmat narxi</Text>
                <Text style={s.settingValue}>{price ? `${Number(price).toLocaleString()} so'm` : "Belgilanmagan"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.settingRow} onPress={() => setShowPrice(true)} activeOpacity={0.7}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: `${colors.teal}20` }]}>
                <Ionicons name="gift-outline" size={18} color={colors.teal} />
              </View>
              <View>
                <Text style={s.settingLabel}>Chegirma</Text>
                <Text style={s.settingValue}>{discount && Number(discount) > 0 ? `${discount}%` : "Yo'q"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </Section>

        {/* 4. LOKATSIYA */}
        <Section title="Lokatsiya" icon="location-outline">
          {lat && lng ? (
            <TouchableOpacity onPress={() => setShowMap(true)} activeOpacity={0.85} style={s.mapPreview}>
              <LinearGradient
                colors={["#111827", "#1f2937"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.mapPreviewMap}
              >
                <Ionicons name="location" size={22} color={colors.goldAlt} />
                <Text style={s.mapPreviewTitle}>Joylashuv saqlangan</Text>
                <Text style={s.mapPreviewAddress} numberOfLines={2}>{address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</Text>
              </LinearGradient>
              <View style={s.mapPreviewOverlay}>
                <Ionicons name="pencil" size={14} color="#fff" />
                <Text style={s.mapPreviewEdit}>O&apos;zgartirish</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={[s.settingRow, lat && lng ? { marginTop: spacing.md } : null]} onPress={() => setShowMap(true)} activeOpacity={0.7}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: `${colors.danger}20` }]}>
                <Ionicons name="map-outline" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={s.settingLabel}>{lat && lng ? "Xaritada o'zgartirish" : "Xaritada belgilash"}</Text>
                <Text style={s.settingValue} numberOfLines={2}>{address || "Hali belgilanmagan"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </Section>

        {/* 5. XAVFSIZLIK */}
        <Section title="Xavfsizlik" icon="shield-checkmark-outline">
          <TouchableOpacity style={s.settingRow} onPress={() => setShowPassword(true)} activeOpacity={0.7}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: `${colors.info}20` }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.info} />
              </View>
              <View>
                <Text style={s.settingLabel}>Parolni o&apos;zgartirish</Text>
                <Text style={s.settingValue}>Yangi parol o&apos;rnatish</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </Section>

        {/* 6. CHIQISH */}
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={s.logoutText}>Hisobdan chiqish</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modals */}
      <MapModal
        visible={showMap}
        lat={lat}
        lng={lng}
        address={address}
        onConfirm={(la, lo, ad) => { setLat(la); setLng(lo); setAddress(ad); }}
        onClose={() => setShowMap(false)}
      />
      <PriceModal
        visible={showPrice}
        price={price}
        discount={discount}
        onConfirm={(p, d) => { setPrice(p); setDiscount(d); }}
        onClose={() => setShowPrice(false)}
      />
      <PasswordModal
        visible={showPassword}
        onConfirm={(p) => setPassword(p)}
        onClose={() => setShowPassword(false)}
      />
    </SafeAreaView>
  );
}

//  Styles 
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: card.border,
    gap: spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${colors.goldAlt}15`,
    borderWidth: 2,
    borderColor: `${colors.goldAlt}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  topName: { ...typography.bodyLg, fontWeight: "700", color: colors.text },
  topSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  saveTopBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: `${colors.goldAlt}20`,
    borderWidth: 1,
    borderColor: `${colors.goldAlt}40`,
  },
  saveTopText: { ...typography.caption, color: colors.goldAlt, fontWeight: "700" },

  section: {
    marginTop: spacing.xl,
    backgroundColor: card.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: card.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: card.border,
    backgroundColor: `${colors.goldAlt}08`,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: `${colors.goldAlt}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...typography.bodyLg, fontWeight: "700", color: colors.text },
  sectionBody: { padding: spacing.lg },

  rowWrap: { marginBottom: spacing.lg },
  rowLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: "600" },
  rowInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: `${colors.goldAlt}08`,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: card.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  rowInputFocused: { borderColor: `${colors.goldAlt}60`, backgroundColor: `${colors.goldAlt}12` },
  input: { flex: 1, ...typography.body, color: colors.text },

  subLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600", marginBottom: spacing.md },

  specCard: {
    width: 90,
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: `${colors.muted}12`,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  specCardActive: { borderColor: `${colors.goldAlt}60`, backgroundColor: `${colors.goldAlt}08` },
  specIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.muted}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  specLabel: { ...typography.caption, color: colors.muted, textAlign: "center", fontWeight: "600" },
  specCheck: { position: "absolute", top: 4, right: 4 },

  directionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  dirChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: `${colors.muted}15`,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dirChipActive: { borderColor: `${colors.goldAlt}50`, backgroundColor: `${colors.goldAlt}10` },
  dirChipText: { ...typography.caption, color: colors.muted, fontWeight: "600" },

  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { ...typography.body, color: colors.text, fontWeight: "600" },
  settingValue: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: card.border, marginVertical: spacing.sm },

  mapPreview: { borderRadius: radii.md, overflow: "hidden", height: 140, marginBottom: spacing.sm, position: "relative" },
  mapPreviewMap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  mapPreviewTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
  mapPreviewAddress: { ...typography.caption, color: colors.textSecondary, maxWidth: "88%" },
  mapPreviewOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mapPreviewEdit: { color: "#fff", fontSize: 12, fontWeight: "700" },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: `${colors.danger}12`,
    borderWidth: 1,
    borderColor: `${colors.danger}30`,
  },
  logoutText: { ...typography.bodyLg, color: colors.danger, fontWeight: "700" },
});

//  Modal Styles 
const ms = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: card.border,
    backgroundColor: colors.bg,
  },
  topBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { ...typography.h3, color: colors.text },
  topConfirm: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.goldAlt,
  },
  topConfirmText: { ...typography.body, color: colors.bg, fontWeight: "700" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: card.border,
  },
  myLocBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.goldAlt}15`,
    borderWidth: 1,
    borderColor: `${colors.goldAlt}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  addrLabel: { ...typography.caption, color: colors.muted, marginBottom: 2 },
  addrText: { ...typography.body, color: colors.text, fontWeight: "600" },
});

const pm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0 },
  inner: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, alignSelf: "center", marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xl },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600", marginBottom: spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: `${colors.goldAlt}08`,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: card.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 48,
  },
  input: { flex: 1, ...typography.body, color: colors.text },
  preview: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: `${colors.teal}12`,
    marginBottom: spacing.lg,
  },
  previewText: { ...typography.body, color: colors.teal, fontWeight: "700", textAlign: "center" },
  saveBtn: { borderRadius: radii.full, overflow: "hidden", marginTop: spacing.md },
  saveBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.lg },
  saveBtnText: { ...typography.bodyLg, color: colors.bg, fontWeight: "800" },
});