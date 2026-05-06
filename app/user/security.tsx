import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, Pressable, View, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingsScreen, { SettingsCard, SettingsSectionTitle } from "@/components/user/SettingsScreen";
import { useAuth } from "@/context/AuthContext";
import { userDesign } from "@/constants/user-design";
import { useLanguage } from "@/context/LanguageContext";
import { updateUserProfile } from "@/services/api";

type LanguageCode = "uz" | "ru" | "en";

const COPY: Record<string, Record<LanguageCode, string>> = {
  title: { uz: "Parol va xavfsizlik", ru: "Пароль и безопасность", en: "Password & security" },
  subtitle: { uz: "Hisobingizni yanada xavfsiz qilish uchun yangi parol o'rnating.", ru: "Установите новый пароль для защиты аккаунта.", en: "Set a new password to keep your account secure." },
  sectionPassword: { uz: "Yangi parol", ru: "Новый пароль", en: "New password" },
  sectionPasswordHint: { uz: "Kuchli parol tanlang: harf va raqamlarni birga ishlatish tavsiya qilinadi.", ru: "Используйте сильный пароль: буквы и цифры вместе.", en: "Use a strong password with letters and numbers." },
  fieldPassword: { uz: "Yangi parol", ru: "Новый пароль", en: "New password" },
  fieldPasswordPlaceholder: { uz: "Kamida 6 ta belgi", ru: "Минимум 6 символов", en: "At least 6 characters" },
  fieldConfirm: { uz: "Parolni tasdiqlang", ru: "Подтвердите пароль", en: "Confirm password" },
  fieldConfirmPlaceholder: { uz: "Parolni qayta kiriting", ru: "Введите пароль снова", en: "Re-enter password" },
  save: { uz: "Parolni yangilash", ru: "Обновить пароль", en: "Update password" },
  saving: { uz: "Yangilanmoqda...", ru: "Обновление...", en: "Updating..." },
  tipsTitle: { uz: "Xavfsizlik tavsiyasi", ru: "Советы по безопасности", en: "Security tips" },
  tipsHint: { uz: "Parolni boshqa ilovalardagi parollardan farqli qiling va uni hech kimga bermang.", ru: "Используйте уникальный пароль и никому его не сообщайте.", en: "Use a unique password and never share it." },
  tip1: { uz: "Har 3-6 oyda parolni yangilab turing.", ru: "Меняйте пароль каждые 3–6 месяцев.", en: "Change your password every 3-6 months." },
  tip2: { uz: "Telefoningizni qulf bilan himoyalang.", ru: "Защитите телефон блокировкой.", en: "Protect your phone with a lock screen." },
  errorTitle: { uz: "Xatolik", ru: "Ошибка", en: "Error" },
  errorLength: { uz: "Parol kamida 6 ta belgidan iborat bo'lishi kerak.", ru: "Пароль должен быть не менее 6 символов.", en: "Password must be at least 6 characters." },
  errorMismatch: { uz: "Parollar mos emas.", ru: "Пароли не совпадают.", en: "Passwords do not match." },
  successTitle: { uz: "Saqlandi", ru: "Сохранено", en: "Saved" },
  successBody: { uz: "Parol muvaffaqiyatli yangilandi.", ru: "Пароль успешно обновлён.", en: "Password updated successfully." },
  ok: { uz: "OK", ru: "OK", en: "OK" },
  errorUpdate: { uz: "Parol yangilanmadi.", ru: "Не удалось обновить пароль.", en: "Could not update password." },
};

export default function SecurityScreen() {
  const { session } = useAuth();
  const { language } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;

  const savePassword = async () => {
    if (!session?.user_id) {
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert(tr("errorTitle"), tr("errorLength"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(tr("errorTitle"), tr("errorMismatch"));
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile(session.user_id, { name: session.name ?? "", password: password.trim() });
      setPassword("");
      setConfirmPassword("");
      Alert.alert(tr("successTitle"), tr("successBody"), [
        { text: tr("ok"), onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert(tr("errorTitle"), error instanceof Error ? error.message : tr("errorUpdate"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsScreen title={tr("title")} subtitle={tr("subtitle")}>
      <SettingsCard>
        <SettingsSectionTitle title={tr("sectionPassword")} hint={tr("sectionPasswordHint")} />
        <Field label={tr("fieldPassword")} value={password} onChangeText={setPassword} placeholder={tr("fieldPasswordPlaceholder")} />
        <Field label={tr("fieldConfirm")} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={tr("fieldConfirmPlaceholder")} />
        <Pressable style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.disabled]} onPress={savePassword} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? tr("saving") : tr("save")}</Text>
        </Pressable>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionTitle title={tr("tipsTitle")} hint={tr("tipsHint")} />
        <View style={styles.tipRow}>
          <Ionicons name="lock-closed-outline" size={20} color="#93c5fd" />
          <Text style={styles.tipText}>{tr("tip1")}</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#93c5fd" />
          <Text style={styles.tipText}>{tr("tip2")}</Text>
        </View>
      </SettingsCard>
    </SettingsScreen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        secureTextEntry
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    marginBottom: 10,
  },
  label: {
    color: userDesign.text,
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    backgroundColor: "#fffaf6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: userDesign.line,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: userDesign.text,
    fontSize: 14,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(2, 6, 23, 0.16)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 }),
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: userDesign.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.4)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(255, 122, 26, 0.26)" }
      : { shadowColor: "#ff7a1a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 }),
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  tipText: {
    flex: 1,
    color: userDesign.textMuted,
    lineHeight: 20,
    fontWeight: "500",
  },
});
