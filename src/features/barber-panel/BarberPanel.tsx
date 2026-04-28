import { useEffect, useMemo, useRef, useState } from "react";
import {
  completeBarberAppointment,
  getBarberAppointments,
  getBarberDashboard,
  updateBarberProfile,
  type BarberAppointmentApi,
  type BarberDashboardApi,
} from "../admin-panel/api";
import { fileToOptimizedAvatarDataUrl } from "../../lib/avatar";
import { emitProfileSync } from "../../lib/profileSync";
import { subscribeRealtimeChannel } from "../../lib/realtime";
import { formatNowInTashkent, getTashkentTodayISO } from "../../lib/time";

interface BarberPanelProps {
  barberId: number;
  barberName: string;
  barberEmail?: string;
  barberAvatar?: string | null;
  onProfileUpdated?: (payload: { name: string; email: string; avatar?: string | null }) => void;
  onLogout: () => void;
}

type BarberView = "dashboard" | "schedule";
type ScheduleFilter = "all" | "pending" | "completed";

export function BarberPanel({ barberId, barberName, barberEmail = "", barberAvatar, onProfileUpdated, onLogout }: BarberPanelProps) {
  const [view, setView] = useState<BarberView>("dashboard");
  const [dashboard, setDashboard] = useState<BarberDashboardApi | null>(null);
  const [appointments, setAppointments] = useState<BarberAppointmentApi[]>([]);
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  // --- Profile drawer state ---
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profName, setProfName] = useState(barberName);
  const [profEmail, setProfEmail] = useState(barberEmail);
  const [profPassword, setProfPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(barberAvatar ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileToast, setProfileToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfName(barberName);
    setProfEmail(barberEmail);
    setAvatarPreview(barberAvatar ?? null);
  }, [barberName, barberEmail, barberAvatar]);

  const showProfileToast = (type: "success" | "error", message: string) => {
    setProfileToast({ type, message });
    window.setTimeout(() => setProfileToast(null), 3200);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const result = await fileToOptimizedAvatarDataUrl(file);
        setAvatarPreview(result);
      } catch (error) {
        showProfileToast("error", error instanceof Error ? error.message : "Rasm tayyorlanmadi.");
      }
    })();
  };

  const handleProfileSave = async () => {
    const trimName = profName.trim();
    const trimEmail = profEmail.trim().toLowerCase();
    if (!trimName || !trimEmail) { showProfileToast("error", "Ism va emailni to'ldiring."); return; }
    try {
      setIsSaving(true);
      const updated = await updateBarberProfile(barberId, {
        name: trimName,
        email: trimEmail,
        password: profPassword.trim() || undefined,
        photo_url: avatarPreview || undefined,
      });
      onProfileUpdated?.({ name: updated.name, email: updated.email, avatar: updated.photo_url });
      emitProfileSync({ entityType: "barber", entityId: barberId, name: updated.name, email: updated.email, avatar: updated.photo_url });
      setProfPassword("");
      setIsProfileOpen(false);
      showProfileToast("success", "Profil yangilandi.");
    } catch (err) {
      showProfileToast("error", err instanceof Error ? err.message : "Saqlashda xatolik.");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "B";

  const todayDate = useMemo(() => {
    return getTashkentTodayISO();
  }, []);

  const humanDate = useMemo(() => {
    return formatNowInTashkent("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const loadDashboard = async () => {
    const data = await getBarberDashboard(barberId);
    setDashboard(data);
  };

  const loadAppointments = async (status: ScheduleFilter) => {
    const rows = await getBarberAppointments(barberId, { status, date: todayDate });
    setAppointments(rows);
  };

  const bootstrap = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      await Promise.all([loadDashboard(), loadAppointments(filter)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sahifa yuklanmadi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void bootstrap();
  }, [barberId]);

  useEffect(() => {
    void loadAppointments(filter);
  }, [filter]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel(`barber:${barberId}`, () => {
      void Promise.all([loadDashboard(), loadAppointments(filter)]).catch(() => undefined);
    });
    return unsubscribe;
  }, [barberId, filter, todayDate]);

  const markAsCompleted = async (appointmentId: number) => {
    try {
      setIsUpdating(appointmentId);
      setErrorMessage(null);
      await completeBarberAppointment(barberId, appointmentId);
      await Promise.all([loadDashboard(), loadAppointments(filter)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Status yangilanmadi.");
    } finally {
      setIsUpdating(null);
    }
  };

  if (loading) {
    return <div className="bp-loading">Yuklanmoqda...</div>;
  }

  const currentAvatar = avatarPreview || barberAvatar;
  const initials = getInitials(barberName);

  return (
    <div className="bp-shell">
      {profileToast ? <div className={`ba-toast ba-toast-${profileToast.type}`}>{profileToast.message}</div> : null}
      {errorMessage ? <div className="bp-error">{errorMessage}</div> : null}

      {/* Profile Drawer */}
      {isProfileOpen ? (
        <div className="admin-profile-overlay" onClick={() => { if (!isSaving) setIsProfileOpen(false); }}>
          <aside className="admin-profile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="barber-drawer-head">
              <h3>Mening profilim</h3>
              <button type="button" className="barber-drawer-close" onClick={() => { if (!isSaving) setIsProfileOpen(false); }}>×</button>
            </div>
            <div className="barber-form">
              <div className="prof-avatar-section">
                <div className="prof-avatar-wrap">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="prof-avatar-img" />
                  ) : (
                    <div className="prof-avatar-placeholder">{initials}</div>
                  )}
                  <button type="button" className="prof-avatar-edit" onClick={() => fileInputRef.current?.click()} title="Rasm tanlash">✎</button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                {currentAvatar && (
                  <button type="button" className="prof-avatar-remove" onClick={() => { setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    Rasmni o'chirish
                  </button>
                )}
              </div>

              <label className="barber-field"><span>Ism</span>
                <input value={profName} onChange={(e) => setProfName(e.target.value)} placeholder="Ismingiz" />
              </label>
              <label className="barber-field"><span>Email</span>
                <input type="email" value={profEmail} onChange={(e) => setProfEmail(e.target.value)} placeholder="Email" />
              </label>
              <label className="barber-field"><span>Yangi parol (ixtiyoriy)</span>
                <input type="password" value={profPassword} onChange={(e) => setProfPassword(e.target.value)} placeholder="Yangi parol" autoComplete="new-password" />
              </label>
              <div className="barber-form-actions">
                <button type="button" className="ba-sec" onClick={() => setIsProfileOpen(false)} disabled={isSaving}>Bekor qilish</button>
                <button type="button" className="ba-pri" onClick={() => void handleProfileSave()} disabled={isSaving}>{isSaving ? "Saqlanmoqda..." : "Saqlash"}</button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {view === "dashboard" ? (
        <section className="bp-wrap">
          <header className="bp-head">
            <div>
              <div className="bp-greet">Good day,</div>
              <h2>{dashboard?.barber_name || barberName}</h2>
              <div className="bp-date">{humanDate}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="bp-av-btn" onClick={() => setIsProfileOpen(true)} aria-label="Profil">
                {currentAvatar ? <img src={currentAvatar} alt={barberName} className="bp-av-img" /> : <span className="bp-av-placeholder">{initials}</span>}
              </button>
              <button className="bp-logout" onClick={onLogout}>Chiqish</button>
            </div>
          </header>

          <div className="bp-stats">
            <article className="bp-stat bp-stat-dark">
              <strong>{dashboard?.today_total ?? 0}</strong>
              <span>Today</span>
            </article>
            <article className="bp-stat bp-stat-soft">
              <strong>{dashboard?.today_done ?? 0}</strong>
              <span>Done</span>
            </article>
            <article className="bp-stat">
              <strong>{dashboard?.today_pending ?? 0}</strong>
              <span>Pending</span>
            </article>
          </div>

          <div className="bp-progress-card">
            <div className="bp-progress-top">
              <span>Today's Progress</span>
              <span>
                {dashboard?.today_done ?? 0}/{dashboard?.today_total ?? 0} completed
              </span>
            </div>
            <div className="bp-progress-track">
              <div className="bp-progress-fill" style={{ width: `${Math.round((dashboard?.progress_ratio ?? 0) * 100)}%` }} />
            </div>
          </div>

          <div className="bp-next-card">
            <div className="bp-next-top">
              <span>NEXT CLIENT</span>
              <b>{dashboard?.next_appointment?.appointment_time ?? "--"}</b>
            </div>
            <h3>{dashboard?.next_appointment?.client_name ?? "Hamma appointment tugagan"}</h3>
            <p>{dashboard?.next_appointment?.client_phone ?? ""}</p>
            <button
              className="bp-complete-btn"
              disabled={!dashboard?.next_appointment || isUpdating === dashboard.next_appointment.id}
              onClick={() => {
                if (dashboard?.next_appointment) {
                  void markAsCompleted(dashboard.next_appointment.id);
                }
              }}
            >
              {dashboard?.next_appointment ? "Mark as Complete" : "Completed"}
            </button>
          </div>

          <button className="bp-link-card" onClick={() => setView("schedule")}>
            <div>
              <strong>Daily Schedule</strong>
              <span>View all appointments</span>
            </div>
            <span>›</span>
          </button>

          <div className="bp-list-head">
            <h4>Today's Appointments</h4>
            <small>{dashboard?.today_total ?? 0} total</small>
          </div>

          <div className="bp-list">
            {(dashboard?.today_appointments ?? []).map((item) => (
              <article key={item.id} className="bp-item">
                <div>
                  <strong>{item.client_name}</strong>
                  <span>{item.appointment_time}</span>
                </div>
                {item.status === "completed" ? (
                  <em className="bp-chip done">Done</em>
                ) : (
                  <button
                    className="bp-chip action"
                    disabled={isUpdating === item.id}
                    onClick={() => void markAsCompleted(item.id)}
                  >
                    Done
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="bp-wrap">
          <header className="bp-head schedule">
            <button className="bp-back" onClick={() => setView("dashboard")}>←</button>
            <div>
              <h2>Daily Schedule</h2>
              <div className="bp-date">{dashboard?.barber_name || barberName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="bp-av-btn" onClick={() => setIsProfileOpen(true)} aria-label="Profil">
                {currentAvatar ? <img src={currentAvatar} alt={barberName} className="bp-av-img" /> : <span className="bp-av-placeholder">{initials}</span>}
              </button>
              <button className="bp-logout" onClick={onLogout}>Chiqish</button>
            </div>
          </header>

          <div className="bp-day-block">
            <strong>Today</strong>
            <span>{humanDate}</span>
            <div className="bp-day-meta">
              <small>{dashboard?.today_pending ?? 0} pending</small>
              <small>{dashboard?.today_done ?? 0} completed</small>
              <small>{dashboard?.today_total ?? 0} total</small>
            </div>
          </div>

          <div className="bp-filter-row">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
            <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pending</button>
            <button className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>Completed</button>
          </div>

          <div className="bp-schedule-list">
            {appointments.map((item) => (
              <article key={item.id} className="bp-schedule-item">
                <div className="bp-schedule-top">
                  <strong>{item.client_name}</strong>
                  <span className={`bp-chip ${item.status === "completed" ? "done" : "pending"}`}>
                    {item.status === "completed" ? "Done" : "Pending"}
                  </span>
                </div>
                <div className="bp-schedule-sub">#{item.id.toString().padStart(4, "0")}</div>
                <div className="bp-schedule-line">🕒 {item.appointment_time}</div>
                <div className="bp-schedule-line">📞 {item.client_phone}</div>
                {item.status === "pending" ? (
                  <button
                    className="bp-complete-btn"
                    disabled={isUpdating === item.id}
                    onClick={() => void markAsCompleted(item.id)}
                  >
                    {isUpdating === item.id ? "Yangilanmoqda..." : "Mark as Completed"}
                  </button>
                ) : (
                  <div className="bp-done-note">Appointment completed</div>
                )}
              </article>
            ))}
            {appointments.length === 0 ? <div className="bp-empty">Bugunga appointment yo'q</div> : null}
          </div>
        </section>
      )}
    </div>
  );
}
