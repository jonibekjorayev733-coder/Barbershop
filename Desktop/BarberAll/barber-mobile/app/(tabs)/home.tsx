import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getBarbers, UserBookingBarberApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const accent = "#f59e0b";
const pageBg = "#f5f5f5";
const cardBg = "#ffffff";
const textDark = "#171717";
const textMuted = "#737373";

export default function HomeScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [barbers, setBarbers] = useState<UserBookingBarberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchBarbers = useCallback(async () => {
    try {
      setError(null);
      const data = await getBarbers();
      setBarbers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  const filtered = barbers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.specialty.toLowerCase().includes(search.toLowerCase())
  );

  const averageRating = filtered.length
    ? (filtered.reduce((sum, item) => sum + item.rating, 0) / filtered.length).toFixed(1)
    : "0.0";

  const maxExperience = filtered.length
    ? Math.max(...filtered.map((item) => item.years_experience || 0))
    : 0;

  const featuredBarber = [...filtered].sort(
    (a, b) => b.rating - a.rating || (b.total_cuts ?? 0) - (a.total_cuts ?? 0)
  )[0];

  const specialists = filtered.slice(0, 8);

  const renderStars = (rating: number) => {
    return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  };

  const renderItem = ({ item }: { item: UserBookingBarberApi }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/user/booking",
          params: { barberId: item.id, barberName: item.name },
        })
      }
      activeOpacity={0.85}
    >
      <View style={styles.cardLeft}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        {item.status === "available" && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.barberName}>{item.name}</Text>
        <Text style={styles.specialty}>{item.specialty}</Text>

        <View style={styles.row}>
          <Text style={styles.stars}>{renderStars(item.rating)}</Text>
          <Text style={styles.ratingNum}>{item.rating.toFixed(1)}</Text>
        </View>

        {item.barbershop_name && (
          <Text style={styles.shopName}>📍 {item.barbershop_name}</Text>
        )}

        {item.distance_km != null && (
          <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
        )}
      </View>

      <View style={styles.cardRight}>
        {item.service_price != null && (
          <Text style={styles.price}>
            {Math.round(item.service_price).toLocaleString("uz-UZ")}{"\n"}
            <Text style={styles.currency}>so'm</Text>
          </Text>
        )}
        {item.discount_percent != null && item.discount_percent > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{Math.round(item.discount_percent)}%</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() =>
            router.push({
              pathname: "/user/booking",
              params: { barberId: item.id, barberName: item.name },
            })
          }
        >
          <Text style={styles.bookBtnText}>›</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerEyebrow}>Xush kelibsiz</Text>
          <Text style={styles.headerTitle}>{session?.name ? `${session.name.split(" ")[0]},` : "Mijoz,"} xizmatni tanlang</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Text style={styles.iconText}>✦</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search specialist or service"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.quickStats}>
        <Pill text={`${filtered.length} experts`} />
        <Pill text={`⭐ ${averageRating}`} />
        <Pill text={`${maxExperience}+ yrs`} />
      </View>

      <Text style={styles.sectionTitle}>Choose Specialist</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specialistRow}>
        {specialists.map((item) => (
          <TouchableOpacity
            key={`sp-${item.id}`}
            style={styles.specialistCard}
            onPress={() =>
              router.push({
                pathname: "/user/booking",
                params: { barberId: item.id, barberName: item.name },
              })
            }
          >
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.specialistAvatar} />
            ) : (
              <View style={styles.specialistFallback}>
                <Text style={styles.specialistFallbackText}>{item.name[0]?.toUpperCase() ?? "S"}</Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.specialistName}>{item.name}</Text>
            <Text style={styles.specialistMeta}>{Math.max(1, item.years_experience || 1)} yrs</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Salon va mutaxassislar</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={accent} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBarbers}>
            <Text style={styles.retryText}>Qayta urinish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 106 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchBarbers();
              }}
              colors={[accent]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Sartarosh topilmadi</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pageBg, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, paddingBottom: 12 },
  headerEyebrow: { fontSize: 12, fontWeight: "800", color: textMuted, textTransform: "uppercase", letterSpacing: 0.7 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: textDark, marginTop: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: cardBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  iconText: { fontSize: 16, color: textMuted, fontWeight: "800" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cardBg,
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchIcon: { fontSize: 16, marginRight: 8, color: textMuted },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: textDark },
  quickStats: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pill: { backgroundColor: "#fff7ed", borderColor: "#fed7aa", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { color: "#9a3412", fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: textDark, marginBottom: 10, marginTop: 2 },
  specialistRow: { gap: 10, paddingBottom: 12 },
  specialistCard: { width: 86, alignItems: "center" },
  specialistAvatar: { width: 70, height: 70, borderRadius: 20 },
  specialistFallback: { width: 70, height: 70, borderRadius: 20, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  specialistFallbackText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  specialistName: { color: textDark, fontSize: 12, fontWeight: "700", marginTop: 6 },
  specialistMeta: { color: textMuted, fontSize: 11, marginTop: 2 },
  list: { paddingBottom: 24 },
  card: {
    flexDirection: "row",
    backgroundColor: cardBg,
    borderRadius: 20,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e7eaf0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardLeft: { position: "relative", marginRight: 12 },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#eee" },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#34a853",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cardContent: { flex: 1 },
  barberName: { fontSize: 18, fontWeight: "800", color: textDark },
  specialty: { fontSize: 12, color: textMuted, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  stars: { color: "#f4b942", fontSize: 13 },
  ratingNum: { fontSize: 12, color: "#888", marginLeft: 4 },
  shopName: { fontSize: 12, color: textMuted, marginTop: 4 },
  distance: { fontSize: 12, color: textMuted, marginTop: 2 },
  cardRight: { alignItems: "flex-end", justifyContent: "space-between" },
  price: { fontSize: 14, fontWeight: "700", color: textDark, textAlign: "right" },
  currency: { fontSize: 11, fontWeight: "400", color: "#888" },
  discountBadge: {
    backgroundColor: accent,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  bookBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: -1 },
  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#ea4335", fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: {
    backgroundColor: accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#999", marginTop: 40, fontSize: 15 },
});

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}
