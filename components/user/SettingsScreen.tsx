import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, Pressable, View, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { userDesign } from "@/constants/user-design";
import { useLanguage } from "@/context/LanguageContext";

type LanguageCode = "uz" | "ru" | "en";

const COPY: Record<string, Record<LanguageCode, string>> = {
  back: { uz: "Orqaga", ru: "Назад", en: "Back" },
  brand: { uz: "Barber", ru: "Barber", en: "Barber" },
};

interface SettingsScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function SettingsScreen({ title, subtitle, children }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#FFFFFF", "#F9FAFB", "#F3F4F6"]}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.headerCard}
        >
          <View style={styles.headerGlowPrimary} />
          <View style={styles.headerGlowSecondary} />
          <View style={styles.headerTop}>
            <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}>
              <View style={styles.backButtonIconWrap}>
                <Ionicons name="chevron-back" size={19} color={userDesign.accentStrong} />
              </View>
              <Text style={styles.backButtonText}>{tr("back")}</Text>
            </Pressable>
            <View style={styles.headerTag}>
              <Ionicons name="sparkles-outline" size={12} color={userDesign.accentStrong} />
              <Text style={styles.headerTagText}>{tr("brand")}</Text>
            </View>
          </View>
          <Text style={styles.eyebrow}>SETTINGS HUB</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </LinearGradient>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SettingsSectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: userDesign.page },
  content: { paddingHorizontal: 16, gap: 14 },
  headerCard: {
    borderRadius: userDesign.radius.lg,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: userDesign.line,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 12px 30px rgba(17, 24, 39, 0.08)" }
      : {
          shadowColor: "#111827",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.06,
          shadowRadius: 20,
          elevation: 4,
        }),
  },
  headerGlowPrimary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    right: -60,
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  headerGlowSecondary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -46,
    left: -20,
    backgroundColor: "rgba(99,102,241,0.06)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  backButtonIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    color: userDesign.text,
    fontSize: 14,
    fontWeight: "700",
    marginRight: 4,
    letterSpacing: -0.1,
  },
  headerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 0.5,
    borderColor: userDesign.line,
  },
  headerTagText: {
    color: userDesign.text,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  eyebrow: {
    color: userDesign.accentStrong,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  title: {
    color: userDesign.text,
    fontSize: userDesign.fontSize["3xl"],
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  subtitle: {
    color: userDesign.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    letterSpacing: -0.1,
  },
  card: {
    backgroundColor: userDesign.card,
    borderRadius: userDesign.radius.lg,
    padding: 18,
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
  sectionTitleWrap: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: userDesign.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionHint: {
    color: userDesign.textMuted,
    fontSize: 13,
    marginTop: 5,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  pressed: {
    opacity: 0.7,
  },
});
