import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  loginUser,
  registerUser,
  requestPhoneOtp,
  warmupServer,
  verifyPhoneOtp,
  type LoginResponse,
} from "@/services/api";
import { notifyOtpCode } from "@/services/NotificationService";
import { useAuth } from "@/context/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoute";

type AuthMethod = "account" | "phone";
type AuthMode = "login" | "register";

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export default function AuthScreen({ initialMode = "login" }: AuthScreenProps) {
  const { signIn } = useAuth();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingNote, setLoadingNote] = useState<string | null>(null);

  const fillQuickUser = (nextEmail: string, nextPassword: string) => {
    setAuthMethod("account");
    setMode("login");
    setEmail(nextEmail);
    setPassword(nextPassword);
  };

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
      ? "Web’dagidek sodda login formasi"
      : "Yangi foydalanuvchi uchun qisqa register formasi";
  }, [authMethod, mode]);

  useEffect(() => {
    void warmupServer();
  }, []);

  const finishAuth = async (session: LoginResponse) => {
    await signIn(session);
    router.replace(getHomeRouteByRole(session.role));
  };

  const handleSubmit = async () => {
    if (authMethod === "phone") {
      if (!phone.trim() || !smsCode.trim()) {
        Alert.alert("Xatolik", "Telefon va SMS kodni kiriting");
        return;
      }

      try {
        setLoading(true);
        setLoadingNote("Kirilmoqda...");
        const session = await verifyPhoneOtp({
          name: phoneName.trim() || undefined,
          phone: phone.trim(),
          code: smsCode.trim(),
        });
        await finishAuth(session);
      } catch (error: unknown) {
        Alert.alert("Xatolik", error instanceof Error ? error.message : "SMS bilan kirishda xatolik");
      } finally {
        setLoadingNote(null);
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) {
      Alert.alert("Xatolik", "Kerakli maydonlarni to'ldiring");
      return;
    }

    if (mode === "register" && password.trim() !== confirmPassword.trim()) {
      Alert.alert("Xatolik", "Parollar bir xil emas");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote(mode === "login" ? "Kirilmoqda..." : "Ro'yxatdan o'tilmoqda...");
      const session = await (
        mode === "login"
          ? loginUser(email.trim(), password.trim())
          : registerUser(name.trim(), email.trim(), password.trim())
      );
      await finishAuth(session);
    } catch (error: unknown) {
      Alert.alert("Xatolik", error instanceof Error ? error.message : "Kirish muvaffaqiyatsiz");
    } finally {
      setLoadingNote(null);
      setLoading(false);
    }
  };

  const handleSendSmsCode = async () => {
    if (!phone.trim()) {
      Alert.alert("Xatolik", "Telefon raqamini kiriting");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote("SMS kod yuborilmoqda...");
      const response = await requestPhoneOtp({
        name: phoneName.trim() || undefined,
        phone: phone.trim(),
      });
      setOtpSent(true);
      setSmsCode("");
      startCountdown(45);
      try {
        await notifyOtpCode();
      } catch {
        // local notification fail bo'lsa login oqimini to'xtatmaymiz
      }
      setOtpHint(
        "SMS yuborildi! Telefoningizni tekshiring 📱",
      );
    } catch (error: unknown) {
      Alert.alert("Xatolik", error instanceof Error ? error.message : "SMS kod yuborilmadi");
    } finally {
      setLoadingNote(null);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.logo}>✂️</Text>
            <Text style={styles.brand}>Sharp Cuts</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
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
                onChangeText={(t) => { setPhone(t); setOtpSent(false); setSmsCode(""); setOtpHint(null); }}
                placeholder="998901234567"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.secondaryBtn, (loading || resendCountdown > 0) && styles.btnDisabled]}
                onPress={handleSendSmsCode}
                disabled={loading || resendCountdown > 0}
              >
                <Text style={styles.secondaryBtnText}>
                  {loading && loadingNote
                    ? "Yuborilmoqda..."
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
                  onChangeText={setSmsCode}
                  placeholder="6 xonali kod"
                  keyboardType="number-pad"
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.formBlock}>
              {mode === "login" ? (
                <View style={styles.quickUsersRow}>
                  <TouchableOpacity style={styles.quickUserChip} onPress={() => fillQuickUser("student@test.com", "student123")}>
                    <Text style={styles.quickUserText}>Student demo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickUserChip} onPress={() => fillQuickUser("teacher@test.com", "teacher123")}>
                    <Text style={styles.quickUserText}>Teacher demo</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {mode === "register" ? (
                <Field label="Ism" value={name} onChangeText={setName} placeholder="To'liq ismingiz" />
              ) : null}
              <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Parol" value={password} onChangeText={setPassword} placeholder="Parolingiz" secureTextEntry />
              {mode === "register" ? (
                <Field label="Parolni tasdiqlang" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Parolni qayta kiriting" secureTextEntry />
              ) : null}
            </View>
          )}

          {otpHint && authMethod === "phone" ? <Text style={styles.hint}>{otpHint}</Text> : null}
          {mode === "register" && authMethod === "account" ? <Text style={styles.hint}>Parol kuchli bo'lsin: katta-kichik harf, raqam va maxsus belgi ishlating.</Text> : null}
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
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef4ff" },
  inner: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  header: { alignItems: "center", marginBottom: 18 },
  logo: { fontSize: 56 },
  brand: { color: "#1a73e8", fontWeight: "800", marginTop: 8, fontSize: 14, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginTop: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 6, textAlign: "center" },
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  quickUsersRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  quickUserChip: { flex: 1, backgroundColor: "#eef2ff", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  quickUserText: { color: "#1e3a8a", fontWeight: "700", fontSize: 12 },
  tabBtn: { flex: 1, backgroundColor: "#e2e8f0", borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#1a73e8" },
  tabText: { color: "#334155", fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  formBlock: { gap: 4 },
  fieldWrap: { marginBottom: 10 },
  label: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  hint: { color: "#475569", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  waitHint: { color: "#334155", fontSize: 12, lineHeight: 18, marginBottom: 8 },
  primaryBtn: { backgroundColor: "#1a73e8", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: { backgroundColor: "#eaf2ff", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 12 },
  secondaryBtnText: { color: "#1a73e8", fontWeight: "800" },
  btnDisabled: { opacity: 0.7 },
});
