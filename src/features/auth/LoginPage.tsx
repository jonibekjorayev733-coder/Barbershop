import { FormEvent, useState } from "react";
import { loginUser, registerUser, requestPhoneOtp, verifyPhoneOtp, type LoginResponse } from "../admin-panel/api";

interface LoginPageProps {
  onLogin: (session: LoginResponse) => void;
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
      <div className="login-stage">
        <section className="login-story-card">
          <div className="login-brand">Sharp Cuts</div>
          <div className="login-story-kicker">Premium grooming experience</div>
          <h1 className="login-story-title">Birgina kirish sahifasidan zamonaviy salon taassuroti boshlansin.</h1>
          <p className="login-story-copy">
            Telefon bilan tez kirish yoki klassik login/register oqimi — ikkalasi ham tartibli, chiroyli va tushunarli ko'rinishda.
          </p>

          <div className="login-story-points">
            <article>
              <strong>Tezkor kirish</strong>
              <span>Telefon raqam orqali bir necha soniyada tasdiqlang.</span>
            </article>
            <article>
              <strong>Tartibli oqim</strong>
              <span>Avval usulni tanlaysiz, keyin faqat kerakli inputlar chiqadi.</span>
            </article>
            <article>
              <strong>Premium ko'rinish</strong>
              <span>Qoramtir, oltin aksentli, salon imidjiga mos interfeys.</span>
            </article>
          </div>
        </section>

        <section className="login-card login-card-premium">
          <div className="login-head-row">
            <div>
              <div className="login-brand-sub">Kirish markazi</div>
              <h1>{authMethod === "phone" ? "Telefon orqali kirish" : mode === "login" ? "Hisobga kirish" : "Ro'yxatdan o'tish"}</h1>
              <p>
                {authMethod === "phone"
                  ? "Telefoningizni kiriting — ism va raqam asosida SMS kod yuboramiz, so'ng bir zumda panelga kirasiz."
                  : mode === "login"
                    ? "Admin, sartarosh va foydalanuvchilar uchun email/parol orqali xavfsiz kirish."
                    : "Yangi foydalanuvchi uchun ro'yxatdan o'tish formasi. Birinchi kirishdayoq bron qilishga tayyor bo'lasiz."}
              </p>
            </div>
          </div>

          <div className="login-method-tabs login-method-tabs-primary">
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
            <button
              type="button"
              className={authMethod === "account" ? "active" : ""}
              onClick={() => {
                setAuthMethod("account");
                setErrorMessage(null);
              }}
            >
              Login / Register
            </button>
          </div>

          {authMethod === "account" ? (
            <div className="login-mode-tabs login-mode-tabs-secondary">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setErrorMessage(null);
                }}
              >
                Register
              </button>
            </div>
          ) : null}

          <form className="login-form" onSubmit={handleSubmit}>
            {authMethod === "phone" ? (
              <div className="login-field-cluster">
                <label>
                  <span>Ism</span>
                  <input
                    type="text"
                    value={phoneName}
                    onChange={(event) => setPhoneName(event.target.value)}
                    placeholder="Masalan: Jamshid"
                    autoComplete="name"
                  />
                </label>

                <label>
                  <span>Telefon raqam</span>
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

                {(otpHint || smsCode) ? (
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
                ) : null}
              </div>
            ) : (
              <div className="login-field-cluster">
                {mode === "register" ? (
                  <label>
                    <span>Ism</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="To'liq ismingiz"
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
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
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
              </div>
            )}

            {errorMessage ? <div className="login-error">{errorMessage}</div> : null}
            {otpHint && authMethod === "phone" ? <div className="login-hint">{otpHint}</div> : null}

            {mode === "register" && authMethod === "account" ? (
              <div className="login-hint">
                Parol kuchli bo'lsin: kamida 8 belgi, katta harf, kichik harf, raqam va maxsus belgi.
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
                    ? "Login"
                    : "Register va davom etish"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
