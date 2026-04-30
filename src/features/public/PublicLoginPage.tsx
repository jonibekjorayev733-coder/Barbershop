import { LoginPage } from "../auth/LoginPage";
import type { LoginResponse } from "../admin-panel/api";

interface PublicLoginPageProps {
  onLogin: (session: LoginResponse) => void;
}

export function PublicLoginPage({ onLogin }: PublicLoginPageProps) {
  return (
    <div className="public-login-shell">
      <LoginPage onLogin={onLogin} />
    </div>
  );
}
