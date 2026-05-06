import { useCallback, useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, Pressable, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SettingsScreen, { SettingsCard, SettingsSectionTitle } from "@/components/user/SettingsScreen";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { userDesign } from "@/constants/user-design";
import { getAppSupportConfig, type AppSupportConfigApi } from "@/services/api";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

type LanguageCode = "uz" | "ru" | "en";

const COPY: Record<string, Record<LanguageCode, string>> = {
  title: { uz: "Aloqa va support", ru: "Связь и поддержка", en: "Support" },
  subtitle: { uz: "Savol, muammo yoki taklif bo'lsa, shu kanallardan birini tanlang.", ru: "Выберите удобный канал для связи.", en: "Choose a channel for questions and support." },
  contactTitle: { uz: "Biz bilan bog'laning", ru: "Свяжитесь с нами", en: "Contact us" },
  contactHint: { uz: "Operatorlar odatda tez javob beradi va bronlar bo'yicha ham yordam ko'rsatadi.", ru: "Операторы обычно отвечают быстро и помогают по записям.", en: "Support usually responds quickly and helps with bookings." },
  workTitle: { uz: "Ish vaqti", ru: "Рабочие часы", en: "Working hours" },
  workHint: { uz: "Online support har kuni faol, ammo ayrim kanallarda javob tezligi farq qilishi mumkin.", ru: "Поддержка активна ежедневно, скорость ответа зависит от канала.", en: "Support is active daily; response speed depends on channel." },
  errorTitle: { uz: "Xatolik", ru: "Ошибка", en: "Error" },
  errorOpen: { uz: "Ushbu havolani ochib bo'lmadi.", ru: "Не удалось открыть ссылку.", en: "Could not open this link." },
  errorContact: { uz: "Bog'lanish oynasi ochilmadi.", ru: "Не удалось открыть окно связи.", en: "Could not open contact action." },
  loadError: { uz: "Support ma'lumotlari yuklanmadi.", ru: "Не удалось загрузить данные поддержки.", en: "Could not load support data." },
  callCenter: { uz: "Call center", ru: "Колл-центр", en: "Call center" },
  tgSupport: { uz: "Telegram support", ru: "Telegram поддержка", en: "Telegram support" },
  email: { uz: "Email", ru: "Email", en: "Email" },
};

const FALLBACK_CONFIG: AppSupportConfigApi = {
  call_center_phone: "+998 90 777 77 77",
  telegram_username: "@sharpcuts_support",
  telegram_url: "https://t.me/sharpcuts_support",
  email: "support@sharpcuts.uz",
  work_hours: "Dushanba - Yakshanba: 09:00 - 22:00",
  extra_hint: "Telegram va email orqali 24/7 xabar qoldirishingiz mumkin.",
  updated_at: null,
};

function normalizePhoneForTel(value: string): string {
  return String(value || "").replace(/[^\d+]/g, "");
}

export default function SupportScreen() {
  const { language } = useLanguage();
  const { session } = useAuth();
  const [config, setConfig] = useState<AppSupportConfigApi>(FALLBACK_CONFIG);
  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;
  
  const loadSupportConfig = useCallback(async () => {
    try {
      const row = await getAppSupportConfig();
      setConfig({ ...FALLBACK_CONFIG, ...row });
    } catch {
      Alert.alert(tr("errorTitle"), tr("loadError"));
    }
  }, [tr]);
  
  useFocusEffect(
    useCallback(() => {
      void loadSupportConfig();
    }, [loadSupportConfig]),
  );
  
  useRealtimeChannel(
    "bookings",
    session?.access_token ?? null,
    useCallback((event) => {
      if (event === "app.support.updated") {
        void loadSupportConfig();
      }
    }, [loadSupportConfig]),
    Boolean(session?.access_token),
  );
  
  const supportItems = useMemo(
    () => [
      {
        icon: "call-outline" as const,
        title: tr("callCenter"),
        value: config.call_center_phone,
        action: `tel:${normalizePhoneForTel(config.call_center_phone)}`,
      },
      {
        icon: "chatbubbles-outline" as const,
        title: tr("tgSupport"),
        value: config.telegram_username,
        action: config.telegram_url,
      },
      {
        icon: "mail-outline" as const,
        title: tr("email"),
        value: config.email,
        action: `mailto:${config.email}`,
      },
    ],
    [config, tr],
  );

  const openAction = async (target: string) => {
    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) {
        Alert.alert(tr("errorTitle"), tr("errorOpen"));
        return;
      }
      await Linking.openURL(target);
    } catch {
      Alert.alert(tr("errorTitle"), tr("errorContact"));
    }
  };

  return (
    <SettingsScreen title={tr("title")} subtitle={tr("subtitle")}>
      <SettingsCard>
        <SettingsSectionTitle title={tr("contactTitle")} hint={tr("contactHint")} />
        {supportItems.map((item, index) => (
          <Pressable key={item.title} style={({ pressed }) => [styles.row, index === supportItems.length - 1 && styles.rowLast, pressed && styles.pressed]} onPress={() => void openAction(item.action)}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={19} color={userDesign.accentStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        ))}
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionTitle title={tr("workTitle")} hint={tr("workHint")} />
        <View style={styles.infoChip}>
          <Text style={styles.infoChipText}>{config.work_hours}</Text>
        </View>
        <View style={styles.infoChipMuted}>
          <Text style={styles.infoChipMutedText}>{config.extra_hint}</Text>
        </View>
      </SettingsCard>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,122,26,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.25)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 8px rgba(2, 6, 23, 0.15)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 }),
  },
  title: {
    color: userDesign.text,
    fontWeight: "700",
    fontSize: 14,
  },
  value: {
    color: userDesign.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  infoChip: {
    backgroundColor: userDesign.accentSoft,
    borderRadius: 14,
    padding: 12,
    marginTop: 3,
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.3)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 14px rgba(255, 122, 26, 0.16)" }
      : { shadowColor: "#ff7a1a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 3 }),
  },
  infoChipText: {
    color: userDesign.accentStrong,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  infoChipMuted: {
    backgroundColor: "#fffaf6",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(17, 17, 17, 0.06)" }
      : { shadowColor: "#111111", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }),
  },
  infoChipMutedText: {
    color: userDesign.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
