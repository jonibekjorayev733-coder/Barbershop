import { LoginPage } from "../auth/LoginPage";
import type { LoginResponse } from "../admin-panel/api";

interface PublicLoginPageProps {
  onLogin: (session: LoginResponse) => void;
  onBack: () => void;
}

export function PublicLoginPage({ onLogin, onBack }: PublicLoginPageProps) {
  return (
    <div className="public-login-shell">
      <div className="public-login-top">
        <button type="button" className="public-back-btn" onClick={onBack}>
          ← Xaritaga qaytish
        </button>
      </div>
      <LoginPage onLogin={onLogin} />
    </div>
  );
}
