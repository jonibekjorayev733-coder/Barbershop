import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SettingsScreen, { SettingsCard, SettingsSectionTitle } from "@/components/user/SettingsScreen";
import { useLanguage } from "@/context/LanguageContext";
import { useDisplayMode, type DisplayMode } from "@/context/DisplayModeContext";
import { userDesign } from "@/constants/user-design";

type LanguageCode = "uz" | "ru" | "en";

const COPY: Record<string, Record<LanguageCode, string>> = {
  title: { uz: "Rejim", ru: "Режим", en: "Display mode" },
  subtitle: { uz: "Qorong'u/tongi rejimni tanlang va yorug'likni qo'lda sozlang.", ru: "Выберите светлую/тёмную тему и настройте яркость вручную.", en: "Choose light/dark mode and tune brightness manually." },
  modeTitle: { uz: "Rang rejimi", ru: "Тема", en: "Theme mode" },
  modeHint: { uz: "Telefon, tongi yoki qorong'u rejim.", ru: "Системная, светлая или тёмная тема.", en: "System, light or dark mode." },
  system: { uz: "Avto (telefon)", ru: "Авто (система)", en: "System" },
  light: { uz: "Tongi", ru: "Светлая", en: "Light" },
  dark: { uz: "Qorong'u", ru: "Тёмная", en: "Dark" },
  brightTitle: { uz: "Qo'lda yorug'lik", ru: "Ручная яркость", en: "Manual brightness" },
  brightHint: { uz: "Plus tomonga tortsangiz oqroq, minus tomonga tortsangiz qorong'uroq bo'ladi.", ru: "Тяните к плюсу — светлее, к минусу — темнее.", en: "Drag to plus for lighter and minus for darker." },
  darker: { uz: "Qoraytirish", ru: "Темнее", en: "Darker" },
  brighter: { uz: "Oqartirish", ru: "Светлее", en: "Brighter" },
  reset: { uz: "Nolga qaytarish", ru: "Сбросить", en: "Reset" },
};

const TRACK_WIDTH = 260;

export default function DisplayModeScreen() {
  const { language } = useLanguage();
  const { mode, setMode, brightnessShift, setBrightnessShift } = useDisplayMode();
  const [trackWidth, setTrackWidth] = useState(TRACK_WIDTH);
  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;
  const activeMode = useMemo(() => ["system", "light", "dark"] as DisplayMode[], []);

  const toPercent = (value: number) => ((value + 0.45) / 0.9) * 100;
  const fromPercent = (percent: number) => (Math.max(0, Math.min(100, percent)) / 100) * 0.9 - 0.45;

  const knobProgress = Math.max(0, Math.min(100, toPercent(brightnessShift))) / 100;
  const knobLeft = knobProgress * trackWidth;

  const updateFromX = (x: number) => {
    const safeWidth = Math.max(1, trackWidth);
    const percent = (x / safeWidth) * 100;
    void setBrightnessShift(fromPercent(percent));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        updateFromX(event.nativeEvent.locationX);
      },
      onPanResponderMove: (event) => {
        updateFromX(event.nativeEvent.locationX);
      },
    }),
  ).current;

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width || TRACK_WIDTH);
  };

  return (
    <SettingsScreen title={tr("title")} subtitle={tr("subtitle")}>
      <SettingsCard>
        <SettingsSectionTitle title={tr("modeTitle")} hint={tr("modeHint")} />
        <View style={styles.modeRow}>
          {activeMode.map((item) => (
            <Pressable
              key={item}
              onPress={() => void setMode(item)}
              style={({ pressed }) => [styles.modeBtn, mode === item && styles.modeBtnActive, pressed && styles.pressed]}
            >
              <Text style={[styles.modeBtnText, mode === item && styles.modeBtnTextActive]}>
                {item === "system" ? tr("system") : item === "light" ? tr("light") : tr("dark")}
              </Text>
            </Pressable>
          ))}
        </View>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionTitle title={tr("brightTitle")} hint={tr("brightHint")} />

        <View style={styles.scaleRow}>
          <Ionicons name="remove" size={16} color={userDesign.textMuted} />
          <Text style={styles.scaleText}>{tr("darker")}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.scaleText}>{tr("brighter")}</Text>
          <Ionicons name="add" size={16} color={userDesign.textMuted} />
        </View>

        <View style={styles.sliderWrap} onLayout={handleTrackLayout} {...panResponder.panHandlers}>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderActive, { width: knobLeft }]} />
            <View style={[styles.knob, { left: knobLeft }]} />
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.valueText}>{Math.round(brightnessShift * 100)}%</Text>
          <Pressable style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]} onPress={() => void setBrightnessShift(0)}>
            <Text style={styles.resetText}>{tr("reset")}</Text>
          </Pressable>
        </View>
      </SettingsCard>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  modeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: userDesign.cardSoft,
    borderWidth: 1,
    borderColor: userDesign.line,
  },
  modeBtnActive: {
    backgroundColor: userDesign.accentSoft,
    borderColor: "rgba(37,99,235,0.35)",
  },
  modeBtnText: {
    color: userDesign.text,
    fontWeight: "700",
    fontSize: 13,
  },
  modeBtnTextActive: {
    color: userDesign.accentStrong,
  },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },
  scaleText: {
    color: userDesign.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  sliderWrap: {
    height: 34,
    justifyContent: "center",
  },
  sliderTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    position: "relative",
    overflow: "visible",
  },
  sliderActive: {
    height: 8,
    borderRadius: 999,
    backgroundColor: userDesign.accent,
  },
  knob: {
    position: "absolute",
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: userDesign.accent,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueText: {
    color: userDesign.text,
    fontWeight: "700",
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: userDesign.cardSoft,
    borderWidth: 1,
    borderColor: userDesign.line,
  },
  resetText: {
    color: userDesign.text,
    fontWeight: "700",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});
