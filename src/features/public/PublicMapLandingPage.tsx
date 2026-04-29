import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { divIcon, type Map as LeafletMap } from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  getPublicBarbershopDetail,
  getPublicBarbershops,
  type PublicBarbershopDetailApi,
  type PublicBarbershopMapItemApi,
} from "../admin-panel/api";
import { subscribeRealtimeChannel } from "../../lib/realtime";

interface PublicMapLandingPageProps {
  onStartLogin: () => void;
  onSelectBarber: (barberId: number) => void;
}

type SearchScope = "near" | "far";
const TASHKENT_COORDS = { lat: 41.311081, lng: 69.240562 };

function createShopMarkerIcon(active: boolean) {
  return divIcon({
    className: "",
    html: `<div class="public-shop-marker ${active ? "active" : ""}">✂</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createUserMarkerIcon() {
  return divIcon({
    className: "",
    html: '<div class="public-user-marker">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function PublicMapLandingPage({ onStartLogin, onSelectBarber }: PublicMapLandingPageProps) {
  const [scope, setScope] = useState<SearchScope>("near");
  const [coords, setCoords] = useState(TASHKENT_COORDS);
  const [hasExactLocation, setHasExactLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string>("Joylashuv aniqlanmoqda...");

  const [shops, setShops] = useState<PublicBarbershopMapItemApi[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedShop, setSelectedShop] = useState<PublicBarbershopDetailApi | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const requestGeolocation = useCallback(
    (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Brauzer geolokatsiyani qo'llamaydi"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      }),
    [],
  );

  const requestIpFallback = useCallback(async () => {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) {
      throw new Error("IP lokatsiya xizmati javob bermadi");
    }

    const payload = (await response.json()) as { latitude?: number; longitude?: number };
    if (typeof payload.latitude !== "number" || typeof payload.longitude !== "number") {
      throw new Error("IP lokatsiyada koordinata topilmadi");
    }

    return { lat: payload.latitude, lng: payload.longitude };
  }, []);

  const loadShops = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const rows = await getPublicBarbershops({ lat: coords.lat, lng: coords.lng, scope });
      setShops(rows);

      if (rows.length === 0) {
        setSelectedShopId(null);
        setSelectedShop(null);
        return;
      }

      const fallbackShopId = selectedShopId && rows.some((item) => item.id === selectedShopId) ? selectedShopId : rows[0].id;
      setSelectedShopId(fallbackShopId);

      const detail = await getPublicBarbershopDetail(fallbackShopId, { lat: coords.lat, lng: coords.lng });
      setSelectedShop(detail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sartaroshxonalarni yuklashda xatolik.");
    } finally {
      setIsLoading(false);
    }
  }, [coords.lat, coords.lng, scope, selectedShopId]);

  const locateCurrentPosition = useCallback(async () => {
    setIsLocating(true);

    try {
      const firstTry = await requestGeolocation({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });

      const nextCoords = {
        lat: firstTry.coords.latitude,
        lng: firstTry.coords.longitude,
      };

      setCoords(nextCoords);
      setHasExactLocation(true);
      setLocationMessage("Aniq GPS joylashuv topildi");
      setScope("near");

      if (mapRef.current) {
        mapRef.current.flyTo([nextCoords.lat, nextCoords.lng], 13, { duration: 0.8 });
      }
      return;
    } catch {
      try {
        const secondTry = await requestGeolocation({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60_000,
        });

        const nextCoords = {
          lat: secondTry.coords.latitude,
          lng: secondTry.coords.longitude,
        };

        setCoords(nextCoords);
        setHasExactLocation(true);
        setLocationMessage("Joylashuv topildi (o'rtacha aniqlik)");
        setScope("near");

        if (mapRef.current) {
          mapRef.current.flyTo([nextCoords.lat, nextCoords.lng], 13, { duration: 0.8 });
        }
        return;
      } catch {
        try {
          const ipCoords = await requestIpFallback();
          setCoords(ipCoords);
          setHasExactLocation(false);
          setLocationMessage("GPS ishlamadi, IP bo'yicha taxminiy joylashuv qo'yildi");
          setScope("near");

          if (mapRef.current) {
            mapRef.current.flyTo([ipCoords.lat, ipCoords.lng], 12, { duration: 0.8 });
          }
          return;
        } catch {
          setCoords(TASHKENT_COORDS);
          setHasExactLocation(false);
          setLocationMessage("Joylashuv olinmadi. Ruxsat bering va yana bosing.");
          setScope("near");
        }
      }
    } finally {
      setIsLocating(false);
    }
  }, [requestGeolocation, requestIpFallback]);

  const focusCurrentLocation = useCallback(() => {
    void locateCurrentPosition();
  }, [locateCurrentPosition]);

  const openShop = useCallback(
    async (shopId: number) => {
      setSelectedShopId(shopId);
      const detail = await getPublicBarbershopDetail(shopId, { lat: coords.lat, lng: coords.lng });
      setSelectedShop(detail);
      if (mapRef.current) {
        mapRef.current.flyTo([detail.latitude, detail.longitude], 14, { duration: 0.7 });
      }
    },
    [coords.lat, coords.lng],
  );

  useEffect(() => {
    void locateCurrentPosition();
  }, [locateCurrentPosition]);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("public-map", () => {
      void loadShops();
    });

    return unsubscribe;
  }, [loadShops]);

  const mapCenter = useMemo<[number, number]>(
    () => (selectedShop ? [selectedShop.latitude, selectedShop.longitude] : [coords.lat, coords.lng]),
    [selectedShop, coords.lat, coords.lng],
  );

  return (
    <div className="public-shell public-shell-v2">
      <div className="public-backdrop" />

      <div className="public-wrap public-wrap-v2">
        <div className="public-top-row">
          <div>
            <div className="public-eyebrow">Smart Barber Map</div>
            <h1>Yaqin sartaroshxonalardan birini tanlang</h1>
            <p className="public-head-sub">Kerakli sartaroshni bossangiz, darhol login sahifasiga o‘tasiz.</p>
          </div>
          <div className="public-head-actions">
            <button type="button" className={`public-toggle ${scope === "near" ? "active" : ""}`} onClick={() => setScope("near")}>Yaqin atrofdan izlash</button>
            <button type="button" className={`public-toggle ${scope === "far" ? "active" : ""}`} onClick={() => setScope("far")}>Uzoqdan izlash</button>
            <button type="button" className="public-login-cta" onClick={onStartLogin}>Login sahifaga o‘tish</button>
          </div>
        </div>

        <div className="public-main-grid">
          <aside className="public-left-panel">
            <div className="public-left-title">{selectedShop?.name || "Sartaroshxona tanlang"}</div>
            <div className="public-left-sub">{selectedShop?.address || "Marker bosib salonni tanlang"}</div>

            {selectedShop?.barbers?.length ? (
              <div className="public-barber-list">
                {selectedShop.barbers.map((barber) => (
                  <button
                    key={barber.id}
                    type="button"
                    className="public-barber-item public-barber-item-btn"
                    onClick={() => onSelectBarber(barber.id)}
                  >
                    {barber.photo_url ? <img src={barber.photo_url} alt={barber.name} /> : <div className="public-barber-fallback">{barber.name.slice(0, 1)}</div>}
                    <div>
                      <strong>{barber.name}</strong>
                      <small>{barber.specialty}</small>
                      <small>⭐ {barber.rating ?? 0} · {barber.years_experience ?? 0} yil</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="public-empty">Sartaroshlarni ko‘rish uchun salondan birini tanlang.</div>
            )}
          </aside>

          <section className="public-map-card public-map-card-v2">
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={12}
              className="public-map public-map-v2"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker position={[coords.lat, coords.lng]} icon={createUserMarkerIcon()} />

              {shops.map((shop) => (
                <Marker
                  key={shop.id}
                  position={[shop.latitude, shop.longitude]}
                  icon={createShopMarkerIcon(shop.id === selectedShopId)}
                  eventHandlers={{ click: () => void openShop(shop.id) }}
                />
              ))}
            </MapContainer>

            <button type="button" className="public-locate-btn" onClick={focusCurrentLocation} disabled={isLocating}>
              {isLocating ? "Aniqlanmoqda..." : "📍 Joylashuvim"}
            </button>

            <div className="public-map-note">
              {hasExactLocation ? `✅ ${locationMessage}` : `⚠️ ${locationMessage}`}
            </div>
          </section>
        </div>

        {isLoading ? <div className="public-loading">Xarita ma'lumotlari yuklanmoqda...</div> : null}
        {errorMessage ? <div className="public-error">{errorMessage}</div> : null}

        <div className="public-shop-strip">
          {shops.map((shop) => (
            <button
              key={shop.id}
              type="button"
              className={`public-shop-strip-item ${selectedShopId === shop.id ? "active" : ""}`}
              onClick={() => void openShop(shop.id)}
            >
              <img
                src={shop.photo_url || "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80"}
                alt={shop.name}
              />
              <div>
                <strong>{shop.name}</strong>
                <small>{shop.distance_km ?? "-"} km · {shop.barber_count} usta</small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
