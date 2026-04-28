import { useCallback, useEffect, useState } from "react";
import { chartData, maxChart } from "../data";
import type { Page } from "../types";
import { ICal, ICheck, IDollar, IPlus, ISciss, ITrend, IUsers } from "../icons";
import { BookingsTable } from "./BookingsTable";
import { StatCard } from "./StatCard";
import { topCopy } from "../copy";
import { formatUzs } from "../utils/currency";
import { getBarbers, getBookings, type AdminBookingApi, type BarberApi } from "../api";
import { subscribeRealtimeChannel } from "../../../lib/realtime";

interface DashboardPageProps {
  onNavigate: (page: Page) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [barbers, setBarbers] = useState<BarberApi[]>([]);
  const [bookings, setBookings] = useState<AdminBookingApi[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    const [barberRows, bookingRows] = await Promise.all([
      getBarbers(),
      getBookings({ status: "all" }),
    ]);
    setBarbers(barberRows);
    setBookings(bookingRows);
  }, []);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean).slice(0, 2);
    if (parts.length === 0) {
      return "SB";
    }
    return parts.map((item) => item[0]?.toUpperCase() ?? "").join("");
  };

  useEffect(() => {
    (async () => {
      try {
        await loadDashboardData();
      } catch (error) {
        console.error("Dashboard ma'lumotlarini yuklab bo'lmadi:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboardData]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("bookings", () => {
      void loadDashboardData().catch(() => undefined);
    });
    return unsubscribe;
  }, [loadDashboardData]);

  const completedCount = bookings.filter((booking) => booking.status === "completed").length;
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const revenue = bookings
    .filter((booking) => booking.status === "completed")
    .reduce((sum, booking) => sum + booking.price, 0);

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">{topCopy.dashboard.eyebrow}</div>
          <h2 className="ph-title">{topCopy.dashboard.title}</h2>
          <p className="ph-sub">{topCopy.dashboard.subtitle}</p>
        </div>
        <button className="btn-glow" onClick={() => onNavigate("bookings")}>
          <IPlus /> {topCopy.dashboard.cta}
        </button>
      </div>

      <div className="sc-row">
        <StatCard
          value={String(bookings.length)}
          label="Jami bronlar"
          sub="Bugungi hammasida"
          gradient="linear-gradient(135deg,#1e40af,#3b82f6)"
          icon={<ICal />}
        />
        <StatCard
          value={String(barbers.filter((barber) => barber.status !== "off").length)}
          label="Ishdagi sartaroshlar"
          sub="Hozir faol"
          gradient="linear-gradient(135deg,#0f172a,#1e293b)"
          icon={<IUsers />}
        />
        <StatCard
          value={String(completedCount)}
          label="Yakunlangan bronlar"
          sub="Bugun tugadi"
          gradient="linear-gradient(135deg,#065f46,#059669)"
          icon={<ICheck />}
        />
        <StatCard
          value={String(pendingCount)}
          label="Kutilayotgan bronlar"
          sub="Navbatda turgan"
          gradient="linear-gradient(135deg,#78350f,#d97706)"
          icon={<ISciss />}
        />
      </div>

      <div className="mid-grid">
        <div className="glass-card chart-card">
          <div className="gc-head">
            <div>
              <div className="gc-eyebrow">Tahlil</div>
              <h3>Haftalik bronlar</h3>
              <p>Yakunlangan va kutilayotgan bronlar taqqoslanishi</p>
            </div>
            <div className="legend">
              <div className="leg-item">
                <span className="leg-dot blue-dot" />Yakunlangan
              </div>
              <div className="leg-item">
                <span className="leg-dot dim-dot" />Kutilayotgan
              </div>
            </div>
          </div>

          <div className="chart-area">
            <div className="y-lines">
              {[0, 1, 2, 3, 4].map((step) => (
                <div key={step} className="y-line" style={{ bottom: `${step * 25}%` }}>
                  <span>{Math.round((maxChart * step) / 4)}</span>
                </div>
              ))}
            </div>
            <div className="bars-row">
              {chartData.map((dayItem) => (
                <div className="bar-col" key={dayItem.day}>
                  <div className="bar-stack">
                    <div className="bar-seg bar-completed" style={{ height: `${(dayItem.completed / maxChart) * 180}px` }} />
                    <div className="bar-seg bar-pending" style={{ height: `${(dayItem.pending / maxChart) * 180}px` }} />
                  </div>
                  <span className="bar-lbl">{dayItem.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card perf-card">
          <div className="gc-head">
            <div>
              <div className="gc-eyebrow">Jamoa</div>
              <h3>Sartaroshlar samaradorligi</h3>
              <p>Bugungi ish ko'rsatkichi</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate("barbers")}>
              Barchasini ko'rish →
            </button>
          </div>

          <div className="perf-list">
            {barbers.map((barber) => {
              const total = barber.today_cuts + (barber.status === "busy" ? 2 : 1);
              const completionPercent = Math.round((barber.today_cuts / total) * 100);

              return (
                <div className="perf-row" key={barber.id}>
                  <div className="p-av" style={{ background: barber.gradient }}>
                    {getInitials(barber.name)}
                  </div>
                  <div className="p-info">
                    <div className="p-top">
                      <strong>{barber.name}</strong>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="track">
                      <div className="track-fill" style={{ width: `${completionPercent}%`, background: barber.gradient }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rev-row">
        <div className="glass-card rev-card">
          <div className="rev-ico">
            <IDollar />
          </div>
          <div className="rev-val">{formatUzs(revenue)}</div>
          <div className="rev-lbl">Bugungi tushum</div>
          <div className="rev-sub">{completedCount} ta yakunlangan bron</div>
        </div>

        <div className="glass-card rev-card">
          <div className="rev-ico">
            <ITrend />
          </div>
          <div className="rev-val">{formatUzs(completedCount > 0 ? Math.round(revenue / completedCount) : 0)}</div>
          <div className="rev-lbl">Har bron uchun o'rtacha</div>
          <div className="rev-sub">Faqat yakunlangan xizmatlar bo'yicha</div>
        </div>

        <div className="glass-card rev-card">
          <div className="rev-ico" style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)" }}>
            <IUsers />
          </div>
          <div className="rev-val" style={{ fontSize: "26px" }}>
            Marcus
          </div>
          <div className="rev-lbl">Eng faol sartarosh</div>
          <div className="rev-sub">7 ta mijoz · ⭐ 4.9</div>
        </div>
      </div>

      <div className="glass-card table-card">
        <div className="gc-head tc-head">
          <div>
            <div className="gc-eyebrow">So'nggi yozuvlar</div>
            <h3>Oxirgi bronlar</h3>
            <p>Bugungi qabul ro'yxati</p>
          </div>
          <button className="link-btn" onClick={() => onNavigate("bookings")}>
            Barchasini ko'rish →
          </button>
        </div>
        <BookingsTable rows={bookings.slice(0, 6)} barbers={barbers} />
      </div>
    </>
  );
}
