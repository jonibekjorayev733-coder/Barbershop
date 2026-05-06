import { useCallback, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, Pressable, View, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import SettingsScreen, { SettingsCard, SettingsSectionTitle } from "@/components/user/SettingsScreen";
import { useAuth } from "@/context/AuthContext";
import { userDesign } from "@/constants/user-design";
import { useLanguage } from "@/context/LanguageContext";
import { getUserProfile, updateUserProfile } from "@/services/api";
import {
  formatUzbekPhone,
  getUzbekPhonePlaceholder,
  hasOnlyPrefix,
  isCompleteUzbekPhone,
  toUzbekPhoneApi,
  UZBEKISTAN_PHONE_DISPLAY_MAX,
} from "@/lib/phone";

export default function PersonalInfoScreen() {
  const { session, signIn } = useAuth();
  const { language } = useLanguage();

  const COPY = {
    permissionTitle: { uz: "Ruxsat kerak", ru: "Нужен доступ", en: "Permission required" },
    permissionMsg: { uz: "Galereyadan rasm tanlash uchun ruxsat bering.", ru: "Разрешите доступ к галерее для выбора фото.", en: "Allow gallery access to pick a photo." },
    errorTitle: { uz: "Xatolik", ru: "Ошибка", en: "Error" },
    pickFail: { uz: "Rasmni tanlab bo'lmadi.", ru: "Не удалось выбрать фото.", en: "Could not select image." },
    nameRequired: { uz: "Ismingizni kiriting.", ru: "Введите имя.", en: "Please enter your name." },
    phoneInvalid: { uz: "Telefon raqamini to'liq kiriting.", ru: "Введите полный номер телефона.", en: "Please enter a complete phone number." },
    savedTitle: { uz: "Saqlandi", ru: "Сохранено", en: "Saved" },
    savedMsg: { uz: "Profil ma'lumotlari yangilandi.", ru: "Данные профиля обновлены.", en: "Profile details updated." },
    saveFail: { uz: "Saqlab bo'lmadi.", ru: "Не удалось сохранить.", en: "Could not save." },
    ok: { uz: "OK", ru: "ОК", en: "OK" },
    title: { uz: "Shaxsiy ma'lumotlar", ru: "Личные данные", en: "Personal info" },
    subtitle: { uz: "Profil rasmini, ismni, email va telefon raqamingizni bir joydan boshqaring.", ru: "Управляйте фото профиля, именем, email и телефоном в одном месте.", en: "Manage profile photo, name, email, and phone in one place." },
    avatarTitle: { uz: "Profil rasmi", ru: "Фото профиля", en: "Profile photo" },
    avatarHint: { uz: "Avatarni galereyadan tanlang yoki keyinroq almashtiring.", ru: "Выберите аватар из галереи или поменяйте позже.", en: "Pick an avatar from gallery or change it later." },
    pickFromGallery: { uz: "Galereyadan tanlash", ru: "Выбрать из галереи", en: "Choose from gallery" },
    removeAvatar: { uz: "Avatarni olib tashlash", ru: "Удалить аватар", en: "Remove avatar" },
    mainTitle: { uz: "Asosiy ma'lumotlar", ru: "Основные данные", en: "Main details" },
    mainHint: { uz: "Bu yerda kiritilgan ma'lumotlar bronlarda avtomatik chiqadi.", ru: "Эти данные автоматически используются в записях.", en: "These details are used automatically in bookings." },
    fullName: { uz: "To'liq ism", ru: "Полное имя", en: "Full name" },
    namePlaceholder: { uz: "Ismingiz", ru: "Ваше имя", en: "Your name" },
    email: { uz: "Email", ru: "Email", en: "Email" },
    phone: { uz: "Telefon", ru: "Телефон", en: "Phone" },
    phoneHint: { uz: "Telefon raqami `+998` formatida avtomatik boshqariladi.", ru: "Номер телефона автоматически форматируется как `+998`.", en: "Phone number is auto-formatted as `+998`." },
    saving: { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." },
    saveChanges: { uz: "O'zgarishlarni saqlash", ru: "Сохранить изменения", en: "Save changes" },
  } as const;

  const tr = (key: keyof typeof COPY) => COPY[key][language] ?? COPY[key].uz;

  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [phone, setPhone] = useState(() => formatUzbekPhone(session?.phone ?? "", { keepPrefixWhenEmpty: false }));
  const [avatar, setAvatar] = useState(session?.avatar ?? "");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user_id) {
        return;
      }

      let active = true;
      void (async () => {
        try {
          const profile = await getUserProfile(session.user_id);
          if (!active) {
            return;
          }
          setName(profile.name || session.name || "");
          setEmail(profile.email || session.email || "");
          setPhone(formatUzbekPhone(profile.phone || session.phone || "", { keepPrefixWhenEmpty: false }));
          setAvatar(profile.avatar || session.avatar || "");
        } catch {
          if (active) {
            setName(session.name || "");
            setEmail(session.email || "");
            setPhone(formatUzbekPhone(session.phone || "", { keepPrefixWhenEmpty: false }));
            setAvatar(session.avatar || "");
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [session]),
  );

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(tr("permissionTitle"), tr("permissionMsg"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      if (asset.base64) {
        setAvatar(`data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`);
      } else if (asset.uri) {
        setAvatar(asset.uri);
      }
    } catch {
      Alert.alert(tr("errorTitle"), tr("pickFail"));
    }
  };

  const getInitials = (value: string) =>
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const saveProfile = async () => {
    if (!session?.user_id || !session) {
      return;
    }
    if (!name.trim()) {
      Alert.alert(tr("errorTitle"), tr("nameRequired"));
      return;
    }
    if (phone.trim() && !hasOnlyPrefix(phone) && !isCompleteUzbekPhone(phone)) {
      Alert.alert(tr("errorTitle"), tr("phoneInvalid"));
      return;
    }

    try {
      setSaving(true);
      const updated = await updateUserProfile(session.user_id, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: hasOnlyPrefix(phone) ? undefined : toUzbekPhoneApi(phone),
        avatar: avatar.trim() || undefined,
      });

      await signIn({
        ...session,
        name: updated.name,
        email: updated.email || "",
        phone: updated.phone ?? null,
        avatar: updated.avatar ?? null,
      });

      Alert.alert(tr("savedTitle"), tr("savedMsg"), [
        { text: tr("ok"), onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert(tr("errorTitle"), error instanceof Error ? error.message : tr("saveFail"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsScreen title={tr("title")} subtitle={tr("subtitle")}>
      <SettingsCard>
        <SettingsSectionTitle title={tr("avatarTitle")} hint={tr("avatarHint")} />
        <View style={styles.avatarRow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{getInitials(name || session?.name || "U")}</Text>
            </View>
          )}
          <View style={styles.avatarActions}>
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.disabled]} onPress={pickAvatar}>
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>{tr("pickFromGallery")}</Text>
            </Pressable>
            {avatar ? (
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.disabled]} onPress={() => setAvatar("")}>
                <Text style={styles.secondaryButtonText}>{tr("removeAvatar")}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionTitle title={tr("mainTitle")} hint={tr("mainHint")} />
        <Field label={tr("fullName")} value={name} onChangeText={setName} placeholder={tr("namePlaceholder")} />
        <Field label={tr("email")} value={email} onChangeText={setEmail} placeholder={tr("email")} keyboardType="email-address" />
        <Field
          label={tr("phone")}
          value={phone}
          onChangeText={(value) => setPhone(formatUzbekPhone(value))}
          placeholder={getUzbekPhonePlaceholder()}
          keyboardType="phone-pad"
          maxLength={UZBEKISTAN_PHONE_DISPLAY_MAX}
        />
        <Text style={styles.hint}>{tr("phoneHint")}</Text>
        <Pressable style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.disabled]} onPress={saveProfile} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? tr("saving") : tr("saveChanges")}</Text>
        </Pressable>
      </SettingsCard>
    </SettingsScreen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  maxLength?: number;
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
        keyboardType={props.keyboardType}
        autoCapitalize={props.keyboardType === "email-address" ? "none" : "words"}
        maxLength={props.maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  avatarActions: {
    flex: 1,
    gap: 10,
    paddingTop: 2,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 26,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 12px 22px rgba(2, 6, 23, 0.22)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5 }),
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.34)",
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: userDesign.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 12px 22px rgba(2, 6, 23, 0.22)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5 }),
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.34)",
  },
  avatarText: {
    color: userDesign.accentStrong,
    fontSize: 25,
    fontWeight: "900",
  },
  fieldWrap: {
    marginBottom: 12,
  },
  label: {
    color: userDesign.textMuted,
    fontWeight: "800",
    marginBottom: 7,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: userDesign.line,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: userDesign.text,
    fontSize: 15,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 6px 14px rgba(2, 6, 23, 0.1)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 9, elevation: 2 }),
  },
  hint: {
    color: userDesign.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: userDesign.accent,
    borderRadius: 13,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.4)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(255, 122, 26, 0.26)" }
      : { shadowColor: "#ff7a1a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 }),
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: userDesign.cardSoft,
    borderRadius: 13,
    minHeight: 44,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: userDesign.line,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 10px rgba(2, 6, 23, 0.16)" }
      : { shadowColor: "#020617", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 }),
  },
  secondaryButtonText: {
    color: userDesign.text,
    fontWeight: "700",
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: userDesign.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.4)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(255, 122, 26, 0.26)" }
      : { shadowColor: "#ff7a1a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 }),
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.7,
  },
});
