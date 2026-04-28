import { FormEvent, useEffect, useRef, useState } from "react";
import { updateAdminProfile } from "../api";
import { IBell, ISearch } from "../icons";
import { emitProfileSync } from "../../../lib/profileSync";
import { fileToOptimizedAvatarDataUrl } from "../../../lib/avatar";

interface TopbarProps {
  adminId: number;
  adminName: string;
  adminEmail: string;
  adminAvatar?: string | null;
  onProfileUpdated: (payload: { name: string; email: string; avatar?: string | null }) => void;
}

function getInitial(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "A";
  return source[0]?.toUpperCase() ?? "A";
}

export function Topbar({ adminId, adminName, adminEmail, adminAvatar, onProfileUpdated }: TopbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [name, setName] = useState(adminName);
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(adminAvatar ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(adminName);
    setEmail(adminEmail);
    setAvatarPreview(adminAvatar ?? null);
  }, [adminName, adminEmail, adminAvatar]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const result = await fileToOptimizedAvatarDataUrl(file);
        setAvatarPreview(result);
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "Rasm tayyorlanmadi.");
      }
    })();
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3200);
  };

  const closeProfile = () => {
    if (isSaving) return;
    setIsProfileOpen(false);
    setPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedName || !trimmedEmail) {
      showToast("error", "Ism va emailni to'ldiring.");
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateAdminProfile(adminId, {
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword || undefined,
        avatar: avatarPreview || undefined,
      });
      onProfileUpdated({ name: updated.name, email: updated.email, avatar: updated.avatar });
      emitProfileSync({ entityType: "admin", entityId: adminId, name: updated.name, email: updated.email, avatar: updated.avatar });
      setIsProfileOpen(false);
      setPassword("");
      showToast("success", "Profil ma'lumoti yangilandi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profilni saqlashda xatolik yuz berdi.";
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const avatarLabel = getInitial(adminName, adminEmail);
  const currentAvatar = avatarPreview || adminAvatar;

  return (
    <>
      {toast ? <div className={`ba-toast ba-toast-${toast.type}`}>{toast.message}</div> : null}

      <header className="topbar">
        <div className="tb-left">
          <div className="search-wrap">
            <span className="s-ico">
              <ISearch />
            </span>
            <input className="s-inp" placeholder="Mijoz, bron yoki sartaroshni qidiring…" />
          </div>
        </div>

        <div className="tb-right">
          <div className="tb-date">Du, 27-apr</div>
          <button className="icon-btn" aria-label="Bildirishnomalar">
            <IBell />
            <span className="n-dot" />
          </button>
          <button type="button" className="tb-av-btn" onClick={() => setIsProfileOpen(true)} aria-label="Profil sozlamalari">
            {currentAvatar ? (
              <img src={currentAvatar} alt={adminName} className="tb-av tb-av-img" />
            ) : (
              <span className="tb-av">{avatarLabel}</span>
            )}
          </button>
        </div>
      </header>

      {isProfileOpen ? (
        <div className="admin-profile-overlay" onClick={closeProfile}>
          <aside className="admin-profile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="barber-drawer-head">
              <h3>Admin profili</h3>
              <button type="button" className="barber-drawer-close" onClick={closeProfile} aria-label="Yopish">
                ×
              </button>
            </div>

            <form className="barber-form" onSubmit={handleSubmit}>
              <div className="prof-avatar-section">
                <div className="prof-avatar-wrap">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="prof-avatar-img" />
                  ) : (
                    <div className="prof-avatar-placeholder">{avatarLabel}</div>
                  )}
                  <button
                    type="button"
                    className="prof-avatar-edit"
                    onClick={() => fileInputRef.current?.click()}
                    title="Rasm tanlash"
                  >
                    ✎
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {avatarPreview && (
                  <button
                    type="button"
                    className="prof-avatar-remove"
                    onClick={() => { setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Rasmni o'chirish
                  </button>
                )}
              </div>

              <label className="barber-field">
                <span>Ism</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ism" />
              </label>

              <label className="barber-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                />
              </label>

              <label className="barber-field">
                <span>Yangi parol (ixtiyoriy)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Parolni yangilash uchun kiriting"
                  autoComplete="new-password"
                />
              </label>

              <div className="barber-form-actions">
                <button type="button" className="ba-sec" onClick={closeProfile} disabled={isSaving}>
                  Bekor qilish
                </button>
                <button type="submit" className="ba-pri" disabled={isSaving}>
                  {isSaving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
