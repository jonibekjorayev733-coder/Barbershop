import { FormEvent, useState } from "react";
import { loginUser, registerUser, requestPhoneOtp, verifyPhoneOtp, type LoginResponse } from "../admin-panel/api";

interface LoginPageProps {
  onLogin: (session: LoginResponse) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authMethod === "phone") {
      if (!phone.trim() || !smsCode.trim()) {
        setErrorMessage("Telefon va SMS kodni kiriting.");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        const session = await verifyPhoneOtp({
          name: phoneName.trim() || undefined,
          phone: phone.trim(),
          code: smsCode.trim(),
        });
        onLogin(session);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "SMS bilan kirishda xatolik yuz berdi.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) {
      setErrorMessage("Kerakli maydonlarni to'ldiring.");
      return;
    }

    if (mode === "register" && password.trim() !== confirmPassword.trim()) {
      setErrorMessage("Parollar bir xil emas.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const session =
        mode === "login"
          ? await loginUser({ email: email.trim(), password: password.trim() })
          : await registerUser({
              name: name.trim(),
              email: email.trim(),
              password: password.trim(),
            });

      if (session.role !== "admin" && session.role !== "barber" && session.role !== "student" && session.role !== "user") {
        setErrorMessage("Noma'lum rol bilan kirish rad etildi.");
        return;
      }

      onLogin(session);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login xatoligi yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSmsCode = async () => {
    if (!phone.trim()) {
      setErrorMessage("Telefon raqamini kiriting.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await requestPhoneOtp({ name: phoneName.trim() || undefined, phone: phone.trim() });
      setOtpHint(response.debug_code ? `SMS kod yuborildi. Test kod: ${response.debug_code}` : response.message || "SMS kod yuborildi.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "SMS kod yuborilmadi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Sharp Cuts</div>
        <h1>{mode === "login" ? "Hisobga kirish" : "Oddiy user ro'yxatdan o'tishi"}</h1>
        <p>
          {authMethod === "phone"
            ? "Telefon raqam kiriting, SMS kodni tasdiqlang va tizimga kiring. Mavjud admin, sartarosh yoki user topilsa o'sha profilga kirasiz."
            : mode === "login"
              ? "Admin va sartarosh login qiladi. Oddiy user register bo'lganidan keyin login yoki auto kiradi."
              : "Faqat oddiy user uchun register. Admin/sartarosh register qilmaydi."}
        </p>

        <div className="login-method-tabs">
          <button
            type="button"
            className={authMethod === "email" ? "active" : ""}
            onClick={() => {
              setAuthMethod("email");
              setErrorMessage(null);
            }}
          >
            Email bilan
          </button>
          <button
            type="button"
            className={authMethod === "phone" ? "active" : ""}
            onClick={() => {
              setAuthMethod("phone");
              setErrorMessage(null);
            }}
          >
            Telefon bilan
          </button>
        </div>

        {authMethod === "email" ? (
          <div className="login-mode-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setErrorMessage(null);
              }}
            >
              Kirish
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setErrorMessage(null);
              }}
            >
              Register (User)
            </button>
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          {authMethod === "phone" ? (
            <>
              <label>
                <span>Ism</span>
                <input
                  type="text"
                  value={phoneName}
                  onChange={(event) => setPhoneName(event.target.value)}
                  placeholder="Ismingiz (yangi user uchun)"
                  autoComplete="name"
                />
              </label>

              <label>
                <span>Telefon</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="998901234567"
                  autoComplete="tel"
                />
              </label>

              <button type="button" className="login-secondary-btn" onClick={() => void handleSendSmsCode()} disabled={isLoading}>
                {isLoading ? "Yuborilmoqda..." : "SMS kod yuborish"}
              </button>

              <label>
                <span>SMS kod</span>
                <input
                  type="text"
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value)}
                  placeholder="6 xonali kod"
                  autoComplete="one-time-code"
                />
              </label>
            </>
          ) : mode === "register" ? (
            <label>
              <span>Ism</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ismingiz"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
            />
          </label>

          <label>
            <span>Parol</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Parolingiz"
              autoComplete="current-password"
            />
          </label>

          {mode === "register" ? (
            <label>
              <span>Parolni tasdiqlang</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Parolni qayta kiriting"
                autoComplete="new-password"
              />
            </label>
          ) : null}

          {errorMessage ? <div className="login-error">{errorMessage}</div> : null}
          {otpHint && authMethod === "phone" ? <div className="login-hint">{otpHint}</div> : null}

          {mode === "register" && authMethod === "email" ? (
            <div className="login-hint">
              Parol: kamida 8 belgi, 1 katta, 1 kichik, 1 raqam va 1 maxsus belgi.
            </div>
          ) : null}

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading
              ? authMethod === "phone"
                ? "Tasdiqlanmoqda..."
                : mode === "login"
                  ? "Kirilmoqda..."
                  : "Ro'yxatdan o'tilmoqda..."
              : authMethod === "phone"
                ? "SMS kod bilan kirish"
                : mode === "login"
                  ? "Kirish"
                  : "Register va kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
