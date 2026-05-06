import { type FormEvent, useEffect, useMemo, useState } from "react";
import { barberStatusLabel, topCopy } from "../copy";
import { ICal, IPhone, ISciss, IStar, ITrend, IUsers } from "../icons";
import {
  deleteBarber,
  getBarbers,
  updateBarber,
  type BarberApi,
  type BarberApiPayload,
} from "../api";
import { StatCard } from "./StatCard";
import type { BarberStatus } from "../types";
import { subscribeProfileSync } from "../../../lib/profileSync";
import { subscribeRealtimeChannel } from "../../../lib/realtime";

interface BarberFormState {
  name: string;
  specialty: string;
  phone: string;
  rating: string;
  totalCuts: string;
  todayCuts: string;
  status: BarberStatus;
  photo_url: string;
  years_experience: string;
  username: string;
  password: string;
  bio: string;
}

const colorByStatus: Record<BarberStatus, string> = {
  available: "#34d399",
  busy: "#f59e0b",
  off: "#94a3b8",
};

const gradientByStatus: Record<BarberStatus, string> = {
  available: "linear-gradient(135deg,#10b981,#34d399)",
  busy: "linear-gradient(135deg,#d97706,#f59e0b)",
  off: "linear-gradient(135deg,#475569,#64748b)",
};

const emptyForm: BarberFormState = {
  name: "",
  specialty: "",
  phone: "",
  rating: "4.8",
  totalCuts: "0",
  todayCuts: "0",
  status: "available",
  photo_url: "",
  years_experience: "1",
  username: "",
  password: "",
  bio: "",
};

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "SB";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function toPayload(form: BarberFormState): BarberApiPayload {
  return {
    name: form.name.trim(),
    specialty: form.specialty.trim(),
    phone: form.phone.trim(),
    rating: Number(form.rating) || 0,
    total_cuts: Number(form.totalCuts) || 0,
    today_cuts: Number(form.todayCuts) || 0,
    status: form.status,
    color: colorByStatus[form.status],
    gradient: gradientByStatus[form.status],
    photo_url: form.photo_url.trim(),
    years_experience: Number(form.years_experience) || 0,
    username: form.username.trim(),
    password: form.password.trim(),
    bio: form.bio.trim(),
  };
}

function fromApiToForm(barber: BarberApi): BarberFormState {
  return {
    name: barber.name,
    specialty: barber.specialty,
    phone: barber.phone,
    rating: String(barber.rating),
    totalCuts: String(barber.total_cuts),
    todayCuts: String(barber.today_cuts),
    status: barber.status,
    photo_url: barber.photo_url || "",
    years_experience: String(barber.years_experience || 1),
    username: barber.username || "",
    password: barber.password || "",
    bio: barber.bio || "",
  };
}

export function BarbersPage() {
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [barbers, setBarbers] = useState<BarberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BarberFormState>(emptyForm);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BarberApi | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditing = editingId !== null;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3200);
  };

  const loadBarbers = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const rows = await getBarbers();
      setBarbers(rows);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sartaroshlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBarbers();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeProfileSync((payload) => {
      if (payload.entityType !== "barber") {
        return;
      }

      setBarbers((current) =>
        current.map((barber) =>
          barber.id === payload.entityId
            ? {
                ...barber,
                name: payload.name ?? barber.name,
                username: payload.email ?? barber.username,
                photo_url: payload.avatar !== undefined ? (payload.avatar ?? undefined) : barber.photo_url,
              }
            : barber,
        ),
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("bookings", (payload) => {
      if (!["barber.profile.updated", "barber.rating.updated", "barber.discount.updated", "barber.admin.created", "barber.admin.updated", "barber.admin.deleted", "booking.created", "booking.accepted", "booking.completed", "booking.cancelled", "booking.rated"].includes(payload.event)) {
        return;
      }

      void loadBarbers().catch(() => undefined);
    });

    return unsubscribe;
  }, []);

  const handleDeleteBarber = async (barberId: number) => {
    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await deleteBarber(barberId);
      await loadBarbers();
      setDeleteTarget(null);
      showToast("success", "Sartarosh muvaffaqiyatli o'chirildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "O'chirishda xatolik yuz berdi.";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDrawer = (barber: BarberApi) => {
    setEditingId(barber.id);
    setForm(fromApiToForm(barber));
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isSaving) {
      return;
    }
    setIsDrawerOpen(false);
  };

  const openDeleteModal = (barber: BarberApi) => {
    setDeleteTarget(barber);
  };

  const closeDeleteModal = () => {
    if (isDeleting) {
      return;
    }
    setDeleteTarget(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.specialty.trim() || !form.phone.trim()) {
      const message = "Ism, yo'nalish va telefon maydonlarini to'ldiring.";
      setErrorMessage(message);
      showToast("error", message);
      return;
    }

    const normalizedEmail = form.username.trim().toLowerCase();
    if (!normalizedEmail) {
      const message = "Login uchun email kiriting.";
      setErrorMessage(message);
      showToast("error", message);
      return;
    }

    const duplicateEmail = barbers.some(
      (barber) => barber.id !== editingId && (barber.username || "").trim().toLowerCase() === normalizedEmail,
    );
    if (duplicateEmail) {
      const message = "Bu email avvaldan bor. Boshqa email kiriting.";
      setErrorMessage(message);
      showToast("error", message);
      return;
    }

    if (!isEditing || editingId === null) {
      const message = "Yangi sartarosh qo'shish o'chirilgan. Faqat mavjud profilni tahrirlash mumkin.";
      setErrorMessage(message);
      showToast("error", message);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const payload = toPayload(form);

      await updateBarber(editingId, payload);

      await loadBarbers();
      setIsDrawerOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      showToast("success", "Sartarosh ma'lumoti yangilandi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Saqlashda xatolik yuz berdi.";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: barbers.length,
      available: barbers.filter((barber) => barber.status === "available").length,
      busy: barbers.filter((barber) => barber.status === "busy").length,
      off: barbers.filter((barber) => barber.status === "off").length,
    }),
    [barbers],
  );

  return (
    <>
      {toast ? (
        <div className={`ba-toast ba-toast-${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}

      <div className="ph">
        <div>
          <div className="ph-eyebrow">{topCopy.barbers.eyebrow}</div>
          <h2 className="ph-title">{topCopy.barbers.title}</h2>
          <p className="ph-sub">{topCopy.barbers.subtitle}</p>
        </div>
      </div>

      {errorMessage ? <div className="barber-alert">{errorMessage}</div> : null}

      <div className="sc-row">
        <StatCard
          value={String(stats.total)}
          label="Jami xodimlar"
          sub="Barcha sartaroshlar soni"
          gradient="linear-gradient(135deg,#1e40af,#3b82f6)"
          icon={<IUsers />}
        />
        <StatCard
          value={String(stats.available)}
          label="Bo'sh sartaroshlar"
          sub="Hozir ishga tayyor"
          gradient="linear-gradient(135deg,#065f46,#059669)"
          icon={<ITrend />}
        />
        <StatCard
          value={String(stats.busy)}
          label="Band sartaroshlar"
          sub="Hozir mijoz bilan"
          gradient="linear-gradient(135deg,#78350f,#d97706)"
          icon={<ISciss />}
        />
        <StatCard
          value={String(stats.off)}
          label="Dam olayotganlar"
          sub="Ishda emas"
          gradient="linear-gradient(135deg,#334155,#64748b)"
          icon={<ICal />}
        />
      </div>

      <div className="barbers-grid">
        {loading ? <div className="barber-empty">Yuklanmoqda...</div> : null}
        {!loading && barbers.length === 0 ? <div className="barber-empty">Hozircha sartarosh yo'q.</div> : null}
        {barbers.map((barber) => (
          <div className="barber-card" key={barber.id}>
            <div className="barber-card-glow" style={{ background: `${barber.color}22` }} />
            <div className="bcard-top">
              {barber.photo_url ? (
                <img src={barber.photo_url} alt={barber.name} className="b-av b-av-img" />
              ) : (
                <div className="b-av" style={{ background: barber.gradient }}>
                  {getInitials(barber.name)}
                </div>
              )}
              <span className={`pill pill-${barber.status}`}>{barberStatusLabel[barber.status]}</span>
            </div>

            <h4 className="b-name">{barber.name}</h4>
            <p className="b-spec">{barber.specialty}</p>

            <div className="b-stats">
              <div className="bst">
                <span className="bst-ico" style={{ color: barber.color }}>
                  <IStar />
                </span>
                {barber.rating}
              </div>
              <div className="bst">
                <span className="bst-ico">
                  <ISciss />
                </span>
                {barber.total_cuts} ta (jami)
              </div>
              <div className="bst">
                <span className="bst-ico">
                  <ICal />
                </span>
                {barber.today_cuts} ta (bugun)
              </div>
            </div>

            <div className="b-progress">
              <div className="b-prog-top">
                <span>Bugun qilgan ishlar</span>
                <span>{barber.today_cuts} ta kesim</span>
              </div>
              <div className="b-track">
                <div
                  style={{ width: `${Math.min(100, barber.today_cuts * 14)}%`, background: barber.gradient }}
                  className="b-fill"
                />
              </div>
            </div>

            <hr className="b-hr" />
            <div className="b-phone">
              <span style={{ color: barber.color }}>
                <IPhone />
              </span>
              {barber.phone}
            </div>
            <div className="b-actions">
              <button className="ba-sec">Jadval</button>
              <button className="ba-pri" style={{ background: barber.gradient }} onClick={() => openEditDrawer(barber)}>
                Profilni tahrirlash
              </button>
              <button className="ba-del" onClick={() => openDeleteModal(barber)}>
                O'chirish
              </button>
            </div>
          </div>
        ))}
      </div>

      {isDrawerOpen ? (
        <div className="barber-drawer-overlay" onClick={closeDrawer}>
          <aside className="barber-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="barber-drawer-head">
              <h3>Sartaroshni tahrirlash</h3>
              <button className="barber-drawer-close" onClick={closeDrawer} aria-label="Yopish">
                ×
              </button>
            </div>

            <form className="barber-form" onSubmit={handleSubmit}>
              <label className="barber-field">
                <span>Ism</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Masalan: Ali Valiyev"
                />
              </label>

              <label className="barber-field">
                <span>Yo'nalish</span>
                <input
                  value={form.specialty}
                  onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))}
                  placeholder="Fade, klassik, soqol..."
                />
              </label>

              <label className="barber-field">
                <span>Telefon</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+998 90 123 45 67"
                />
              </label>

              <label className="barber-field">
                <span>Rasm URL (Photo URL)</span>
                <input
                  value={form.photo_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, photo_url: event.target.value }))}
                  placeholder="https://..."
                  type="url"
                />
              </label>

              <div className="barber-form-row">
                <label className="barber-field">
                  <span>Reyting (1-5)</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={(event) => setForm((prev) => ({ ...prev, rating: event.target.value }))}
                  />
                </label>

                <label className="barber-field">
                  <span>Tajribasi (yillar)</span>
                  <input
                    type="number"
                    min="0"
                    value={form.years_experience}
                    onChange={(event) => setForm((prev) => ({ ...prev, years_experience: event.target.value }))}
                  />
                </label>
              </div>

              <div className="barber-form-row">
                <label className="barber-field">
                  <span>Email (login uchun)</span>
                  <input
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                    placeholder="Masalan: barber@mail.com"
                  />
                </label>

                <label className="barber-field">
                  <span>Parol (Password)</span>
                  <div style={{ position: "relative" }}>
                    <input type={showFormPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder={isEditing ? "Bo'sh qoldirsangiz o'zgarmaydi" : "Masalan: cut123"} style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }} />
                    <button type="button" onClick={() => setShowFormPassword((v) => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748b", fontSize: 16 }} tabIndex={-1} aria-label="Parolni ko'rsatish">{showFormPassword ? "🙈" : "👁"}</button>
                  </div>
                </label>
              </div>

              <label className="barber-field">
                <span>Bio (Qisqa tasnif)</span>
                <textarea
                  className="barber-textarea"
                  value={form.bio}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="Qisqa tasnif yozing..."
                  rows={3}
                />
              </label>

              <div className="barber-form-actions">
                <button type="button" className="ba-sec" onClick={closeDrawer}>
                  Bekor qilish
                </button>
                <button type="submit" className="ba-pri" style={{ background: gradientByStatus[form.status] }} disabled={isSaving}>
                  {isSaving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="confirm-overlay" onClick={closeDeleteModal}>
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <h4>Sartaroshni o'chirish</h4>
            <p>
              Rostdan ham <strong>{deleteTarget.name}</strong> ni o'chirmoqchimisiz?
            </p>
            <div className="confirm-actions">
              <button type="button" className="ba-sec" onClick={closeDeleteModal} disabled={isDeleting}>
                Bekor qilish
              </button>
              <button
                type="button"
                className="ba-del"
                onClick={() => handleDeleteBarber(deleteTarget.id)}
                disabled={isDeleting}
              >
                {isDeleting ? "O'chirilmoqda..." : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
