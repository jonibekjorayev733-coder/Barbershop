import { Redirect } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  StyleSheet, Text, View, Animated, Platform, Dimensions,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoute";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW } = Dimensions.get("window");

// ─── Animated dot indicator ─────────────────────────────────────────────────
function Dot({ delay, native }: { delay: number; native: boolean }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(scale, { toValue: 1, duration: 380, useNativeDriver: native }),
        Animated.timing(scale, { toValue: 0.4, duration: 380, useNativeDriver: native }),
        Animated.delay(800 - delay),
      ])
    ).start();
  }, [delay, native, scale]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { transform: [{ scale }] },
      ]}
    />
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Index() {
  const { session, isLoading } = useAuth();
  const [showBranding, setShowBranding] = useState(true);
  const native = Platform.OS !== "web";

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const lineAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setShowBranding(false), 2800);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 640, useNativeDriver: native }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: native }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: native }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: native }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: native }),
      ])
    ).start();

    Animated.timing(lineAnim, { toValue: 1, duration: 1200, delay: 600, useNativeDriver: native }).start();

    return () => clearTimeout(timer); // eslint-disable-line react-hooks/exhaustive-deps
  }, []);                                                           // eslint-disable-line react-hooks/exhaustive-deps

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const lineScaleX  = lineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (isLoading || showBranding) {
    return (
      <View style={styles.root}>
        {/* Background gradient */}
        <LinearGradient
          colors={["#06091a", "#0d1632", "#06091a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient glow blob */}
        <Animated.View style={[styles.glowBlob, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={["#d4af37", "#c0962b", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo badge */}
          <View style={styles.badge}>
            <LinearGradient
              colors={["rgba(212,175,55,0.20)", "rgba(212,175,55,0.05)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.badgeRing}>
              <Text style={styles.scissorsIcon}>✂</Text>
            </View>
          </View>

          {/* Brand text */}
          <Text style={styles.brandName}>
            BARBER<Text style={styles.brandGold}>PRO</Text>
          </Text>

          {/* Animated divider line */}
          <Animated.View style={[styles.divider, { transform: [{ scaleX: lineScaleX }] }]} />

          <Text style={styles.tagline}>Zamonaviy sartaroshxona tajribasi</Text>
        </Animated.View>

        {/* Bottom loading dots */}
        <Animated.View style={[styles.bottomRow, { opacity: fadeAnim }]}>
          <Dot delay={0}   native={native} />
          <Dot delay={180} native={native} />
          <Dot delay={360} native={native} />
        </Animated.View>

        {/* Corner ornament lines */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>
    );
  }

  if (session) return <Redirect href={getHomeRouteByRole(session.role)} />;
  return <Redirect href="/(auth)/login" />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f0c040";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06091a",
    alignItems: "center",
    justifyContent: "center",
  },
  glowBlob: {
    position: "absolute",
    width: SW * 1.4,
    height: SW * 1.4,
    borderRadius: SW * 0.7,
    bottom: -SW * 0.5,
    alignSelf: "center",
  },
  content: {
    alignItems: "center",
  },
  badge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 1.5,
    borderColor: "rgba(212,175,55,0.40)",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 0px 40px rgba(212,175,55,0.25)" }
      : {
          shadowColor: GOLD,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 30,
          elevation: 18,
        }),
  },
  badgeRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.30)",
    backgroundColor: "rgba(10,15,35,0.90)",
  },
  scissorsIcon: {
    fontSize: 52,
    color: GOLD2,
    transform: [{ rotate: "-45deg" }],
  },
  brandName: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 6,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-condensed",
    ...(Platform.OS === "web"
      ? { textShadow: "0px 0px 20px rgba(212,175,55,0.4)" }
      : {
          textShadowColor: "rgba(212,175,55,0.4)",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20,
        }),
  },
  brandGold: {
    color: GOLD2,
  },
  divider: {
    width: SW * 0.55,
    height: 1.5,
    backgroundColor: GOLD,
    marginTop: 18,
    marginBottom: 14,
    opacity: 0.6,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(212,175,55,0.70)",
    letterSpacing: 2.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  bottomRow: {
    position: "absolute",
    bottom: 70,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  // Corner ornaments
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "rgba(212,175,55,0.35)",
  },
  cornerTL: { top: 28, left: 28, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 28, right: 28, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 28, left: 28, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 28, right: 28, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
});
