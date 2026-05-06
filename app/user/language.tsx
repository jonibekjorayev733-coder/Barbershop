import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, Pressable, View, Platform } from "react-native";
import { router } from "expo-router";
import SettingsScreen, { SettingsCard, SettingsSectionTitle } from "@/components/user/SettingsScreen";
import { LANGUAGE_LABELS, type LanguageCode } from "@/lib/userPreferences";
import { userDesign } from "@/constants/user-design";
import { useLanguage } from "@/context/LanguageContext";

const COPY = {
  saved: { uz: "Saqlandi", ru: "Сохранено", en: "Saved" },
  selected: { uz: "tanlandi.", ru: "выбран.", en: "selected." },
  ok: { uz: "OK", ru: "OK", en: "OK" },
  title: { uz: "Til va mintaqa", ru: "Язык и регион", en: "Language & region" },
  subtitle: { uz: "Sizga qulay tilni tanlang. Keyinchalik istalgan payt o'zgartirishingiz mumkin.", ru: "Выберите удобный язык. Вы сможете изменить его в любой момент.", en: "Choose your preferred language. You can change it anytime." },
  selectedLang: { uz: "Tanlangan til", ru: "Выбранный язык", en: "Selected language" },
  current: { uz: "Hozir", ru: "Сейчас", en: "Current" },
};

const OPTIONS: { code: LanguageCode; description: string }[] = [
  { code: "uz", description: "Ilova interfeysi o'zbek tilida ko'rsatiladi." },
  { code: "ru", description: "Интерфейс приложения будет показан на русском языке." },
  { code: "en", description: "The app interface will be shown in English." },
];

export default function LanguageScreen() {
  const [selected, setSelected] = useState<LanguageCode>("uz");
  const { language, setLanguage } = useLanguage();
  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;

  useEffect(() => {
    setSelected(language);
  }, [language]);

  const saveLanguage = async (code: LanguageCode) => {
    setSelected(code);
    await setLanguage(code);
    Alert.alert(tr("saved"), `${LANGUAGE_LABELS[code]} ${tr("selected")}`, [
      { text: tr("ok"), onPress: () => {
        router.back();
      }},
    ]);
  };

  return (
    <SettingsScreen title={tr("title")} subtitle={tr("subtitle")}>
      <SettingsCard>
        <SettingsSectionTitle title={tr("selectedLang")} hint={`${tr("current")}: ${LANGUAGE_LABELS[selected]}`} />
        {OPTIONS.map((item) => {
          const active = selected === item.code;
          return (
            <Pressable key={item.code} style={[styles.option, active && styles.optionActive]} onPress={() => void saveLanguage(item.code)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{LANGUAGE_LABELS[item.code]}</Text>
                <Text style={[styles.optionDescription, active && styles.optionDescriptionActive]}>{item.description}</Text>
              </View>
              <View style={[styles.dot, active && styles.dotActive]} />
            </Pressable>
          );
        })}
      </SettingsCard>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: userDesign.line,
    backgroundColor: "#fffaf6",
    marginTop: 8,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(2, 6, 23, 0.16)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 }),
  },
  optionActive: {
    backgroundColor: "#fff5eb",
    borderColor: "rgba(255,122,26,0.45)",
    borderWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(255,122,26,0.18)" }
      : { shadowColor: "rgba(255,122,26,0.28)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 3 }),
  },
  optionTitle: {
    color: userDesign.text,
    fontWeight: "700",
    fontSize: 14,
  },
  optionTitleActive: {
    color: userDesign.accentStrong,
  },
  optionDescription: {
    color: userDesign.textMuted,
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  optionDescriptionActive: {
    color: "#94a3b8",
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    backgroundColor: "transparent",
  },
  dotActive: {
    borderColor: userDesign.accent,
    backgroundColor: userDesign.accent,
  },
});
