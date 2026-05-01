import { useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiCalendar, FiClock, FiMapPin, FiScissors, FiSettings, FiUser } from "react-icons/fi";
import {
  approveBarberAppointment,
  getBarberAppointments,
  getBarberDashboard,
  getBarberNotifications,
  getBarberProfile,
  markBarberNotificationRead,
  rejectBarberAppointment,
  sendBarberAppointmentSms,
  updateBarberProfile,
  type BarberAppointmentApi,
  type BarberDashboardApi,
  type BarberNotificationApi,
} from "../admin-panel/api";
import { fileToOptimizedAvatarDataUrl } from "../../lib/avatar";
import { LocationPickerMap } from "../../components/shared/LocationPickerMap";
import { emitProfileSync } from "../../lib/profileSync";
import { subscribeRealtimeChannel } from "../../lib/realtime";
import { formatDateTimeInTashkent, formatNowInTashkent, getTashkentTodayISO } from "../../lib/time";

interface BarberPanelProps {
  barberId: number;
  barberName: string;
  barberEmail?: string;
  barberAvatar?: string | null;
  onProfileUpdated?: (payload: { name: string; email: string; avatar?: string | null }) => void;
  onLogout: () => void;
}

type BarberView = "dashboard" | "schedule" | "profile" | "notifications";
type ScheduleFilter = "all" | "pending" | "completed";

interface SmsOverlayItem {
  id: number;
  title: string;
  message: string;
}

interface BarberNotificationRealtimePayload {
  id?: number;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  created_at?: string;
}

interface PickedCoords {
  lat: number;
  lng: number;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
    {
      headers: {
        "Accept-Language": "uz,en",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Manzilni aniqlab bo'lmadi");
  }

  const payload = (await response.json()) as { display_name?: string };
  return payload.display_name?.trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function BarberPanel({ barberId, barberName, barberEmail = "", barberAvatar, onProfileUpdated, onLogout }: BarberPanelProps) {
  const [view, setView] = useState<BarberView>("dashboard");
  const [dashboard, setDashboard] = useState<BarberDashboardApi | null>(null);
  const [appointments, setAppointments] = useState<BarberAppointmentApi[]>([]);
  const [notifications, setNotifications] = useState<BarberNotificationApi[]>([]);
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [smsOverlays, setSmsOverlays] = useState<SmsOverlayItem[]>([]);

  const [profName, setProfName] = useState(barberName);
  const [profEmail, setProfEmail] = useState(barberEmail);
  const [profPassword, setProfPassword] = useState("");
  const [profSpecialty, setProfSpecialty] = useState("");
  const [profDirections, setProfDirections] = useState("");
  const [profServicePrice, setProfServicePrice] = useState("");
  const [profDiscountPercent, setProfDiscountPercent] = useState("");
  const [profLocationAddress, setProfLocationAddress] = useState("");
  const [profLocationLat, setProfLocationLat] = useState("");
  const [profLocationLng, setProfLocationLng] = useState("");
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
    window.setTimeout(() => setProfileToast(null), 3000);
  };

  const getInitials = (nameValue: string) => {
    const chunks = nameValue.split(" ").filter(Boolean).slice(0, 2);
    if (chunks.length === 0) {
      return "B";
    }
    return chunks.map((chunk) => chunk[0]?.toUpperCase() ?? "").join("");
  };

  const todayDate = useMemo(() => getTashkentTodayISO(), []);
  const humanDate = useMemo(
    () =>
      formatNowInTashkent("uz-UZ", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const mapPreviewUrl = useMemo(() => {
    if (profLocationLat.trim() && profLocationLng.trim()) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${profLocationLat},${profLocationLng}`)}&z=15&output=embed`;
    }
    if (profLocationAddress.trim()) {
      return `https://www.google.com/maps?q=${encodeURIComponent(profLocationAddress)}&z=15&output=embed`;
    }
    return "";
  }, [profLocationAddress, profLocationLat, profLocationLng]);

  const pickedCoords = useMemo<PickedCoords | null>(() => {
    const lat = Number.parseFloat(profLocationLat);
    const lng = Number.parseFloat(profLocationLng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }

    return null;
  }, [profLocationLat, profLocationLng]);

  const loadDashboard = async () => {
    const data = await getBarberDashboard(barberId);
    setDashboard(data);
  };

  const loadAppointments = async (statusValue: ScheduleFilter) => {
    const rows = await getBarberAppointments(barberId, { status: statusValue, date: todayDate });
    setAppointments(rows);
  };

  const loadProfile = async () => {
    const profile = await getBarberProfile(barberId);
    setProfName(profile.name || barberName);
    setProfEmail(profile.email || barberEmail);
    setAvatarPreview(profile.photo_url ?? barberAvatar ?? null);
    setProfSpecialty(profile.specialty ?? "");
    setProfDirections(profile.work_directions ?? "");
    setProfServicePrice(profile.service_price != null ? String(Math.round(profile.service_price)) : "");
    setProfDiscountPercent(profile.discount_percent != null ? String(Math.round(profile.discount_percent)) : "0");
    setProfLocationAddress(profile.location_address ?? "");
    setProfLocationLat(profile.location_latitude != null ? String(profile.location_latitude) : "");
    setProfLocationLng(profile.location_longitude != null ? String(profile.location_longitude) : "");
  };

  const loadNotifications = async () => {
    const rows = await getBarberNotifications(barberId);
    setNotifications(rows);
  };

  const bootstrap = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      await Promise.all([loadDashboard(), loadAppointments(filter), loadProfile(), loadNotifications()]);
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

  const pushOverlay = (title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setSmsOverlays((prev) => [...prev, { id, title, message }].slice(-3));
    window.setTimeout(() => {
      setSmsOverlays((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  };

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel(`barber:${barberId}`, (payload) => {
      if (payload.event === "barber.notification") {
        const data = payload.data as BarberNotificationRealtimePayload;
        if (data.id && data.title && data.message) {
          const nextRow: BarberNotificationApi = {
            id: data.id,
            barber_id: barberId,
            title: data.title,
            message: data.message,
            type: data.type || "barber_system",
            read: !!data.read,
            created_at: data.created_at,
          };
          setNotifications((prev) => [nextRow, ...prev.filter((item) => item.id !== nextRow.id)]);
          pushOverlay(nextRow.title, nextRow.message);
        }
      }

      void Promise.all([loadDashboard(), loadAppointments(filter)]).catch(() => undefined);
    });

    return unsubscribe;
  }, [barberId, filter, todayDate]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("bookings", (payload) => {
      if (!["booking.created", "booking.completed", "booking.cancelled"].includes(payload.event)) {
        return;
      }

      const eventData = payload.data as { barber_id?: number; appointment_date?: string };
      if (eventData.barber_id && eventData.barber_id !== barberId) {
        return;
      }

      if (eventData.appointment_date && eventData.appointment_date !== todayDate) {
        return;
      }

      void Promise.all([loadDashboard(), loadAppointments(filter), loadNotifications()]).catch(() => undefined);
    });

    return unsubscribe;
  }, [barberId, filter, todayDate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void (async () => {
      try {
        const result = await fileToOptimizedAvatarDataUrl(file);
        setAvatarPreview(result);
      } catch (error) {
        showProfileToast("error", error instanceof Error ? error.message : "Rasm tayyorlanmadi.");
      }
    })();
  };

  const applyPickedLocation = async (coords: PickedCoords) => {
    setProfLocationLat(String(coords.lat));
    setProfLocationLng(String(coords.lng));

    try {
      const address = await reverseGeocode(coords.lat, coords.lng);
      setProfLocationAddress(address);
    } catch {
      setProfLocationAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showProfileToast("error", "Brauzer joylashuvni qo'llab-quvvatlamaydi.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void applyPickedLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        showProfileToast("error", "Joylashuvni olib bo'lmadi.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const clearPickedLocation = () => {
    setProfLocationAddress("");
    setProfLocationLat("");
    setProfLocationLng("");
  };

  const handleProfileSave = async () => {
    const trimName = profName.trim();
    const trimEmail = profEmail.trim().toLowerCase();
    if (!trimName || !trimEmail) {
      showProfileToast("error", "Ism va emailni to'ldiring.");
      return;
    }

    const parsedPrice = Number.parseFloat(profServicePrice || "0");
    const parsedDiscount = Number.parseFloat(profDiscountPercent || "0");
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      showProfileToast("error", "Xizmat narxi noto'g'ri.");
      return;
    }
    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      showProfileToast("error", "Skidka foizi 0 dan 100 gacha bo'lishi kerak.");
      return;
    }

    const parsedLat = profLocationLat.trim() ? Number.parseFloat(profLocationLat) : undefined;
    const parsedLng = profLocationLng.trim() ? Number.parseFloat(profLocationLng) : undefined;
    if (profLocationLat.trim() && Number.isNaN(parsedLat as number)) {
      showProfileToast("error", "Latitude noto'g'ri.");
      return;
    }
    if (profLocationLng.trim() && Number.isNaN(parsedLng as number)) {
      showProfileToast("error", "Longitude noto'g'ri.");
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateBarberProfile(barberId, {
        name: trimName,
        email: trimEmail,
        password: profPassword.trim() || undefined,
        photo_url: avatarPreview || undefined,
        specialty: profSpecialty.trim() || undefined,
        work_directions: profDirections.trim() || undefined,
        service_price: parsedPrice,
        discount_percent: parsedDiscount,
        location_address: profLocationAddress.trim() || undefined,
        location_latitude: parsedLat,
        location_longitude: parsedLng,
      });

      onProfileUpdated?.({ name: updated.name, email: updated.email, avatar: updated.photo_url });
      emitProfileSync({ entityType: "barber", entityId: barberId, name: updated.name, email: updated.email, avatar: updated.photo_url });
      setProfPassword("");
      showProfileToast("success", "Profil muvaffaqiyatli saqlandi.");
      await Promise.all([loadDashboard(), loadNotifications()]);
    } catch (error) {
      showProfileToast("error", error instanceof Error ? error.message : "Saqlashda xatolik.");
    } finally {
      setIsSaving(false);
    }
  };

  const approveAppointment = async (appointmentId: number) => {
    try {
      setIsUpdating(appointmentId);
      setErrorMessage(null);
      await approveBarberAppointment(barberId, appointmentId);
      await Promise.all([loadDashboard(), loadAppointments(filter)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Status yangilanmadi.");
    } finally {
      setIsUpdating(null);
    }
  };

  const rejectAppointment = async (appointmentId: number) => {
    try {
      setIsUpdating(appointmentId);
      setErrorMessage(null);
      await rejectBarberAppointment(barberId, appointmentId);
      await Promise.all([loadDashboard(), loadAppointments(filter)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bron rad etilmadi.");
    } finally {
      setIsUpdating(null);
    }
  };

  const sendClientSms = async (appointmentId: number) => {
    try {
      setIsUpdating(appointmentId);
      setErrorMessage(null);
      const result = await sendBarberAppointmentSms(barberId, appointmentId);
      pushOverlay("SMS holati", result.message);
      await Promise.all([loadDashboard(), loadAppointments(filter)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "SMS yuborilmadi.");
    } finally {
      setIsUpdating(null);
    }
  };

  const markNotificationRead = async (notificationId: number) => {
    try {
      const updated = await markBarberNotificationRead(barberId, notificationId);
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? updated : item)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Habarnoma yangilanmadi.");
    }
  };

  if (loading) {
    return <div className="bp-loading">Yuklanmoqda...</div>;
  }

  const currentAvatar = avatarPreview || barberAvatar;
  const initials = getInitials(profName || barberName);
  const pageTitle = view === "dashboard"
    ? "Sartarosh boshqaruvi"
    : view === "schedule"
      ? "Bugungi jadval"
      : view === "profile"
        ? "Profil va joylashuv"
        : "Habarnomalar markazi";
  const pageSubtitle = view === "dashboard"
    ? "Bugungi oqim, keyingi mijoz va tasdiqlashlarni bir joydan boshqaring."
    : view === "schedule"
      ? "Mijozlar oqimi, vaqtlar va har bir bron holatini real vaqtda kuzating."
      : view === "profile"
        ? "Xizmat narxi, mutaxassislik va xaritadagi lokatsiyani shu yerda yangilang."
        : "Tizimdagi yangi bronlar va barberga tegishli ogohlantirishlar shu yerga tushadi.";

  return (
    <div className="bp-shell">
      {profileToast ? <div className={`ba-toast ba-toast-${profileToast.type}`}>{profileToast.message}</div> : null}
      {errorMessage ? <div className="bp-error">{errorMessage}</div> : null}

      <div className="bp-sms-overlay-wrap">
        {smsOverlays.map((item) => (
          <div key={item.id} className="bp-sms-overlay">
            <div className="bp-sms-head">Habarnoma</div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="bp-sidebar">
        <div className="bp-sidebar-top">
          <div className="bp-sidebar-brand">
            <div className="bp-sidebar-logo"><FiScissors /></div>
            <div>
              <strong className="bp-sidebar-name">SharpCuts</strong>
              <span className="bp-sidebar-tag">Barber panel</span>
            </div>
          </div>

          <nav className="bp-sidebar-nav">
            <button className={`bp-sidebar-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
              <FiScissors />
              <span>Boshqaruv</span>
            </button>
            <button className={`bp-sidebar-item ${view === "schedule" ? "active" : ""}`} onClick={() => setView("schedule")}>
              <FiCalendar />
              <span>Jadval</span>
            </button>
            <button className={`bp-sidebar-item ${view === "profile" ? "active" : ""}`} onClick={() => setView("profile")}>
              <FiSettings />
              <span>Profil</span>
            </button>
            <button className={`bp-sidebar-item ${view === "notifications" ? "active" : ""}`} onClick={() => setView("notifications")}>
              <FiBell />
              <span>Habarnomalar</span>
            </button>
          </nav>
        </div>

        <div className="bp-sidebar-footer">
          <div className="bp-sidebar-profile">
            <div className="bp-sidebar-avatar">
              {currentAvatar ? <img src={currentAvatar} alt={barberName} /> : initials}
            </div>
            <div className="bp-sidebar-info">
              <strong>{dashboard?.barber_name || barberName}</strong>
              <span>{profSpecialty || "Professional"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="bp-main-wrap">
        {/* Topbar */}
        <header className="bp-topbar">
          <div className="bp-topbar-left">
            <span className="bp-topbar-title">Bugungi holat</span>
            <h1 className="bp-topbar-heading">{pageTitle}</h1>
          </div>
          <div className="bp-topbar-right">
            <span className="bp-topbar-chip">{humanDate}</span>
            <span className="bp-topbar-chip">{dashboard?.today_total ?? 0} bron</span>
            <button className="bp-topbar-logout" onClick={onLogout}>Chiqish</button>
          </div>
        </header>

        {/* Content */}
        <main className="bp-content">

          {view === "profile" ? (
            <section className="bp-content-section">
              <div className="bp-wrap bp-profile-page">
                <h3>Mening profilim</h3>
              <p className="bp-profile-sub">Profil, xizmat narxi va salon joylashuvini bir joydan boshqaring.</p>

              <div className="prof-avatar-section">
                <div className="prof-avatar-wrap">
                  {currentAvatar ? <img src={currentAvatar} alt="Avatar" className="prof-avatar-img" /> : <div className="prof-avatar-placeholder">{initials}</div>}
                  <button type="button" className="prof-avatar-edit" onClick={() => fileInputRef.current?.click()} title="Rasm tanlash">✎</button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                {currentAvatar ? (
                  <button type="button" className="prof-avatar-remove" onClick={() => { setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    Rasmni o'chirish
                  </button>
                ) : null}
              </div>

              <div className="barber-form">
                <label className="barber-field"><span>Ism</span>
                  <input value={profName} onChange={(event) => setProfName(event.target.value)} placeholder="Ismingiz" />
                </label>
                <label className="barber-field"><span>Email</span>
                  <input type="email" value={profEmail} onChange={(event) => setProfEmail(event.target.value)} placeholder="Email" />
                </label>
                <label className="barber-field"><span>Yo'nalish (masalan: Fade, Soqol, Styling)</span>
                  <input value={profSpecialty} onChange={(event) => setProfSpecialty(event.target.value)} placeholder="Asosiy yo'nalish" />
                </label>
                <label className="barber-field"><span>Nima bo'yicha ishlaysiz?</span>
                  <input value={profDirections} onChange={(event) => setProfDirections(event.target.value)} placeholder="Mutaxassislik yo'nalishlari" />
                </label>
                <label className="barber-field"><span>Xizmat narxi (so'm)</span>
                  <input value={profServicePrice} onChange={(event) => setProfServicePrice(event.target.value)} placeholder="Masalan: 50000" />
                </label>
                <label className="barber-field"><span>Skidka (%)</span>
                  <input value={profDiscountPercent} onChange={(event) => setProfDiscountPercent(event.target.value)} placeholder="Masalan: 15" />
                </label>
                <div className="bp-location-picker-card">
                  <div className="bp-location-picker-head">
                    <div>
                      <span className="bp-section-kicker">Map picker</span>
                      <h4>Joylashuvni xaritada belgilang</h4>
                      <small>Nuqtani bosganingizda manzil avtomatik olinadi.</small>
                    </div>
                    <div className="bp-location-actions">
                      <button type="button" className="ba-sec" onClick={handleUseCurrentLocation}>Mening joyim</button>
                      <button type="button" className="ba-sec" onClick={clearPickedLocation}>Tozalash</button>
                    </div>
                  </div>

                  <div className="bp-location-summary-card">
                    <strong>{profLocationAddress || "Hali joy tanlanmagan"}</strong>
                    <small>
                      {pickedCoords
                        ? `${pickedCoords.lat.toFixed(6)}, ${pickedCoords.lng.toFixed(6)}`
                        : "Xaritadagi kerakli nuqtani bosing yoki `Mening joyim` tugmasidan foydalaning."}
                    </small>
                  </div>

                  <LocationPickerMap value={pickedCoords} onChange={(coords) => void applyPickedLocation(coords)} className="bp-location-picker-map" />

                  {mapPreviewUrl ? (
                    <div className="bp-map-preview-card">
                      <div className="bp-list-head">
                        <h4>Google preview</h4>
                        <small>Foydalanuvchi ko'radigan yo'nalish manzili</small>
                      </div>
                      <iframe
                        title="Barber location preview"
                        src={mapPreviewUrl}
                        className="bp-map-preview"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ) : null}
                </div>
                <label className="barber-field"><span>Yangi parol (ixtiyoriy)</span>
                  <input type="password" value={profPassword} onChange={(event) => setProfPassword(event.target.value)} placeholder="Yangi parol" autoComplete="new-password" />
                </label>

                <div className="barber-form-actions">
                  <button type="button" className="ba-sec" onClick={() => setView("dashboard")} disabled={isSaving}>Ortga</button>
                  <button type="button" className="ba-pri" onClick={() => void handleProfileSave()} disabled={isSaving}>{isSaving ? "Saqlanmoqda..." : "Saqlash"}</button>
                </div>
              </div>
              </div>
            </section>
          ) : null}

          {view === "notifications" ? (
            <section className="bp-content-section">
              <div className="bp-wrap bp-notification-page">
                <div className="bp-list-head">
                  <h4>Habarnomalar</h4>
                  <small>{notifications.length} ta</small>
                </div>

              <div className="bp-list">
                {notifications.map((item) => (
                  <article key={item.id} className="bp-item bp-item-notification">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>
                        {item.created_at
                          ? formatDateTimeInTashkent(item.created_at, "uz-UZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : ""}
                      </small>
                    </div>
                    {item.read ? (
                      <em className="bp-chip done">Ko'rilgan</em>
                    ) : (
                      <button className="bp-chip action" onClick={() => void markNotificationRead(item.id)}>O'qildi</button>
                    )}
                  </article>
                ))}
                {notifications.length === 0 ? <div className="bp-empty">Hozircha habarnoma yo'q</div> : null}
              </div>
              </div>
            </section>
          ) : null}

          {view === "dashboard" ? (
            <section className="bp-content-section">
              <div className="bp-wrap">
                <div className="bp-dashboard-grid">
                <div className="bp-main-col">
                  <div className="bp-stats">
                    <article className="bp-stat bp-stat-dark bp-stat-primary">
                      <strong>{dashboard?.today_total ?? 0}</strong>
                      <span>Bugun</span>
                    </article>
                    <article className="bp-stat bp-stat-soft bp-stat-success">
                      <strong>{dashboard?.today_done ?? 0}</strong>
                      <span>Tasdiqlangan</span>
                    </article>
                    <article className="bp-stat bp-stat-warning">
                      <strong>{dashboard?.today_pending ?? 0}</strong>
                      <span>Kutilmoqda</span>
                    </article>
                  </div>

                  <div className="bp-progress-card">
                    <div className="bp-progress-top">
                      <span>Bugungi holat</span>
                      <span>{dashboard?.today_done ?? 0}/{dashboard?.today_total ?? 0} yakunlangan</span>
                    </div>
                    <div className="bp-progress-track">
                      <div className="bp-progress-fill" style={{ width: `${Math.round((dashboard?.progress_ratio ?? 0) * 100)}%` }} />
                    </div>
                  </div>

                  <button className="bp-link-card" onClick={() => setView("schedule")}>
                    <div>
                      <strong>Kunlik jadval</strong>
                      <span>Barcha bronlarni ko'rish</span>
                    </div>
                    <span>›</span>
                  </button>
                </div>

                <div className="bp-side-col">
                  <div className="bp-next-card">
                    <div className="bp-next-top">
                      <span>KEYINGI MIJOZ</span>
                      <b>{dashboard?.next_appointment?.appointment_time ?? "--"}</b>
                    </div>
                    <h3>{dashboard?.next_appointment?.client_name ?? "Hamma bronlar yakunlangan"}</h3>
                    <p>{dashboard?.next_appointment?.client_phone ?? "Bo'sh vaqt oynasi"}</p>
                    <div className="bp-next-meta">
                      <span><FiUser /> {dashboard?.barber_name || barberName}</span>
                      <span><FiClock /> {dashboard?.next_appointment?.appointment_time ?? "Kun yopildi"}</span>
                    </div>
                    <button
                      className="bp-complete-btn"
                      disabled={!dashboard?.next_appointment || isUpdating === dashboard.next_appointment.id}
                      onClick={() => {
                        if (dashboard?.next_appointment) {
                          void approveAppointment(dashboard.next_appointment.id);
                        }
                      }}
                    >
                      {dashboard?.next_appointment ? "Tasdiqlash" : "Yakunlangan"}
                    </button>
                  </div>
                </div>
              </div>

              <section className="bp-today-card">
                <div className="bp-list-head">
                  <h4>Bugungi bronlar</h4>
                  <small>{dashboard?.today_total ?? 0} ta</small>
                </div>

                <div className="bp-list">
                  {(dashboard?.today_appointments ?? []).map((item) => (
                    <article key={item.id} className="bp-item">
                      <div>
                        <strong>{item.client_name}</strong>
                        <span>{item.appointment_time} · {item.client_phone}</span>
                        <small>
                          Bron vaqti: {item.created_at
                            ? formatDateTimeInTashkent(item.created_at, "uz-UZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                              })
                            : "-"} (Toshkent)
                        </small>
                      </div>
                      {item.status === "completed" ? (
                        <em className="bp-chip done">Tasdiqlangan</em>
                      ) : item.status === "cancelled" ? (
                        <em className="bp-chip pending">Rad etilgan</em>
                      ) : (
                        <div className="bp-inline-actions">
                          <button className="bp-chip action" disabled={isUpdating === item.id} onClick={() => void sendClientSms(item.id)}>SMS</button>
                          <button className="bp-chip action" disabled={isUpdating === item.id} onClick={() => void approveAppointment(item.id)}>Tasdiqlash</button>
                          <button className="bp-chip action danger" disabled={isUpdating === item.id} onClick={() => void rejectAppointment(item.id)}>Rad etish</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              </div>
            </section>
          ) : null}

          {view === "schedule" ? (
            <section className="bp-content-section">
              <div className="bp-wrap">
                <div className="bp-day-block">
                  <strong>Bugun</strong>
                  <span>{humanDate}</span>
                <div className="bp-day-meta">
                  <small>{dashboard?.today_pending ?? 0} kutilmoqda</small>
                  <small>{dashboard?.today_done ?? 0} tasdiqlangan</small>
                  <small>{dashboard?.today_total ?? 0} jami</small>
                </div>
                </div>

                <div className="bp-filter-row">
                  <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Barchasi</button>
                  <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Kutilmoqda</button>
                  <button className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>Tasdiqlangan</button>
                </div>

                <div className="bp-schedule-list">
                  {appointments.map((item) => (
                    <article key={item.id} className="bp-schedule-item">
                      <div className="bp-schedule-top">
                        <strong>{item.client_name}</strong>
                      <span className={`bp-chip ${item.status === "completed" ? "done" : "pending"}`}>
                        {item.status === "completed" ? "Tasdiqlangan" : item.status === "cancelled" ? "Rad etilgan" : "Kutilmoqda"}
                      </span>
                    </div>
                    <div className="bp-schedule-sub">#{item.id.toString().padStart(4, "0")}</div>
                    <div className="bp-schedule-line">Vaqt: {item.appointment_time}</div>
                    <div className="bp-schedule-line">Telefon: {item.client_phone}</div>
                    <div className="bp-schedule-line">
                      Bron vaqti: {item.created_at
                        ? formatDateTimeInTashkent(item.created_at, "uz-UZ", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-"} (Toshkent)
                    </div>
                    {item.status === "pending" ? (
                      <div className="bp-inline-actions">
                        <button className="bp-chip action" disabled={isUpdating === item.id} onClick={() => void sendClientSms(item.id)}>SMS yuborish</button>
                        <button className="bp-chip action" disabled={isUpdating === item.id} onClick={() => void approveAppointment(item.id)}>Tasdiqlash</button>
                        <button className="bp-chip action danger" disabled={isUpdating === item.id} onClick={() => void rejectAppointment(item.id)}>Rad etish</button>
                      </div>
                    ) : (
                      <div className="bp-done-note">{item.status === "completed" ? "Bron tasdiqlangan" : "Bron rad etilgan"}</div>
                    )}
                  </article>
                ))}
                {appointments.length === 0 ? <div className="bp-empty">Bugunga bron yo'q</div> : null}
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

