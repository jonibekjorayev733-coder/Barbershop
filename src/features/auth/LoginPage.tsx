import { FormEvent, useState } from "react";
import { loginUser, registerUser, type LoginResponse } from "../admin-panel/api";

interface LoginPageProps {
  onLogin: (session: LoginResponse) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Sharp Cuts</div>
        <h1>{mode === "login" ? "Hisobga kirish" : "Oddiy user ro'yxatdan o'tishi"}</h1>
        <p>
          {mode === "login"
            ? "Admin va sartarosh login qiladi. Oddiy user register bo'lganidan keyin login yoki auto kiradi."
            : "Faqat oddiy user uchun register. Admin/sartarosh register qilmaydi."}
        </p>

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

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
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

          {mode === "register" ? (
            <div className="login-hint">
              Parol: kamida 8 belgi, 1 katta, 1 kichik, 1 raqam va 1 maxsus belgi.
            </div>
          ) : null}

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading
              ? mode === "login"
                ? "Kirilmoqda..."
                : "Ro'yxatdan o'tilmoqda..."
              : mode === "login"
                ? "Kirish"
                : "Register va kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
