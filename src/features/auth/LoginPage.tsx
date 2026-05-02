import { FormEvent, useState } from "react";
import { loginUser, registerUser, requestPhoneOtp, verifyPhoneOtp, type LoginResponse } from "../admin-panel/api";

interface LoginPageProps {
  onLogin: (session: LoginResponse) => void;
}

function normalizeUzPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) return digits;
  if (digits.startsWith("998")) return digits;
  if (digits.length === 9) return "998" + digits;
  if (digits.startsWith("8") && digits.length === 11) return "998" + digits.slice(1);
  return digits;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [authMethod, setAuthMethod] = useState<"account" | "phone">("account");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => { setErrorMessage(null); setSuccessMessage(null); };

  const switchMethod = (method: "phone" | "account", newMode?: "login" | "register") => {
    setAuthMethod(method);
    if (newMode) setMode(newMode);
    clearMessages();
    setOtpHint(null);
    setOtpSent(false);
    setSmsCode("");
  };

  const handleSendSmsCode = async () => {
    const normalized = normalizeUzPhone(phone.trim());
    if (normalized.length < 9) {
      setErrorMessage("To`g`ri telefon raqam kiriting. Masalan: 901234567");
      return;
    }
    try {
      setIsSendingOtp(true);
      clearMessages();
      const response = await requestPhoneOtp({ name: phoneName.trim() || undefined, phone: normalized });
      setOtpSent(true);
      setPhone(normalized);
      const hint = response.debug_code
        ? "Test kod: " + response.debug_code
        : response.message || "SMS kod yuborildi. Telefoningizni tekshiring.";
      setOtpHint(hint);
      setSuccessMessage(hint);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "SMS kod yuborilmadi. Keyinroq urinib ko`ring.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (authMethod === "phone") {
      const normalized = normalizeUzPhone(phone.trim());
      if (normalized.length < 9) { setErrorMessage("To`g`ri telefon raqam kiriting."); return; }
      if (!smsCode.trim()) { setErrorMessage("Avval SMS kod yuborish tugmasini bosing, keyin kodni kiriting."); return; }
      try {
        setIsLoading(true);
        const session = await verifyPhoneOtp({ name: phoneName.trim() || undefined, phone: normalized, code: smsCode.trim() });
        onLogin(session);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "SMS kod noto`g`ri yoki muddati o`tgan.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email.trim()) { setErrorMessage("Email kiriting."); return; }
    if (!password.trim()) { setErrorMessage("Parol kiriting."); return; }
    if (mode === "register") {
      if (!name.trim()) { setErrorMessage("Ismingizni kiriting."); return; }
      if (password.trim().length < 6) { setErrorMessage("Parol kamida 6 ta belgidan iborat bo`lishi kerak."); return; }
      if (password.trim() !== confirmPassword.trim()) { setErrorMessage("Parollar bir xil emas."); return; }
    }

    try {
      setIsLoading(true);
      const session =
        mode === "login"
          ? await loginUser({ email: email.trim(), password: password.trim() })
          : await registerUser({ name: name.trim(), email: email.trim(), password: password.trim() });
      onLogin(session);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      if (raw.includes("401") || raw.toLowerCase().includes("noto`g`ri")) {
        setErrorMessage("Email yoki parol noto`g`ri.");
      } else if (raw.toLowerCase().includes("allaqachon")) {
        setErrorMessage(raw + " Login orqali kiring.");
      } else {
        setErrorMessage(raw || "Xatolik yuz berdi. Qayta urinib ko`ring.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card login-compact-card">
        <div className="login-head-row">
          <div>
            <div className="login-brand">Sharp Cuts</div>
            <h1>
              {authMethod === "phone" ? "Telefon bilan kirish" : mode === "login" ? "Hisobga kirish" : "Ro`yxatdan o`tish"}
            </h1>
            <p>
              {authMethod === "phone"
                ? "Telefon raqamingizga SMS kod yuboriladi."
                : mode === "login"
                  ? "Email va parol bilan xavfsiz kirish."
                  : "Yangi hisob ochish."}
            </p>
          </div>
        </div>

        <div className="login-method-tabs login-method-tabs-3">
          <button type="button" className={authMethod === "phone" ? "active" : ""} onClick={() => switchMethod("phone")}>
            Telefon
          </button>
          <button type="button" className={authMethod === "account" && mode === "login" ? "active" : ""} onClick={() => switchMethod("account", "login")}>
            Login
          </button>
          <button type="button" className={authMethod === "account" && mode === "register" ? "active" : ""} onClick={() => switchMethod("account", "register")}>
            Register
          </button>
        </div>

        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          {authMethod === "phone" ? (
            <div className="login-field-cluster">
              <label>
                <span>Ism (ixtiyoriy)</span>
                <input type="text" value={phoneName} onChange={(e) => setPhoneName(e.target.value)} placeholder="Masalan: Jamshid" autoComplete="name" />
              </label>
              <label>
                <span>Telefon raqam *</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setOtpSent(false); setOtpHint(null); clearMessages(); }}
                  placeholder="901234567 yoki 998901234567"
                  autoComplete="tel"
                />
              </label>
              <button type="button" className="login-secondary-btn" onClick={() => void handleSendSmsCode()} disabled={isSendingOtp || isLoading}>
                {isSendingOtp ? "Yuborilmoqda..." : otpSent ? "Qayta yuborish" : "SMS kod yuborish"}
              </button>
              {(otpSent || smsCode) ? (
                <label>
                  <span>SMS kod *</span>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="6 xonali SMS kod"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <div className="login-field-cluster">
              {mode === "register" ? (
                <label>
                  <span>Ism *</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="To`liq ismingiz" autoComplete="name" />
                </label>
              ) : null}
              <label>
                <span>Email *</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
              </label>
              <label>
                <span>Parol *</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Kamida 6 ta belgi" : "Parolingiz"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>
              {mode === "register" ? (
                <label>
                  <span>Parolni tasdiqlang *</span>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Parolni qayta kiriting" autoComplete="new-password" />
                </label>
              ) : null}
            </div>
          )}

          {errorMessage ? <div className="login-error">{errorMessage}</div> : null}
          {successMessage && !errorMessage ? <div className="login-hint">{successMessage}</div> : null}
          {mode === "register" && authMethod === "account" && !errorMessage ? (
            <div className="login-hint">Parol kamida 6 ta belgidan iborat bolishi kerak.</div>
          ) : null}

          <button type="submit" className="login-btn" disabled={isLoading || isSendingOtp}>
            {isLoading
              ? authMethod === "phone" ? "Tasdiqlanmoqda..." : mode === "login" ? "Kirilmoqda..." : "Ro`yxatdan o`tilmoqda..."
              : authMethod === "phone" ? "Kirish" : mode === "login" ? "Kirish" : "Ro`yxatdan o`tish"}
          </button>

          {authMethod === "account" ? (
            <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
              {mode === "login"
                ? <span>Hisob yo`qmi? <button type="button" style={{ background: "none", border: "none", color: "#0f766e", cursor: "pointer", fontWeight: 700, fontSize: "13px" }} onClick={() => switchMethod("account", "register")}>Ro`yxatdan o`ting</button></span>
                : <span>Hisob bor? <button type="button" style={{ background: "none", border: "none", color: "#0f766e", cursor: "pointer", fontWeight: 700, fontSize: "13px" }} onClick={() => switchMethod("account", "login")}>Kirish</button></span>}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
