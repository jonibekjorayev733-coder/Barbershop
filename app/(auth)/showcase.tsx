import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated, Dimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";

const { width } = Dimensions.get("window");

const DEMO_CARDS = [
  { id: 1, name: "Jasur", specialty: "Fade & Beard", rating: 4.9, price: "55K" },
  { id: 2, name: "Sardor", specialty: "Classic Cut", rating: 4.8, price: "45K" },
  { id: 3, name: "Bekzod", specialty: "Premium Style", rating: 5.0, price: "70K" },
];

export default function AuthShowcaseScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const canUseNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: canUseNativeDriver }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: canUseNativeDriver })
    ]).start();
  }, [canUseNativeDriver]);

  return (
    <View style={styles.container}>
      {/* Background Aurora */}
      <LinearGradient colors={['#0f172a', '#020617']} style={StyleSheet.absoluteFill} />
      <View style={styles.auroraOne} />
      <View style={styles.auroraTwo} />
      <View style={styles.blurFallback} />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ELITE SERVICE</Text>
            </View>
            <Text style={styles.title}>Yaqin ustani{'\n'}qulay tanlang</Text>
            <Text style={styles.subtitle}>Premium uslub, oniy bron va eng zo&apos;r sartaroshlar bitta dasturda.</Text>
          </Animated.View>

          <Animated.View style={[styles.cardsWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {DEMO_CARDS.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => router.push("/(auth)/login")}
                style={{ overflow: 'hidden', borderRadius: 24, marginBottom: 16 }}
              >
                <View style={styles.card}>
                  <View style={styles.avatar}>
                    <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={StyleSheet.absoluteFill} />
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.specialty}>{item.specialty}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.pill}>
                        <Ionicons name="star" size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                        <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: 'rgba(52, 211, 153, 0.1)' }]}>
                        <Text style={styles.price}>{item.price} so&apos;m</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.arrowWrap}>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>

          <Animated.View style={[{ marginTop: 40, opacity: fadeAnim }]}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(auth)/login")} style={styles.buttonShadow}>
              <LinearGradient colors={['#2563eb', '#4f46e5']} start={[0, 0]} end={[1, 1]} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Boshlash</Text>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  auroraOne: { position: 'absolute', top: 0, left: -100, width: width * 1.5, height: width * 1.5, backgroundColor: 'rgba(59, 130, 246, 0.4)', borderRadius: 999 },
  auroraTwo: { position: 'absolute', bottom: -100, right: -100, width: width, height: width, backgroundColor: 'rgba(139, 92, 246, 0.3)', borderRadius: 999 },
  blurFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.45)' },
  content: { padding: 24, paddingBottom: 60, paddingTop: 60 },
  header: { marginBottom: 40 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  badgeText: { color: '#93c5fd', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: "#ffffff", fontSize: 42, fontWeight: "900", lineHeight: 50, letterSpacing: -1 },
  subtitle: { color: "#94a3b8", fontSize: 16, marginTop: 16, lineHeight: 24, fontWeight: '500' },
  cardsWrap: { marginTop: 10 },
  card: { padding: 18, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: 'rgba(30, 41, 59, 0.4)', borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  avatarText: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  cardBody: { flex: 1 },
  name: { color: "#f8fafc", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  specialty: { color: "#94a3b8", fontSize: 14, fontWeight: '500' },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rating: { color: "#fbbf24", fontWeight: "800", fontSize: 13 },
  price: { color: "#34d399", fontWeight: "800", fontSize: 13 },
  arrowWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  buttonShadow: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 10px 20px rgba(37, 99, 235, 0.5)' }
      : { shadowColor: '#2563eb', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }),
  },
  primaryBtn: { borderRadius: 20, flexDirection: 'row', alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: 0.5 },
});
