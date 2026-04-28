import { type FormEvent, useEffect, useMemo, useState } from "react";
import { barberStatusLabel, topCopy } from "../copy";
import { ICal, IPhone, IPlus, ISciss, IStar, ITrend, IUsers } from "../icons";
import { createBarber, getBarbers, updateBarber, deleteBarber, type BarberApi, type BarberApiPayload } from "../api";
import { StatCard } from "./StatCard";
import type { BarberStatus } from "../types";

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
  const [barbers, setBarbers] = useState<BarberApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BarberFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = editingId !== null;

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

  const handleDeleteBarber = async (barberId: number) => {
    try {
      setErrorMessage(null);
      await deleteBarber(barberId);
      await loadBarbers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "O'chirishda xatolik yuz berdi.");
    }
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDrawerOpen(true);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.specialty.trim() || !form.phone.trim()) {
      setErrorMessage("Ism, yo'nalish va telefon maydonlarini to'ldiring.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const payload = toPayload(form);

      if (isEditing && editingId !== null) {
        await updateBarber(editingId, payload);
      } else {
        await createBarber(payload);
      }

      await loadBarbers();
      setIsDrawerOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Saqlashda xatolik yuz berdi.");
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
      <div className="ph">
        <div>
          <div className="ph-eyebrow">{topCopy.barbers.eyebrow}</div>
          <h2 className="ph-title">{topCopy.barbers.title}</h2>
          <p className="ph-sub">{topCopy.barbers.subtitle}</p>
        </div>
        <button className="btn-glow" onClick={openCreateDrawer}>
          <IPlus /> {topCopy.barbers.cta}
        </button>
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
              <div className="b-av" style={{ background: barber.gradient }}>
                {getInitials(barber.name)}
              </div>
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
              <button 
                className="ba-del" 
                onClick={() => {
                  if (confirm("Bu sartaroshni o'chirib tashlamoqchisiz?")) {
                    handleDeleteBarber(barber.id);
                  }
                }}
              >
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
              <h3>{isEditing ? "Sartaroshni tahrirlash" : "Yangi sartarosh qo'shish"}</h3>
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
                  <span>Foydalanuvchi nomi (Username)</span>
                  <input
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                    placeholder="Masalan: marcus"
                  />
                </label>

                <label className="barber-field">
                  <span>Parol (Password)</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Masalan: cut123"
                  />
                </label>
              </div>

              <label className="barber-field">
                <span>Bio (Qisqa tasnif)</span>
                <textarea
                  value={form.bio}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="Qisqa tasnif yozing..."
                  rows={3}
                  style={{ minHeight: "80px", resize: "none" }}
                />
              </label>

              <div className="barber-form-actions">
                <button type="button" className="ba-sec" onClick={closeDrawer}>
                  Bekor qilish
                </button>
                <button type="submit" className="ba-pri" style={{ background: gradientByStatus[form.status] }} disabled={isSaving}>
                  {isSaving ? "Saqlanmoqda..." : isEditing ? "Saqlash" : "Qo'shish"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
