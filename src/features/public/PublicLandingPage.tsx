import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  getPublicBarbershopDetail,
  getPublicBarbershops,
  loginUser,
  registerUser,
  type LoginResponse,
  type PublicBarbershopDetailApi,
  type PublicBarbershopMapItemApi,
} from "../admin-panel/api";
import { subscribeRealtimeChannel } from "../../lib/realtime";

interface PublicLandingPageProps {
  onLogin: (session: LoginResponse) => void;
}

type SearchScope = "near" | "far";

const TASHKENT_COORDS = { lat: 41.311081, lng: 69.240562 };

export function PublicLandingPage({ onLogin }: PublicLandingPageProps) {
  const [scope, setScope] = useState<SearchScope>("near");
  const [coords, setCoords] = useState(TASHKENT_COORDS);
  const [hasExactLocation, setHasExactLocation] = useState(false);

  const [shops, setShops] = useState<PublicBarbershopMapItemApi[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedShop, setSelectedShop] = useState<PublicBarbershopDetailApi | null>(null);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadShops = useCallback(async () => {
    try {
      setIsLoadingShops(true);
      setShopError(null);
      const rows = await getPublicBarbershops({ lat: coords.lat, lng: coords.lng, scope });
      setShops(rows);

      if (rows.length === 0) {
        setSelectedShopId(null);
        setSelectedShop(null);
        return;
      }

      const fallbackId = selectedShopId && rows.some((item) => item.id === selectedShopId) ? selectedShopId : rows[0].id;
      setSelectedShopId(fallbackId);
      const detail = await getPublicBarbershopDetail(fallbackId, { lat: coords.lat, lng: coords.lng });
      setSelectedShop(detail);
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Sartaroshxonalarni yuklashda xatolik.");
    } finally {
      setIsLoadingShops(false);
    }
  }, [coords.lat, coords.lng, scope, selectedShopId]);

  const loadShopDetail = useCallback(
    async (shopId: number) => {
      setSelectedShopId(shopId);
      try {
        const detail = await getPublicBarbershopDetail(shopId, { lat: coords.lat, lng: coords.lng });
        setSelectedShop(detail);
      } catch (error) {
        setShopError(error instanceof Error ? error.message : "Sartaroshxona ma'lumoti yuklanmadi.");
      }
    },
    [coords.lat, coords.lng],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      void loadShops();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setHasExactLocation(true);
      },
      () => {
        setCoords(TASHKENT_COORDS);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
      },
    );
  }, []);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("public-map", () => {
      void loadShops();
    });

    return unsubscribe;
  }, [loadShops]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedShop) {
      return [selectedShop.latitude, selectedShop.longitude];
    }
    return [coords.lat, coords.lng];
  }, [selectedShop, coords.lat, coords.lng]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim() || (authMode === "register" && !name.trim())) {
      setAuthError("Kerakli maydonlarni to'ldiring.");
      return;
    }

    if (authMode === "register" && password.trim() !== confirmPassword.trim()) {
      setAuthError("Parollar bir xil emas.");
      return;
    }

    try {
      setIsAuthLoading(true);
      setAuthError(null);

      const session =
        authMode === "login"
          ? await loginUser({ email: email.trim(), password: password.trim() })
          : await registerUser({ name: name.trim(), email: email.trim(), password: password.trim() });

      onLogin(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Kirishda xatolik yuz berdi.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="public-shell">
      <div className="public-backdrop" />
      <div className="public-wrap">
        <section className="public-hero-card">
          <div className="public-head">
            <div>
              <div className="public-eyebrow">Barber Studio Locator</div>
              <h1>Yaqin sartaroshxonani xaritada toping</h1>
              <p>
                Joylashuvingiz avtomatik aniqlanadi, yaqin yoki uzoq sartaroshxonalarni tanlaysiz va marker bosib barcha ma'lumotni ko'rasiz.
              </p>
            </div>
            <div className="public-badges">
              <span>{hasExactLocation ? "📍 Joylashuv aniqlandi" : "📌 Toshkent bo'yicha"}</span>
              <span>🛰️ Realtime yangilanish</span>
            </div>
          </div>

          <div className="public-toggle-row">
            <button
              type="button"
              className={`public-toggle ${scope === "near" ? "active" : ""}`}
              onClick={() => setScope("near")}
            >
              Yaqin atrofdan izlash
            </button>
            <button
              type="button"
              className={`public-toggle ${scope === "far" ? "active" : ""}`}
              onClick={() => setScope("far")}
            >
              Uzoqdan izlash
            </button>
          </div>

          <div className="public-map-grid">
            <div className="public-map-card">
              <MapContainer center={mapCenter} zoom={12} className="public-map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <CircleMarker center={[coords.lat, coords.lng]} radius={10} pathOptions={{ color: "#0ea5e9", fillColor: "#38bdf8", fillOpacity: 0.8 }} />

                {shops.map((shop) => (
                  <CircleMarker
                    key={shop.id}
                    center={[shop.latitude, shop.longitude]}
                    radius={selectedShopId === shop.id ? 14 : 10}
                    pathOptions={{
                      color: selectedShopId === shop.id ? "#22c55e" : "#f59e0b",
                      fillColor: selectedShopId === shop.id ? "#4ade80" : "#fbbf24",
                      fillOpacity: 0.86,
                    }}
                    eventHandlers={{
                      click: () => {
                        void loadShopDetail(shop.id);
                      },
                    }}
                  />
                ))}
              </MapContainer>
              <div className="public-map-note">Ko'k marker — sizning joyingiz, sariq/yashil marker — sartaroshxonalar.</div>
            </div>

            <aside className="public-side-card">
              {isLoadingShops ? <div className="public-loading">Xarita ma'lumotlari yuklanmoqda...</div> : null}
              {shopError ? <div className="public-error">{shopError}</div> : null}
              {!isLoadingShops && shops.length === 0 ? (
                <div className="public-empty">Bu filtr bo'yicha sartaroshxona topilmadi.</div>
              ) : null}

              {selectedShop ? (
                <>
                  <img className="public-shop-photo" src={selectedShop.photo_url || "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80"} alt={selectedShop.name} />
                  <h3>{selectedShop.name}</h3>
                  <p className="public-shop-address">{selectedShop.address}</p>
                  <p className="public-shop-desc">{selectedShop.description || "Sifatli xizmat va professional ustalar."}</p>

                  <div className="public-chip-row">
                    <span>{selectedShop.barber_count} ta sartarosh</span>
                    <span>{selectedShop.distance_km ?? "-"} km</span>
                  </div>

                  <div className="public-barber-list">
                    {selectedShop.barbers.map((barber) => (
                      <article key={barber.id} className="public-barber-item">
                        {barber.photo_url ? <img src={barber.photo_url} alt={barber.name} /> : <div className="public-barber-fallback">{barber.name.slice(0, 1)}</div>}
                        <div>
                          <strong>{barber.name}</strong>
                          <small>{barber.specialty}</small>
                          <small>⭐ {barber.rating ?? 0} · {barber.years_experience ?? 0} yil</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="public-auth-card">
          <div className="public-auth-head">
            <h2>{authMode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}</h2>
            <p>Salon tanlang va bir zumda bron qilishni boshlang.</p>
          </div>

          <div className="public-auth-tabs">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Kirish</button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Register</button>
          </div>

          <form className="public-auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" ? (
              <label>
                <span>Ism</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ismingiz" autoComplete="name" />
              </label>
            ) : null}
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="username" />
            </label>
            <label>
              <span>Parol</span>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Parol" autoComplete="current-password" style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748b", fontSize: 16 }} tabIndex={-1} aria-label="Parolni ko'rsatish">{showPassword ? "🙈" : "👁"}</button>
              </div>
            </label>
            {authMode === "register" ? (
              <label>
                <span>Parolni tasdiqlash</span>
                <div style={{ position: "relative" }}>
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Parolni qayta kiriting" autoComplete="new-password" style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }} />
                  <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748b", fontSize: 16 }} tabIndex={-1} aria-label="Parolni ko'rsatish">{showConfirmPassword ? "🙈" : "👁"}</button>
                </div>
              </label>
            ) : null}

            {authError ? <div className="public-error">{authError}</div> : null}

            <button type="submit" className="public-auth-btn" disabled={isAuthLoading}>
              {isAuthLoading ? "Yuklanmoqda..." : authMode === "login" ? "Kirish" : "Register va kirish"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
