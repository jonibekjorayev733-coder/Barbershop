import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  loginUser,
  registerUser,
  requestPhoneOtp,
  warmupServer,
  verifyPhoneOtp,
  type LoginResponse,
} from "@/services/api";
import { notifyOtpCode } from "@/services/NotificationService";
import { authenticateWithBiometric, getBiometricAvailability } from "@/services/BiometricAuthService";
import { useAuth } from "@/context/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoute";
import { formatUzbekPhone, getUzbekPhonePlaceholder, isCompleteUzbekPhone, toUzbekPhoneApi, UZBEKISTAN_PHONE_DISPLAY_MAX } from "@/lib/phone";

type AuthMethod = "account" | "phone";
type AuthMode = "login" | "register";

interface AuthScreenProps {
  initialMode?: AuthMode;
}

const BIOMETRIC_EMAIL_KEY = "biometric_email";
const BIOMETRIC_PASSWORD_KEY = "biometric_password";

export default function AuthScreen({ initialMode = "login" }: AuthScreenProps) {
  const { signIn } = useAuth();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phone, setPhone] = useState(() => formatUzbekPhone(""));
  const [smsCode, setSmsCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingNote, setLoadingNote] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrik");
  const [hasBiometricCredentials, setHasBiometricCredentials] = useState(false);
  const [otpVerifyAttempts, setOtpVerifyAttempts] = useState(0);
  const [otpLockUntil, setOtpLockUntil] = useState(0);
  const [otpLockCountdown, setOtpLockCountdown] = useState(0);

  const emailNormalized = useMemo(() => email.trim().toLowerCase(), [email]);
  const sanitizedName = useMemo(() => name.trim().replace(/\s+/g, " "), [name]);
  const sanitizedPhoneName = useMemo(() => phoneName.trim().replace(/\s+/g, " "), [phoneName]);
  const smsCodeSanitized = useMemo(() => smsCode.replace(/\D/g, "").slice(0, 6), [smsCode]);
  const passwordNormalized = useMemo(() => password.trim(), [password]);
  const confirmPasswordNormalized = useMemo(() => confirmPassword.trim(), [confirmPassword]);
  const isOtpLocked = otpLockUntil > Date.now();

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResendCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!otpLockUntil) {
      setOtpLockCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remain = Math.max(0, Math.ceil((otpLockUntil - Date.now()) / 1000));
      setOtpLockCountdown(remain);
    };

    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [otpLockUntil]);

  const title = useMemo(() => {
    if (authMethod === "phone") {
      return "Telefon bilan kirish";
    }
    return mode === "login" ? "Hisobga kirish" : "Ro'yxatdan o'tish";
  }, [authMethod, mode]);

  const subtitle = useMemo(() => {
    if (authMethod === "phone") {
      return "Telefon va SMS kod bilan tez kiring";
    }
    return mode === "login"
      ? "login  qilib  kirishingiz  mumkin"
      : "Yangi foydalanuvchi uchun qisqa register formasi";
  }, [authMethod, mode]);

  useEffect(() => {
    void warmupServer();
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const [availability, savedEmail, savedPassword] = await Promise.all([
        getBiometricAvailability(),
        AsyncStorage.getItem(BIOMETRIC_EMAIL_KEY),
        AsyncStorage.getItem(BIOMETRIC_PASSWORD_KEY),
      ]);

      if (!mounted) {
        return;
      }

      setBiometricAvailable(availability.available);
      setBiometricLabel(availability.label);
      setHasBiometricCredentials(Boolean(savedEmail && savedPassword));
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setOtpVerifyAttempts(0);
    setOtpLockUntil(0);
    setOtpLockCountdown(0);
    setOtpSent(false);
    setSmsCode("");
    setOtpHint(null);
  }, [authMethod]);

  useEffect(() => {
    if (authMethod === "account") {
      setOtpVerifyAttempts(0);
      setOtpLockUntil(0);
      setOtpLockCountdown(0);
    }
  }, [mode, authMethod]);

  const finishAuth = async (session: LoginResponse) => {
    await signIn(session);
    router.replace(getHomeRouteByRole(session.role));
  };

  const saveBiometricCredentials = async (emailValue: string, passwordValue: string) => {
    if (!emailValue || !passwordValue) {
      return;
    }

    await AsyncStorage.multiSet([
      [BIOMETRIC_EMAIL_KEY, emailValue],
      [BIOMETRIC_PASSWORD_KEY, passwordValue],
    ]);
    setHasBiometricCredentials(true);
  };

  const clearBiometricCredentials = async () => {
    await AsyncStorage.multiRemove([BIOMETRIC_EMAIL_KEY, BIOMETRIC_PASSWORD_KEY]);
    setHasBiometricCredentials(false);
  };

  const handleBiometricLogin = async () => {
    if (loading || biometricBusy) {
      return;
    }

    if (!biometricAvailable) {
      Alert.alert("Biometrik yoqilmagan", "Qurilmada barmoq izi yoki boshqa biometrik usul mavjud emas.");
      return;
    }

    try {
      setBiometricBusy(true);
      const [savedEmail, savedPassword] = await AsyncStorage.multiGet([BIOMETRIC_EMAIL_KEY, BIOMETRIC_PASSWORD_KEY]);
      const emailValue = savedEmail?.[1]?.trim().toLowerCase() ?? "";
      const passwordValue = savedPassword?.[1]?.trim() ?? "";

      if (!emailValue || !passwordValue) {
        Alert.alert("Ma'lumot topilmadi", "Avval email/parol bilan bir marta kirib oling.");
        return;
      }

      const authed = await authenticateWithBiometric(`${biometricLabel} orqali kirish`);
      if (!authed) {
        return;
      }

      setLoading(true);
      setLoadingNote("Biometrik tekshirildi, kirilmoqda...");
      const session = await loginUser(emailValue, passwordValue);
      await finishAuth(session);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Biometrik kirishda xatolik";
      if (message.toLowerCase().includes("401") || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("noto'g'ri")) {
        await clearBiometricCredentials();
      }
      Alert.alert("Xatolik", message);
    } finally {
      setLoadingNote(null);
      setLoading(false);
      setBiometricBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (authMethod === "phone") {
      if (isOtpLocked) {
        Alert.alert("Biroz kuting", `Xavfsizlik uchun ${otpLockCountdown}s dan keyin qayta urinib ko'ring.`);
        return;
      }

      if (!otpSent) {
        Alert.alert("Xatolik", "Avval SMS kod yuboring");
        return;
      }

      if (!isCompleteUzbekPhone(phone) || smsCodeSanitized.length !== 6) {
        Alert.alert("Xatolik", "Telefon va SMS kodni kiriting");
        return;
      }

      try {
        setLoading(true);
        setLoadingNote("Kirilmoqda...");
        const session = await verifyPhoneOtp({
          name: sanitizedPhoneName || undefined,
          phone: toUzbekPhoneApi(phone),
          code: smsCodeSanitized,
        });
        setOtpVerifyAttempts(0);
        setOtpLockUntil(0);
        await finishAuth(session);
      } catch (error: unknown) {
        const nextAttempt = otpVerifyAttempts + 1;
        setOtpVerifyAttempts(nextAttempt);
        if (nextAttempt >= 5) {
          const lockMs = 45_000;
          setOtpLockUntil(Date.now() + lockMs);
          setOtpVerifyAttempts(0);
          Alert.alert("Xavfsizlik", "Ko'p urinish bo'ldi. 45 soniyadan keyin qayta urinib ko'ring.");
          return;
        }
        Alert.alert("Xatolik", error instanceof Error ? error.message : "SMS bilan kirishda xatolik");
      } finally {
        setLoadingNote(null);
        setLoading(false);
      }
      return;
    }

    if (!emailNormalized || !passwordNormalized || (mode === "register" && !sanitizedName)) {
      Alert.alert("Xatolik", "Kerakli maydonlarni to'ldiring");
      return;
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized);
    if (!emailIsValid) {
      Alert.alert("Xatolik", "Email formati noto'g'ri");
      return;
    }

    if (mode === "register" && passwordNormalized.length < 8) {
      Alert.alert("Xatolik", "Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    if (mode === "register" && passwordNormalized !== confirmPasswordNormalized) {
      Alert.alert("Xatolik", "Parollar bir xil emas");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote(mode === "login" ? "Kirilmoqda..." : "Ro'yxatdan o'tilmoqda...");
      const session = await (
        mode === "login"
          ? loginUser(emailNormalized, passwordNormalized)
          : registerUser(sanitizedName, emailNormalized, passwordNormalized)
      );
      await saveBiometricCredentials(emailNormalized, passwordNormalized);
      await finishAuth(session);
    } catch (error: unknown) {
      Alert.alert("Xatolik", error instanceof Error ? error.message : "Kirish muvaffaqiyatsiz");
    } finally {
      setLoadingNote(null);
      setLoading(false);
    }
  };

  const handleSendSmsCode = async () => {
    if (loading) return;

    if (isOtpLocked) {
      Alert.alert("Biroz kuting", `Xavfsizlik uchun ${otpLockCountdown}s dan keyin qayta urinib ko'ring.`);
      return;
    }

    if (!isCompleteUzbekPhone(phone)) {
      Alert.alert("Xatolik", "Telefon raqamini to‘liq kiriting");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote("SMS kod yuborilmoqda...");
      const response = await requestPhoneOtp({
        name: sanitizedPhoneName || undefined,
        phone: toUzbekPhoneApi(phone),
      });
      setOtpSent(true);
      setSmsCode("");
      setOtpVerifyAttempts(0);
      setOtpLockUntil(0);
      startCountdown(45);
      try {
        await notifyOtpCode();
      } catch {
        // local notification fail bo'lsa login oqimini to'xtatmaymiz
      }
      setOtpHint(response?.message || "SMS yuborildi. Telefoningizni tekshiring.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "SMS kod yuborilmadi";

      if (message.toLowerCase().includes("yaqinda yuborilgan")) {
        startCountdown(Math.max(resendCountdown, 30));
        setOtpHint("SMS oldin yuborilgan. Qayta yuborish uchun biroz kuting.");
        Alert.alert("Biroz kuting", message);
      } else if (message.toLowerCase().includes("vaqtincha ishlamayapti")) {
        setOtpHint("SMS xizmati vaqtincha ishlamayapti. Keyinroq qayta urinib ko'ring.");
        Alert.alert("SMS xizmati", message);
      } else {
        Alert.alert("Xatolik", message);
      }
    } finally {
      setLoadingNote(null);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.glowA} />
        <View style={styles.glowB} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image source={require("../../assets/images/icon.png")} style={styles.logoImage} resizeMode="cover" />
            </View>
            <Text style={styles.brand}>BARBER</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Ionicons name="flash-outline" size={13} color="#dbeafe" />
              <Text style={styles.featurePillText}>Tez kirish</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#dbeafe" />
              <Text style={styles.featurePillText}>Xavfsiz</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="sparkles-outline" size={13} color="#dbeafe" />
              <Text style={styles.featurePillText}>Premium</Text>
            </View>
          </View>

          <View style={styles.tabsRow}>
            <TabButton active={authMethod === "phone"} label="Telefon" onPress={() => setAuthMethod("phone")} />
            <TabButton active={authMethod === "account" && mode === "login"} label="Login" onPress={() => {
              setAuthMethod("account");
              setMode("login");
            }} />
            <TabButton active={authMethod === "account" && mode === "register"} label="Register" onPress={() => {
              setAuthMethod("account");
              setMode("register");
            }} />
          </View>

          {authMethod === "phone" ? (
            <View style={styles.formBlock}>
              <Field label="Ism" value={phoneName} onChangeText={setPhoneName} placeholder="Masalan: Jamshid" />
              <Field
                label="Telefon raqam"
                value={phone}
                onChangeText={(t) => {
                  setPhone(formatUzbekPhone(t));
                  setOtpSent(false);
                  setSmsCode("");
                  setOtpHint(null);
                  setOtpVerifyAttempts(0);
                  setOtpLockUntil(0);
                }}
                placeholder={getUzbekPhonePlaceholder()}
                keyboardType="phone-pad"
                maxLength={UZBEKISTAN_PHONE_DISPLAY_MAX}
              />
              <Text style={styles.phoneHelper}>Format: {getUzbekPhonePlaceholder()}</Text>

              <TouchableOpacity
                style={[styles.secondaryBtn, (loading || resendCountdown > 0) && styles.btnDisabled]}
                onPress={handleSendSmsCode}
                disabled={loading || resendCountdown > 0 || isOtpLocked}
              >
                <Text style={styles.secondaryBtnText}>
                  {loading && loadingNote
                    ? "Yuborilmoqda..."
                    : isOtpLocked
                      ? `Qulf ochilishi: ${otpLockCountdown}s`
                    : resendCountdown > 0
                      ? `Qayta yuborish (${resendCountdown}s)`
                      : otpSent
                        ? "Qayta SMS yuborish"
                        : "SMS kod yuborish"}
                </Text>
              </TouchableOpacity>

              {otpSent ? (
                <Field
                  label="SMS kod"
                  value={smsCode}
                  onChangeText={(value) => setSmsCode(value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 xonali kod"
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.formBlock}>


              {mode === "register" ? (
                <Field label="Ism" value={name} onChangeText={setName} placeholder="To'liq ismingiz" />
              ) : null}
              <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Field label="Parol" value={password} onChangeText={setPassword} placeholder="Parolingiz" secureTextEntry allowPasswordToggle />
              {mode === "register" ? (
                <Field label="Parolni tasdiqlang" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Parolni qayta kiriting" secureTextEntry allowPasswordToggle />
              ) : null}

              {mode === "login" ? (
                <TouchableOpacity
                  style={[
                    styles.biometricBtn,
                    (!biometricAvailable || !hasBiometricCredentials || biometricBusy || loading) && styles.btnDisabled,
                  ]}
                  onPress={handleBiometricLogin}
                  disabled={!biometricAvailable || !hasBiometricCredentials || biometricBusy || loading}
                >
                  <Ionicons name="finger-print-outline" size={18} color="#dbeafe" />
                  <Text style={styles.biometricBtnText}>
                    {biometricBusy ? "Tekshirilmoqda..." : `${biometricLabel} bilan kirish`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {otpHint && authMethod === "phone" ? <Text style={styles.hint}>{otpHint}</Text> : null}
          {mode === "register" && authMethod === "account" ? <Text style={styles.hint}>Parol kuchli bo&apos;lsin: katta-kichik harf, raqam va maxsus belgi ishlating.</Text> : null}
          {loading ? <Text style={styles.waitHint}>{loadingNote || "Kuting..."}</Text> : null}

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {authMethod === "phone"
                  ? otpSent ? "Tasdiqlash va kirish" : "SMS kod bilan kirish"
                  : mode === "login"
                    ? "Kirish"
                    : "Register va kirish"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  allowPasswordToggle?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  autoCorrect?: boolean;
  textContentType?: "none" | "oneTimeCode";
}) {
  const [showPassword, setShowPassword] = useState(false);
  const withToggle = !!props.secureTextEntry && !!props.allowPasswordToggle;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={withToggle ? !showPassword : props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          maxLength={props.maxLength}
          autoCorrect={props.autoCorrect}
          textContentType={props.textContentType}
          style={[styles.input, withToggle && styles.inputWithToggle]}
        />
        {withToggle ? (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((prev) => !prev)}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050a16" },
  inner: { flexGrow: 1, justifyContent: "center", padding: 20 },
  glowA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.26)",
    top: 20,
    right: -60,
  },
  glowB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.18)",
    bottom: 60,
    left: -40,
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    ...Platform.select({
      web: { boxShadow: "0px 12px 30px rgba(2, 6, 23, 0.45)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 22,
        elevation: 8,
      },
    }),
  },
  header: { alignItems: "center", marginBottom: 18 },
  logoWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.16)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    overflow: "hidden",
    padding: 5,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  brand: { color: "#93c5fd", fontWeight: "900", marginTop: 10, fontSize: 13, textTransform: "uppercase", letterSpacing: 1.1 },
  title: { fontSize: 29, fontWeight: "900", color: "#f8fafc", marginTop: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", marginTop: 7, textAlign: "center", lineHeight: 20 },
  featureRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  featurePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 999,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
    backgroundColor: "rgba(30,58,138,0.24)",
  },
  featurePillText: { color: "#dbeafe", fontSize: 11, fontWeight: "800" },
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },

  tabBtn: { flex: 1, backgroundColor: "#0b1224", borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)" },
  tabBtnActive: { backgroundColor: "#1d4ed8", borderColor: "#60a5fa" },
  tabText: { color: "#cbd5e1", fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  formBlock: { gap: 4 },
  fieldWrap: { marginBottom: 10 },
  label: { fontSize: 14, fontWeight: "700", color: "#cbd5e1", marginBottom: 6 },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#0b1224",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#f8fafc",
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneHelper: { color: "#94a3b8", fontSize: 12, marginTop: -4, marginBottom: 12 },
  hint: { color: "#bfdbfe", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  waitHint: { color: "#cbd5e1", fontSize: 12, lineHeight: 18, marginBottom: 8 },
  primaryBtn: { backgroundColor: "#2563eb", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: { backgroundColor: "rgba(30,58,138,0.28)", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(96,165,250,0.28)" },
  secondaryBtnText: { color: "#bfdbfe", fontWeight: "800" },
  biometricBtn: {
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)",
    backgroundColor: "rgba(37,99,235,0.18)",
    borderRadius: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  biometricBtnText: {
    color: "#dbeafe",
    fontWeight: "800",
    fontSize: 14,
  },
  btnDisabled: { opacity: 0.7 },
});
