import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { getBarbers, UserBookingBarberApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useLanguage } from "@/context/LanguageContext";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { userDesign } from "@/constants/user-design";

const accent = userDesign.accent;
const accentStrong = userDesign.accentStrong;
const pageBg = userDesign.page;
const cardBg = userDesign.card;
const cardBgAlt = userDesign.cardSoft;
const textDark = userDesign.text;
const textMuted = userDesign.textMuted;
const successColor = userDesign.success;

type HomeFilter = "nearby" | "cheap";

const apiRetry = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 500
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < maxRetries) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
};

export default function HomeScreen() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const canUseNativeDriver = Platform.OS !== "web";
  const swipeTabs = useTabSwipeNavigation("home");

  const [barbers, setBarbers] = useState<UserBookingBarberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<HomeFilter>("nearby");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: canUseNativeDriver,
    }).start();
  }, [canUseNativeDriver, fadeAnim]);

  const fetchBarbers = useCallback(async (forcedCoords?: { lat: number; lng: number } | null) => {
    try {
      setError(null);
      const activeCoords = forcedCoords ?? coords;
      const params =
        filterMode === "nearby" && activeCoords
          ? { lat: activeCoords.lat, lng: activeCoords.lng, nearOnly: true, maxDistanceKm: 15 }
          : { nearOnly: false };

      const data = await apiRetry(() => getBarbers(params));
      setBarbers(data || []);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : t("noBarberFound");
      setError(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coords, filterMode, t]);

  const requestLocationAndLoad = useCallback(async () => {
    try {
      setLocationLoading(true);
      setError(null);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError(t("locationPermissionRequired"));
        await fetchBarbers(null);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCoords = { lat: current.coords.latitude, lng: current.coords.longitude };
      setCoords(nextCoords);
      await fetchBarbers(nextCoords);
    } catch {
      setError(t("locationLoadError"));
      await fetchBarbers(null);
    } finally {
      setLocationLoading(false);
    }
  }, [fetchBarbers, t]);

  useEffect(() => {
    if (filterMode === "nearby" && !coords) {
      void requestLocationAndLoad();
    } else {
      void fetchBarbers();
    }
  }, [coords, fetchBarbers, filterMode, requestLocationAndLoad]);

  useWebSocket("/ws/events/public-map", {
    token: "public",
    enabled: true,
    onMessage: useCallback(() => {
      fetchBarbers();
    }, [fetchBarbers]),
  });

  const filtered = useMemo(
    () =>
      barbers.filter(
        (barber) =>
          barber.name.toLowerCase().includes(search.toLowerCase()) ||
          barber.specialty.toLowerCase().includes(search.toLowerCase())
      ),
    [barbers, search]
  );

  const ordered = useMemo(() => {
    const cloned = [...filtered];
    cloned.sort((first, second) => {
      if (filterMode === "cheap") {
        return (first.service_price ?? 999999) - (second.service_price ?? 999999);
      }
      return (first.distance_km ?? 999) - (second.distance_km ?? 999);
    });
    return cloned;
  }, [filtered, filterMode]);

  const specialists = ordered.slice(0, 10);
  const avgRating =
    ordered.length > 0
      ? (ordered.reduce((sum, item) => sum + item.rating, 0) / ordered.length).toFixed(1)
      : "0.0";

  const availableCount = ordered.filter((item) => item.status === "available").length;

  const openBookingWithBarber = useCallback((item: UserBookingBarberApi) => {
    router.push({ pathname: "/user/booking", params: { barberId: item.id, barberName: item.name } });
  }, []);

  const openQuickBook = useCallback(() => {
    const topBarber = ordered[0];
    if (topBarber) {
      openBookingWithBarber(topBarber);
      return;
    }
    router.push("/user/mybookings");
  }, [openBookingWithBarber, ordered]);

  const onRefreshList = useCallback(() => {
    setRefreshing(true);
    void fetchBarbers();
  }, [fetchBarbers]);

  const renderItem = useCallback(({ item }: { item: UserBookingBarberApi }) => (
    <TouchableOpacity
      style={styles.barberCard}
      onPress={() => openBookingWithBarber(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{item.name[0]}</Text>
          </View>
        )}
        {item.status === "available" && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.cardMiddle}>
        <Text style={styles.barberName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.specialty} numberOfLines={1}>
          {item.specialty}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#fbbf24" />
          <Text style={styles.ratingNum}>{item.rating.toFixed(1)}</Text>
          {item.distance_km != null ? (
            <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.price}>{Math.round(item.service_price || 0).toLocaleString("uz-UZ")}</Text>
        <Text style={styles.currency}>so&apos;m</Text>
        {item.discount_percent ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{Math.round(item.discount_percent)}%</Text>
          </View>
        ) : null}
        <View style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={16} color="#ffffff" />
        </View>
      </View>
    </TouchableOpacity>
  ), [openBookingWithBarber]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} {...swipeTabs.panHandlers}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={ordered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponentStyle={styles.listHeader}
          ListHeaderComponent={
            <>
              <View style={styles.heroCard}>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.headerEyebrow}>{t("welcome")}</Text>
                    <Text style={styles.headerTitle} numberOfLines={2}>
                      {session?.name?.split(" ")[0] || t("customer")}, {t("chooseService")}
                    </Text>
                  </View>
                </View>

                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={accent} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t("searchSpecialist")}
                    placeholderTextColor="#64748b"
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <StatPill icon="people-outline" text={`${filtered.length} ${t("experts")}`} />
                <StatPill icon="star-outline" text={avgRating} />
                <StatPill icon="checkmark-circle-outline" text={`${availableCount} ${t("online")}`} />
              </View>

              <LinearGradient
                colors={["#131313", "#1f1f1f", "#2a2a2a"]}
                start={[0, 0]}
                end={[1, 1]}
                style={styles.promoCard}
              >
                <View style={styles.promoTop}>
                  <Text style={styles.promoLabel}>{t("premiumClub")}</Text>
                  <View style={styles.promoBadge}>
                    <Ionicons name="flash" size={12} color="#fde68a" />
                    <Text style={styles.promoBadgeText}>{t("fastBooking")}</Text>
                  </View>
                </View>
                <Text style={styles.promoTitle}>{t("premiumPromoTitle")}</Text>
                <Text style={styles.promoSub}>{t("premiumPromoSub")}</Text>
                <TouchableOpacity style={styles.promoBtn} onPress={openQuickBook} activeOpacity={0.7}>
                  <Text style={styles.promoBtnText}>{t("bookNow")}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </TouchableOpacity>
              </LinearGradient>

              <Text style={styles.sectionTitleSmall}>{t("quickActions")}</Text>
              <View style={styles.quickActionsGrid}>
                <QuickActionButton icon="add-circle-outline" label={t("newBooking")} onPress={openQuickBook} />
                <QuickActionButton icon="list-outline" label={t("myBookings")} onPress={() => router.push("/user/mybookings")} />
                <QuickActionButton icon="person-outline" label={t("profile")} onPress={() => router.push("/user/profile")} />
                <QuickActionButton icon="notifications-outline" label={t("messages")} onPress={() => router.push("/user/notifications")} />
                <QuickActionButton icon="chatbubble-ellipses-outline" label={t("support")} onPress={() => router.push("/user/support")} />
                <QuickActionButton icon="language-outline" label={t("language")} onPress={() => router.push("/user/language")} />
              </View>

              <Text style={styles.sectionTitleSmall}>{t("topServices")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
                <ServiceChip label="Kaltalash" onPress={() => setSearch("kaltalash")} />
                <ServiceChip label="Classic" onPress={() => setSearch("classic")} />
                <ServiceChip label="soqol" onPress={() => setSearch("soqol")} />
                <ServiceChip label="Premium" onPress={() => setSearch("premium")} />
                <ServiceChip label="Soch olish" onPress={() => setSearch("soch olish")} />
              </ScrollView>

              <View style={styles.filterRow}>
                <FilterTab
                  active={filterMode === "nearby"}
                  icon="navigate-outline"
                  label={t("nearbyBarbers")}
                  onPress={() => setFilterMode("nearby")}
                />
                <FilterTab
                  active={filterMode === "cheap"}
                  icon="pricetag-outline"
                  label={t("cheapBarbers")}
                  onPress={() => setFilterMode("cheap")}
                />
              </View>

              <Text style={styles.sectionTitle}>{t("chooseSpecialist")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.specialistRow}
              >
                {specialists.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.specialistCard}
                    onPress={() => openBookingWithBarber(item)}
                    activeOpacity={0.12}
                  >
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.specialistAvatar} />
                    ) : (
                      <View style={styles.specialistAvatarFallback}>
                        <Text style={styles.specialistAvatarInitial}>{item.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.specialistName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.specialistRating}>
                      <Ionicons name="star" size={12} color="#635534ff" />
                      <Text style={styles.specialistRatingNum}>{item.rating.toFixed(1)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {locationLoading && (
                <View style={styles.loadingBanner}>
                  <ActivityIndicator size="small" color={accent} />
                  <Ionicons name="location-outline" size={15} color={accent} style={styles.loadingBannerIcon} />
                  <Text style={styles.loadingBannerText}>{t("locating")}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>{t("nearbyListTitle")}</Text>
            </>
          }
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: 100 + insets.bottom }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefreshList}
              colors={[accent]}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={accent} size={40} />
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="warning-outline" size={48} color="#fca5a5" style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    if (filterMode === "nearby") {
                      void requestLocationAndLoad();
                    } else {
                      void fetchBarbers();
                    }
                  }}
                >
                  <Text style={styles.retryText}>{t("retry")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.empty}>{t("noBarberFound")}</Text>
            )
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function FilterTab({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterBtn, active && styles.filterBtnActive]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? "#ffffff" : textMuted}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatPill({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={15} color={accent} style={{ marginRight: 6 }} />
      <Text style={styles.statText}>{text}</Text>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.7} onPress={onPress}>
      <LinearGradient
        colors={["#ffffff", "#fff6ef"]}
        start={[0, 0]}
        end={[1, 1]}
        style={styles.quickActionInner}
      >
        <View style={styles.quickActionIconWrap}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <Text style={styles.quickActionText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ServiceChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.serviceChip} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="pricetag-outline" size={13} color={accentStrong} style={{ marginRight: 6 }} />
      <Text style={styles.serviceChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pageBg },
  listContent: {
    paddingHorizontal: 16,
  },
  listHeader: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  heroCard: {
    backgroundColor: cardBg,
    borderRadius: userDesign.radius.lg,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    padding: 20,
    marginBottom: 18,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 16px 32px rgba(17, 24, 39, 0.06)" }
      : {
          shadowColor: "#111827",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
          elevation: 3,
        }),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.9,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: textDark,
    marginTop: 8,
    letterSpacing: -0.7,
    lineHeight: 38,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 20,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cardBgAlt,
    marginTop: 18,
    borderRadius: userDesign.radius.lg,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    minHeight: 56,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: textDark,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  promoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.28)",
    padding: 14,
    marginBottom: 14,
  },
  promoTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promoLabel: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,122,26,0.18)",
    borderColor: "rgba(92, 211, 18, 0.83)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  promoBadgeText: {
    color: "#fde68a",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 4,
  },
  promoTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: -0.3,
  },
  promoSub: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: "600",
  },
  promoBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: accentStrong,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  promoBtnText: {
    color: "#020617",
    fontWeight: "900",
    fontSize: 11,
    marginRight: 5,
  },
  sectionTitleSmall: {
    color: textDark,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 14,
  },
  quickActionItem: {
    width: "33.333%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  quickActionInner: {
    borderRadius: userDesign.radius.lg,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.86)",
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  quickActionText: {
    color: userDesign.text,
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  servicesRow: {
    paddingBottom: 12,
    paddingRight: 8,
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cardBg,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  serviceChipText: {
    color: accentStrong,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: cardBg,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    marginRight: 8,
  },
  statText: {
    color: textDark,
    fontSize: 12,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: "rgba(26, 255, 57, 0.2)",
    marginRight: 10,
  },
  filterBtnActive: {
    backgroundColor: accentStrong,
    borderColor: "rgba(255,122,26,0.5)",
  },
  filterBtnText: {
    color: textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  filterBtnTextActive: {
    color: textDark,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: textDark,
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  specialistRow: {
    paddingBottom: 18,
    paddingRight: 6,
  },
  specialistCard: {
    width: 110,
    alignItems: "center",
    marginRight: 14,
    backgroundColor: cardBg,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    borderRadius: userDesign.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  specialistAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: userDesign.accentSoft,
  },
  specialistAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  specialistAvatarInitial: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 24,
  },
  specialistName: {
    color: textDark,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  specialistRating: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  specialistRatingNum: {
    color: accent,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 4,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,122,26,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  loadingBannerText: {
    color: accent,
    fontWeight: "700",
    fontSize: 13,
  },
  loadingBannerIcon: { marginLeft: 10 },
  barberCard: {
    backgroundColor: cardBg,
    borderRadius: userDesign.radius.lg,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 10px 24px rgba(17, 24, 39, 0.05)" }
      : {
          shadowColor: "#111827",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.04,
          shadowRadius: 16,
          elevation: 2,
        }),
  },
  cardLeft: { position: "relative", marginRight: 10 },
  avatar: { width: 64, height: 64, borderRadius: 999, borderWidth: 2, borderColor: userDesign.accentSoft },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: userDesign.accentSoft,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: userDesign.accentSoft,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "900" },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: successColor,
    borderWidth: 2.5,
    borderColor: cardBg,
  },
  cardMiddle: { flex: 1, justifyContent: "center" },
  barberName: { fontSize: 15, fontWeight: "900", color: textDark, letterSpacing: -0.2 },
  specialty: { fontSize: 12, color: textMuted, marginTop: 2, fontWeight: "600", marginRight: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  ratingNum: { color: accent, fontSize: 12, fontWeight: "800", marginLeft: 4 },
  distance: { fontSize: 12, color: textMuted, marginLeft: 8, fontWeight: "600" },
  cardRight: { alignItems: "flex-end", justifyContent: "center", paddingLeft: 8 },
  price: { fontSize: 16, fontWeight: "900", color: textDark },
  currency: { fontSize: 10, fontWeight: "700", color: textMuted, marginTop: 1 },
  discountBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 40,
    marginBottom: -30,
    marginRight:30,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  discountText: { color: "#b72626ff", fontSize: 11, fontWeight: "800" },
  arrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: accentStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  emptyState: { justifyContent: "center", alignItems: "center", paddingVertical: 80 },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    marginHorizontal: 4,
    marginTop: 40,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  errorIcon: { marginBottom: 12 },
  errorText: { color: "#fca5a5", fontSize: 15, textAlign: "center", marginBottom: 18, fontWeight: "700" },
  retryBtn: {
    backgroundColor: accent,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 3px 6px rgba(255,122,26,0.2)" }
      : {
          shadowColor: "rgba(255,122,26,0.3)",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  retryText: { color: "#000", fontWeight: "900", fontSize: 14 },
  empty: { textAlign: "center", color: textMuted, paddingVertical: 60, fontSize: 15, fontWeight: "600" },
});