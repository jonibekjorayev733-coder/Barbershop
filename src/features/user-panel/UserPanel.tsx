import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowRight, FiCalendar, FiCheck, FiClock, FiMapPin, FiScissors, FiShare2, FiShield, FiStar, FiZap } from "react-icons/fi";
import {
  createUserBooking,
  getBarberAvailability,
  getPublicUserLocationByIp,
  getUserBookingBarbers,
  submitBarberRating,
  updateStudentProfile,
  type BarberAvailabilityApi,
  type UserBookingBarberApi,
  type UserBookingConfirmationApi,
} from "../admin-panel/api";
import { fileToOptimizedAvatarDataUrl } from "../../lib/avatar";
import { emitProfileSync, subscribeProfileSync } from "../../lib/profileSync";
import { subscribeRealtimeChannel } from "../../lib/realtime";
import { formatDateTimeInTashkent, formatIsoDateInTashkent, getTashkentTodayISO } from "../../lib/time";

interface UserPanelProps {
  userId: number;
  userName: string;
  userEmail?: string;
  userAvatar?: string | null;
  preferredBarberId?: number | null;
  onProfileUpdated?: (payload: { name: string; email: string; avatar?: string | null }) => void;
  onLogout: () => void;
}

type UserBookingStep = "barbers" | "barber-detail" | "times" | "details" | "success";
type UserView = "booking" | "profile";


const BOOKING_STEPS: Array<{ id: UserBookingStep; label: string }> = [
  { id: "barbers", label: "Sartarosh" },
  { id: "times", label: "Vaqt" },
  { id: "details", label: "Ma'lumot" },
  { id: "success", label: "Tasdiq" },
];

const STEP_ORDER: Record<UserBookingStep, number> = {
  barbers: 1,
  "barber-detail": 1,
  times: 2,
  details: 3,
  success: 4,
};

function formatHumanDate(dateValue: string): string {
  return formatIsoDateInTashkent(dateValue, "uz-UZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return "SB";
  }
  return parts.map((item) => item[0]?.toUpperCase() ?? "").join("");
}

function formatPrice(value?: number | null): string {
  const amount = typeof value === "number" ? value : 0;
  return `${Math.round(amount).toLocaleString("uz-UZ")} so'm`;
}

function formatDiscount(discount?: number | null): string {
  const value = typeof discount === "number" ? Math.max(0, Math.min(100, discount)) : 0;
  return value > 0 ? `${Math.round(value)}% skidka` : "Skidka yo'q";
}

function formatDistance(distanceKm?: number | null): string {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return "Masofa aniqlanmagan";
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function UserPanel({ userId, userName, userEmail = "", userAvatar, preferredBarberId = null, onProfileUpdated, onLogout }: UserPanelProps) {
  const [view, setView] = useState<UserView>("booking");
  const [step, setStep] = useState<UserBookingStep>("barbers");
  const [barbers, setBarbers] = useState<UserBookingBarberApi[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<UserBookingBarberApi | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getTashkentTodayISO());
  const [availability, setAvailability] = useState<BarberAvailabilityApi | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientName, setClientName] = useState(userName || "");
  const [clientPhone, setClientPhone] = useState("");
  const [confirmation, setConfirmation] = useState<UserBookingConfirmationApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("Joylashuv aniqlanmoqda...");

  // Profile state
  const [profName, setProfName] = useState(userName);
  const [profEmail, setProfEmail] = useState(userEmail);
  const [profPassword, setProfPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(userAvatar ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileToast, setProfileToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBarbersByLocation = useCallback(async (coords: { lat: number; lng: number }) => {
    const rows = await getUserBookingBarbers({
      lat: coords.lat,
      lng: coords.lng,
      maxDistanceKm: 10,
      nearOnly: true,
    });
    setBarbers(rows);
  }, []);

  useEffect(() => {
    setProfName(userName);
    setProfEmail(userEmail);
    setAvatarPreview(userAvatar ?? null);
  }, [userName, userEmail, userAvatar]);

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
    if (!trimName) { showProfileToast("error", "Ismni to'ldiring."); return; }
    try {
      setIsSaving(true);
      const updated = await updateStudentProfile(userId, {
        name: trimName,
        email: trimEmail || undefined,
        password: profPassword.trim() || undefined,
        avatar: avatarPreview || undefined,
      });
      onProfileUpdated?.({ name: updated.name, email: updated.email ?? "", avatar: updated.avatar });
      emitProfileSync({ entityType: "user", entityId: userId, name: updated.name, email: updated.email ?? "", avatar: updated.avatar });
      setProfPassword("");
      showProfileToast("success", "Profil muvaffaqiyatli saqlandi.");
    } catch (err) {
      showProfileToast("error", err instanceof Error ? err.message : "Saqlashda xatolik.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatar = avatarPreview || userAvatar;
  const initials = getInitials(profName || userName);

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
                photo_url: payload.avatar !== undefined ? (payload.avatar ?? null) : barber.photo_url,
              }
            : barber,
        ),
      );

      setSelectedBarber((current) =>
        current && current.id === payload.entityId
          ? {
              ...current,
              name: payload.name ?? current.name,
              photo_url: payload.avatar !== undefined ? (payload.avatar ?? null) : current.photo_url,
            }
          : current,
      );

      setConfirmation((current) =>
        current && current.barber_id === payload.entityId
          ? {
              ...current,
              barber_name: payload.name ?? current.barber_name,
              barber_photo_url: payload.avatar !== undefined ? (payload.avatar ?? null) : current.barber_photo_url,
            }
          : current,
      );
    });

    return unsubscribe;
  }, []);

  const humanDate = useMemo(() => formatHumanDate(selectedDate), [selectedDate]);
  const currentStepNumber = STEP_ORDER[step];

  const today = getTashkentTodayISO();
  const isSelectedPast = selectedDate < today;
  const isSelectedToday = selectedDate === today;
  const dateLabelPrefix = isSelectedToday ? "Bugun" : isSelectedPast ? "O'tgan kun" : "";

  const filteredBarbers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = !query
      ? [...barbers]
      : barbers.filter(
          (barber) =>
            barber.name.toLowerCase().includes(query) ||
            barber.specialty.toLowerCase().includes(query),
        );
    return list.sort((a, b) => {
      const aDist = typeof a.distance_km === "number" ? a.distance_km : 99999;
      const bDist = typeof b.distance_km === "number" ? b.distance_km : 99999;
      if (aDist !== bDist) {
        return aDist - bDist;
      }
      return b.rating - a.rating;
    });
  }, [barbers, searchTerm]);

  const averageRating = useMemo(() => {
    if (barbers.length === 0) {
      return "0.0";
    }
    const total = barbers.reduce((sum, barber) => sum + barber.rating, 0);
    return (total / barbers.length).toFixed(1);
  }, [barbers]);

  const maxExperience = useMemo(() => {
    if (barbers.length === 0) {
      return 0;
    }
    return Math.max(...barbers.map((barber) => barber.years_experience));
  }, [barbers]);

  const refreshAvailability = async (barberId: number, dateValue: string) => {
    const data = await getBarberAvailability(barberId, dateValue);
    setAvailability(data);
  };

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("bookings", (payload) => {
      if (payload.event === "barber.profile.updated" || payload.event === "barber.rating.updated") {
        void (async () => {
          try {
            const rows = userCoords
              ? await getUserBookingBarbers({ lat: userCoords.lat, lng: userCoords.lng, maxDistanceKm: 10, nearOnly: true })
              : await getUserBookingBarbers();
            setBarbers(rows);
          } catch {
            return;
          }
        })();
      }

      if (!selectedBarber) {
        return;
      }

      const eventData = payload.data as { barber_id?: number; appointment_date?: string };
      if (eventData.barber_id && eventData.barber_id !== selectedBarber.id) {
        return;
      }
      if (eventData.appointment_date && eventData.appointment_date !== selectedDate) {
        return;
      }

      void refreshAvailability(selectedBarber.id, selectedDate).catch(() => undefined);
    });

    return unsubscribe;
  }, [selectedBarber, selectedDate, userCoords]);

  useEffect(() => {
    let watchId: number | null = null;
    void (async () => {
      try {
        setLoading(true);
        const ipLocation = await getPublicUserLocationByIp();
        const coordsFromIp = { lat: ipLocation.lat, lng: ipLocation.lng };
        setUserCoords(coordsFromIp);
        const cityRegion = [ipLocation.city, ipLocation.region].filter(Boolean).join(", ");
        setLocationLabel(cityRegion ? `Yaqin hudud: ${cityRegion}` : "Yaqin hudud bo'yicha");
        await loadBarbersByLocation(coordsFromIp);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const exactCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
              setUserCoords(exactCoords);
              setLocationLabel("Aniq joylashuv bo'yicha yaqin sartaroshlar");
              await loadBarbersByLocation(exactCoords);
            },
            () => undefined,
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
          );

          watchId = navigator.geolocation.watchPosition(
            async (position) => {
              const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
              setUserCoords((current) => {
                if (!current) {
                  void loadBarbersByLocation(nextCoords);
                  return nextCoords;
                }

                const movedDistance = Math.abs(nextCoords.lat - current.lat) + Math.abs(nextCoords.lng - current.lng);
                if (movedDistance < 0.0025) {
                  return current;
                }

                void loadBarbersByLocation(nextCoords);
                return nextCoords;
              });
            },
            () => undefined,
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
          );
        }
      } catch (error) {
        try {
          const rows = await getUserBookingBarbers({ nearOnly: false });
          setBarbers(rows);
          setLocationLabel("Joylashuv aniqlanmadi, umumiy ro'yxat ko'rsatildi");
        } catch {
          setErrorMessage(error instanceof Error ? error.message : "Sartaroshlar yuklanmadi.");
        }
      } finally {
        setLoading(false);
      }

      return undefined;
    })();

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [loadBarbersByLocation]);

  const pickBarber = async (barber: UserBookingBarberApi) => {
    setErrorMessage(null);
    setSelectedBarber(barber);
    setSelectedTime("");
    setStep("barber-detail");
  };

  const confirmBarber = async () => {
    if (!selectedBarber) return;
    try {
      setErrorMessage(null);
      setLoading(true);
      await refreshAvailability(selectedBarber.id, selectedDate);
      setStep("times");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bo'sh vaqtlar yuklanmadi.");
    } finally {
      setLoading(false);
    }
  };

  const shiftDate = async (days: number) => {
    if (!selectedBarber) {
      return;
    }
    const next = new Date(`${selectedDate}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    const nextDate = getTashkentTodayISO(next);
    // O'tgan kunga o'tishga ruxsat yo'q
    if (nextDate < getTashkentTodayISO()) {
      return;
    }

    try {
      setLoading(true);
      setSelectedDate(nextDate);
      setSelectedTime("");
      await refreshAvailability(selectedBarber.id, nextDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sana bo'yicha vaqt yuklanmadi.");
    } finally {
      setLoading(false);
    }
  };

  const continueToDetails = () => {
    if (!selectedTime) {
      setErrorMessage("Davom etish uchun vaqtni tanlang.");
      return;
    }
    setErrorMessage(null);
    setStep("details");
  };

  const submitBooking = async () => {
    if (!selectedBarber || !selectedTime) {
      setErrorMessage("Avval sartarosh va vaqt tanlang.");
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage("Ism va telefon raqamingizni kiriting.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await createUserBooking({
        barber_id: selectedBarber.id,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        service_name: selectedBarber.specialty,
        user_id: userId,
      });
      setConfirmation(result);
      setRatingScore(0);
      setRatingMessage(null);
      setStep("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bron yaratilmadi.");
    } finally {
      setLoading(false);
    }
  };

  const shareBooking = async () => {
    if (!confirmation) {
      return;
    }

    const text = `Bron raqami: ${confirmation.booking_id}\nSartarosh: ${confirmation.barber_name}\nSana: ${formatHumanDate(
      confirmation.appointment_date,
    )}\nVaqt: ${confirmation.appointment_time}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Bron tafsilotlari",
          text,
        });
        setShareMessage("Bron tafsilotlari ulashildi.");
        return;
      }

      await navigator.clipboard.writeText(text);
      setShareMessage("Bron tafsilotlari nusxalandi.");
    } catch {
      setShareMessage("Ulashishda xatolik bo'ldi.");
    }
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const submitRating = async () => {
    if (!confirmation?.barber_id) {
      return;
    }
    if (ratingScore < 1 || ratingScore > 5) {
      setRatingMessage("Iltimos, 1 dan 5 gacha baho tanlang.");
      return;
    }

    try {
      setRatingLoading(true);
      setRatingMessage(null);
      await submitBarberRating(confirmation.barber_id, {
        score: ratingScore,
        user_name: clientName || userName,
      });
      setRatingMessage("Rahmat! Bahoyingiz yuborildi.");

      const rows = await getUserBookingBarbers();
      setBarbers(rows);
    } catch (error) {
      setRatingMessage(error instanceof Error ? error.message : "Baho yuborilmadi.");
    } finally {
      setRatingLoading(false);
    }
  };

  const openDirectionsToBarber = () => {
    if (!selectedBarber) {
      return;
    }

    const params = new URLSearchParams({ api: "1", travelmode: "driving" });
    if (userCoords) {
      params.set("origin", `${userCoords.lat},${userCoords.lng}`);
    }

    if (typeof selectedBarber.location_latitude === "number" && typeof selectedBarber.location_longitude === "number") {
      params.set("destination", `${selectedBarber.location_latitude},${selectedBarber.location_longitude}`);
    } else {
      params.set("destination", selectedBarber.barbershop_address || selectedBarber.barbershop_name || selectedBarber.name);
    }

    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="ub-shell">
      {profileToast ? <div className={`ba-toast ba-toast-${profileToast.type}`}>{profileToast.message}</div> : null}

      <div className="ub-panel-grid">
        {/* Left side navigation — same pattern as barber panel */}
        <aside className="ub-left-menu">
          <button
            className={`ub-left-btn ${view === "booking" ? "active" : ""}`}
            onClick={() => setView("booking")}
          >
            Bron qilish
          </button>
          <button
            className={`ub-left-btn ${view === "profile" ? "active" : ""}`}
            onClick={() => setView("profile")}
          >
            Profil
          </button>
        </aside>

        {/* Main panel */}
        <div className="ub-main-panel">
          {/* Header */}
          <header className="ub-page-head">
            <div>
              <div className="ub-page-eyebrow">Foydalanuvchi paneli</div>
              <h1 className="ub-page-title">Xush kelibsiz, {userName || "Mehmon"}</h1>
              <p className="ub-page-sub">Qulay bron qilish, tezkor tanlov va real vaqtdagi bo'sh vaqtlar.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="ub-av-btn" onClick={() => setView("profile")} aria-label="Profil">
                {currentAvatar ? (
                  <img src={currentAvatar} alt={userName} className="ub-av-img" />
                ) : (
                  <span className="ub-av-placeholder">{initials}</span>
                )}
              </button>
              <button className="ub-logout" onClick={onLogout}>Chiqish</button>
            </div>
          </header>

          {/* ── Profile page ── */}
          {view === "profile" ? (
            <section className="ub-card ub-profile-page">
              <h3>Mening profilim</h3>

              <div className="prof-avatar-section">
                <div className="prof-avatar-wrap">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="prof-avatar-img" />
                  ) : (
                    <div className="prof-avatar-placeholder">{initials}</div>
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
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                {currentAvatar ? (
                  <button
                    type="button"
                    className="prof-avatar-remove"
                    onClick={() => { setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Rasmni o'chirish
                  </button>
                ) : null}
              </div>

              <div className="barber-form">
                <label className="barber-field">
                  <span>To'liq ism</span>
                  <input value={profName} onChange={(e) => setProfName(e.target.value)} placeholder="Ismingiz" />
                </label>
                <label className="barber-field">
                  <span>Email</span>
                  <input type="email" value={profEmail} onChange={(e) => setProfEmail(e.target.value)} placeholder="Email" />
                </label>
                <label className="barber-field">
                  <span>Yangi parol (ixtiyoriy)</span>
                  <input
                    type="password"
                    value={profPassword}
                    onChange={(e) => setProfPassword(e.target.value)}
                    placeholder="Yangi parol"
                    autoComplete="new-password"
                  />
                </label>
                <div className="barber-form-actions">
                  <button type="button" className="ba-sec" onClick={() => setView("booking")} disabled={isSaving}>Ortga</button>
                  <button type="button" className="ba-pri" onClick={() => void handleProfileSave()} disabled={isSaving}>
                    {isSaving ? "Saqlanmoqda..." : "Saqlash"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Booking flow ── */}
          {view === "booking" ? (
            <>
              {/* KPI stats */}
              <div className="ub-kpi-grid">
                <div className="ub-kpi-item">
                  <span>Sartaroshlar</span>
                  <strong>{barbers.length}</strong>
                </div>
                <div className="ub-kpi-item">
                  <span>O'rtacha reyting</span>
                  <strong>{averageRating}</strong>
                </div>
                <div className="ub-kpi-item">
                  <span>Eng tajribali</span>
                  <strong>{maxExperience}+ yil</strong>
                </div>
              </div>

              {/* Step indicator */}
              <div className="ub-process">
                {BOOKING_STEPS.map((bookingStep, index) => {
                  const stepNumber = index + 1;
                  const state =
                    stepNumber === currentStepNumber ? "active" : stepNumber < currentStepNumber ? "done" : "idle";
                  return (
                    <div key={bookingStep.id} className={`ub-process-step ${state}`}>
                      <span>{stepNumber}</span>
                      <strong>{bookingStep.label}</strong>
                    </div>
                  );
                })}
              </div>

              {errorMessage ? <div className="ub-error">{errorMessage}</div> : null}

              {/* Barber list */}
              {step === "barbers" ? (
                <section className="ub-card ub-card-barbers">
                  <div className="ub-layout-v3">
                    <div className="ub-hero-card">
                      <div className="ub-logo-row">
                        <div className="ub-logo-icon"><FiScissors /></div>
                        <div className="ub-brand">SARTAROSHXONA</div>
                      </div>
                      <h2 className="ub-title ub-title-compact">Sartaroshni tanlang</h2>
                      <p className="ub-list-sub">Ro'yxatdan usta tanlang, vaqt belgilang va bronni tez yakunlang.</p>
                      <p className="ub-list-sub" style={{ marginTop: 4 }}>{locationLabel}</p>
                      <div className="ub-hero-pills">
                        <span><FiZap /> Tezkor bron</span>
                        <span><FiShield /> Ishonchli ustalar</span>
                        <span><FiClock /> Jonli vaqtlar</span>
                      </div>
                    </div>

                    <aside className="ub-side-column">
                      <div className="ub-side-card">
                        <div className="ub-side-title">Qanday ishlaydi?</div>
                        <div className="ub-side-steps">
                          <div><span>1</span>Sartaroshni tanlang</div>
                          <div><span>2</span>Bo'sh vaqtni belgilang</div>
                          <div><span>3</span>Ma'lumotni tasdiqlang</div>
                        </div>
                      </div>
                    </aside>

                    <div className="ub-list-block">
                      <div className="ub-barbers-list-wrap">
                        <div className="ub-section-title">SARTAROSHLAR RO'YXATI</div>
                        <div className="ub-search-wrap">
                          <input
                            className="ub-search-input"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Sartarosh yoki xizmat bo'yicha qidiring..."
                          />
                        </div>
                        <div className="ub-barber-list">
                          {filteredBarbers.map((barber) => (
                            <button key={barber.id} className={`ub-barber-row ${preferredBarberId === barber.id ? "preferred" : ""}`} onClick={() => void pickBarber(barber)}>
                              {barber.photo_url ? (
                                <img src={barber.photo_url} alt={barber.name} className="ub-barber-avatar" />
                              ) : (
                                <div className="ub-barber-avatar ub-barber-avatar-fallback">{getInitials(barber.name)}</div>
                              )}
                              <div className="ub-barber-info">
                                <strong>{barber.name}</strong>
                                <span>{barber.work_directions || barber.specialty}</span>
                                <span>{barber.barbershop_address || barber.barbershop_name || "Manzil ko'rsatilmagan"}</span>
                                <small>
                                  <span className="ub-meta-item"><FiMapPin /> {formatDistance(barber.distance_km)}</span>
                                  <span className="ub-meta-sep">·</span>
                                  <span className="ub-meta-item"><FiStar /> {barber.rating}</span>
                                  <span className="ub-meta-sep">·</span>
                                  <span className="ub-meta-item"><FiClock /> {barber.years_experience}+ yil</span>
                                  <span className="ub-meta-sep">·</span>
                                  <span className="ub-meta-item"><FiScissors /> {formatPrice(barber.service_price)} ({formatDiscount(barber.discount_percent)})</span>
                                </small>
                              </div>
                              <span className="ub-go"><FiArrowRight /></span>
                            </button>
                          ))}
                          {!loading && filteredBarbers.length === 0 ? <div className="ub-empty">Mos sartarosh topilmadi.</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {/* Barber detail */}
              {step === "barber-detail" && selectedBarber ? (
                <section className="ub-card ub-barber-detail-card">
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <button className="ub-back-btn" onClick={() => setStep("barbers")}>← Orqaga</button>
                    <button className="ub-back-btn" onClick={openDirectionsToBarber}>📍 Sartaroshga borish</button>
                  </div>
                  <div className="ub-bd-hero">
                    {selectedBarber.photo_url ? (
                      <img src={selectedBarber.photo_url} alt={selectedBarber.name} className="ub-bd-avatar" />
                    ) : (
                      <div className="ub-bd-avatar ub-bd-avatar-fallback" style={{ background: selectedBarber.color ?? "linear-gradient(135deg,#6366f1,#818cf8)" }}>
                        {getInitials(selectedBarber.name)}
                      </div>
                    )}
                    <div className="ub-bd-hero-info">
                      <h2>{selectedBarber.name}</h2>
                      <span className="ub-bd-specialty">{selectedBarber.work_directions || selectedBarber.specialty}</span>
                      <div className="ub-bd-badges">
                        <span className={`ub-bd-status ${selectedBarber.status === "available" ? "available" : "busy"}`}>
                          {selectedBarber.status === "available" ? "🟢 Bo'sh" : "🔴 Band"}
                        </span>
                        <span className="ub-bd-status available">💸 {formatDiscount(selectedBarber.discount_percent)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ub-bd-stats">
                    <div className="ub-bd-stat"><FiStar /><strong>{selectedBarber.rating}</strong><span>Reyting</span></div>
                    <div className="ub-bd-stat"><FiClock /><strong>{selectedBarber.years_experience}+ yil</strong><span>Tajriba</span></div>
                    <div className="ub-bd-stat"><FiScissors /><strong>{formatPrice(selectedBarber.service_price)}</strong><span>Narxi</span></div>
                  </div>
                  {selectedBarber.bio && (
                    <div className="ub-bd-section">
                      <div className="ub-bd-section-title">BIO</div>
                      <p className="ub-bd-bio">{selectedBarber.bio}</p>
                    </div>
                  )}
                  <div className="ub-bd-section">
                    <div className="ub-bd-section-title">XIZMAT MA'LUMOTI</div>
                    <div className="ub-bd-info-row"><FiScissors /><span>Yo'nalish:</span><strong>{selectedBarber.specialty}</strong></div>
                    <div className="ub-bd-info-row"><FiStar /><span>Narx:</span><strong>{formatPrice(selectedBarber.service_price)}</strong></div>
                    <div className="ub-bd-info-row"><FiMapPin /><span>Manzil:</span><strong>{selectedBarber.barbershop_address || selectedBarber.barbershop_name || "Kiritilmagan"}</strong></div>
                    {selectedBarber.phone && (
                      <div className="ub-bd-info-row"><FiShield /><span>Telefon:</span><strong>{selectedBarber.phone}</strong></div>
                    )}
                  </div>
                  <button
                    className="ub-primary"
                    onClick={() => void confirmBarber()}
                    disabled={loading || selectedBarber.status !== "available"}
                  >
                    {loading ? "Yuklanmoqda..." : selectedBarber.status === "available" ? "Vaqtni tanlash →" : "Hozir band"}
                  </button>
                </section>
              ) : null}

              {/* Time selection */}
              {step === "times" && selectedBarber ? (
                <section className="ub-card">
                  <div className="ub-step-head">
                    <button className="ub-back" onClick={() => setStep("barber-detail")}>←</button>
                    <div>
                      <h3>Vaqtni tanlang</h3>
                      <p>{selectedBarber.name} uchun bo'sh slotlar</p>
                    </div>
                  </div>
                  <div className="ub-summary">
                    {selectedBarber.photo_url ? (
                      <img src={selectedBarber.photo_url} alt={selectedBarber.name} className="ub-barber-avatar" />
                    ) : (
                      <div className="ub-barber-avatar ub-barber-avatar-fallback">{getInitials(selectedBarber.name)}</div>
                    )}
                    <div>
                      <strong>{selectedBarber.name}</strong>
                      <span>{selectedBarber.specialty}</span>
                    </div>
                  </div>
                  <div className="ub-date-nav">
                    <button onClick={() => void shiftDate(-1)} disabled={isSelectedToday || isSelectedPast}>‹</button>
                    <div>
                      <strong>{dateLabelPrefix || humanDate}</strong>
                      <span>{dateLabelPrefix ? humanDate : ""}</span>
                    </div>
                    <button onClick={() => void shiftDate(1)}>›</button>
                  </div>
                  <div className="ub-section-title">MAVJUD VAQTLAR</div>
                  <div className="ub-slots-grid">
                    {(availability?.slots || []).map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      const isBooked = slot.status === "booked";
                      const isPast = isSelectedPast;
                      return (
                        <button
                          key={slot.time}
                          className={`ub-slot ${isSelected ? "selected" : ""} ${isBooked ? "booked" : ""} ${isPast ? "past" : ""}`}
                          disabled={isBooked || isPast}
                          onClick={() => !isPast && setSelectedTime(slot.time)}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                  <div className="ub-slot-legend">
                    <span>● Tanlangan</span>
                    <span>○ Bo'sh</span>
                    <span>◌ Band</span>
                  </div>
                  {isSelectedPast && (
                    <p className="ub-past-warning">⚠️ O'tgan kunlarga bron qilish mumkin emas. Bugun yoki keyingi kunni tanlang.</p>
                  )}
                  <button className="ub-primary" onClick={continueToDetails} disabled={!selectedTime || loading || isSelectedPast}>
                    Davom etish — {selectedTime || "--"}
                  </button>
                </section>
              ) : null}

              {/* Details form */}
              {step === "details" && selectedBarber ? (
                <section className="ub-card">
                  <div className="ub-step-head">
                    <button className="ub-back" onClick={() => setStep("times")}>←</button>
                    <div>
                      <h3>Ma'lumotlaringiz</h3>
                      <p>Yakunlash uchun ma'lumotni tekshiring</p>
                    </div>
                  </div>
                  <div className="ub-booking-summary">
                    <div className="ub-summary-row">
                      {selectedBarber.photo_url ? (
                        <img src={selectedBarber.photo_url} alt={selectedBarber.name} className="ub-barber-avatar" />
                      ) : (
                        <div className="ub-barber-avatar ub-barber-avatar-fallback">{getInitials(selectedBarber.name)}</div>
                      )}
                      <div>
                        <strong>{selectedBarber.name}</strong>
                        <span>{selectedBarber.work_directions || selectedBarber.specialty}</span>
                      </div>
                    </div>
                    <div className="ub-inline-info"><FiCalendar /> {humanDate}</div>
                    <div className="ub-inline-info"><FiClock /> {selectedTime}</div>
                    <div className="ub-inline-info"><FiScissors /> {formatPrice(selectedBarber.service_price)}</div>
                    <div className="ub-inline-info"><FiZap /> {formatDiscount(selectedBarber.discount_percent)}</div>
                  </div>
                  <label className="ub-field">
                    <span>To'liq ism</span>
                    <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ismingizni kiriting" />
                  </label>
                  <label className="ub-field">
                    <span>Telefon raqam</span>
                    <input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="+998 90 123 45 67" />
                  </label>
                  <small className="ub-help">Bron vaqtiga yaqin eslatma yuboramiz.</small>
                  <button className="ub-primary" onClick={() => void submitBooking()} disabled={loading}>
                    {loading ? "Tasdiqlanmoqda..." : "Bronni tasdiqlash"}
                  </button>
                </section>
              ) : null}

              {/* Success */}
              {step === "success" && confirmation ? (
                <section className="ub-card ub-success-card">
                  <div className="ub-success-icon-wrap">
                    <div className="ub-success-icon"><FiCheck /></div>
                    <span className="ub-success-badge"><FiCheck /></span>
                  </div>
                  <h3>Barchasi tayyor!</h3>
                  <p>Broningiz qabul qilindi, tez orada siz bilan bog'lanamiz.</p>
                  <div className="ub-success-summary">
                    <div className="ub-success-row">
                      <span>BRON RAQAMI</span>
                      <strong>{confirmation.booking_id}</strong>
                      <em>Tasdiqlandi</em>
                    </div>
                    <div className="ub-summary-row">
                      {confirmation.barber_photo_url ? (
                        <img src={confirmation.barber_photo_url} alt={confirmation.barber_name} className="ub-barber-avatar" />
                      ) : (
                        <div className="ub-barber-avatar ub-barber-avatar-fallback">{getInitials(confirmation.barber_name)}</div>
                      )}
                      <div>
                        <strong>{confirmation.barber_name}</strong>
                        <span>{confirmation.barber_specialty}</span>
                      </div>
                    </div>
                    <div>{formatHumanDate(confirmation.appointment_date)}</div>
                    <div>{confirmation.appointment_time}</div>
                    <div>Narxi: {formatPrice(confirmation.service_price)}</div>
                    <div>Skidka: {formatDiscount(confirmation.discount_percent)}</div>
                    <div>
                      Bron vaqti: {confirmation.created_at
                        ? formatDateTimeInTashkent(confirmation.created_at, "uz-UZ", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-"} (Toshkent)
                    </div>
                    <div>Mijoz: {confirmation.client_name}</div>
                  </div>
                  <div className="ub-share-note">✅ Siz bilan telefon orqali bog'lanamiz.</div>
                  <div className="ub-rating-box">
                    <div className="ub-rating-title">Sartaroshga baho bering</div>
                    <div className="ub-rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`ub-rating-star ${ratingScore >= star ? "active" : ""}`}
                          onClick={() => setRatingScore(star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <button className="ub-secondary" onClick={() => void submitRating()} disabled={ratingLoading}>
                      {ratingLoading ? "Yuborilmoqda..." : "Bahoni yuborish"}
                    </button>
                    {ratingMessage ? <div className="ub-rating-msg">{ratingMessage}</div> : null}
                  </div>
                  {shareMessage ? <div className="ub-share-note">{shareMessage}</div> : null}
                  <button className="ub-primary" onClick={goHome}>Bosh sahifaga o'tish</button>
                  <button className="ub-secondary" onClick={() => void shareBooking()}>
                    <FiShare2 /> Tafsilotlarni ulashish
                  </button>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
