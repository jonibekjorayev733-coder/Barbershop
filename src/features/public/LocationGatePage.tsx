import { useEffect, useState } from "react";
import { getPublicUserLocationByIp } from "../admin-panel/api";

interface LocationGatePageProps {
  onResolved: (coords?: { lat: number; lng: number } | null) => void;
}

export function LocationGatePage({ onResolved }: LocationGatePageProps) {
  const [message, setMessage] = useState("Joylashuvingiz so‘ralmoqda...");
  const [isWorking, setIsWorking] = useState(true);

  useEffect(() => {
    let isActive = true;

    const finish = (coords?: { lat: number; lng: number } | null) => {
      if (!isActive) {
        return;
      }
      setIsWorking(false);
      window.setTimeout(() => {
        if (isActive) {
          onResolved(coords ?? null);
        }
      }, 500);
    };

    const run = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setMessage("Joylashuv olindi. Login sahifasiga o‘tyapmiz...");
              finish({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            async () => {
              try {
                const ipLocation = await getPublicUserLocationByIp();
                setMessage("GPS berilmadi, IP bo‘yicha joylashuv olindi. Login sahifasiga o‘tyapmiz...");
                finish({ lat: ipLocation.lat, lng: ipLocation.lng });
              } catch {
                setMessage("Joylashuv olinmadi. Baribir login sahifasiga o‘tyapmiz...");
                finish(null);
              }
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
          );
          return;
        }

        const ipLocation = await getPublicUserLocationByIp();
        setMessage("IP bo‘yicha joylashuv olindi. Login sahifasiga o‘tyapmiz...");
        finish({ lat: ipLocation.lat, lng: ipLocation.lng });
      } catch {
        setMessage("Joylashuv aniqlanmadi. Login sahifasiga o‘tyapmiz...");
        finish(null);
      }
    };

    void run();

    return () => {
      isActive = false;
    };
  }, [onResolved]);

  return (
    <div className="login-shell">
      <div className="login-card location-gate-card">
        <div className="login-brand">Sharp Cuts</div>
        <h1>Joylashuvni aniqlaymiz</h1>
        <p>Yaqin sartaroshlarni ko‘rsatish uchun birinchi kirishda joylashuv ruxsati so‘raladi.</p>
        <div className="login-hint">{message}</div>
        <button type="button" className="login-btn" disabled={isWorking} onClick={() => onResolved(null)}>
          {isWorking ? "Aniqlanmoqda..." : "Davom etish"}
        </button>
      </div>
    </div>
  );
}
