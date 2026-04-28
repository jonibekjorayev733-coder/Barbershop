import { useCallback, useEffect, useState } from "react";
import { bookingFilterLabels, topCopy } from "../copy";
import type { BookingStatus } from "../types";
import { ICal, IChevronLeft, IChevronRight, IFilter } from "../icons";
import { BookingsTable } from "./BookingsTable";
import { getBarbers, getBookings, type AdminBookingApi, type BarberApi } from "../api";
import { subscribeRealtimeChannel } from "../../../lib/realtime";
import { formatIsoDateInTashkent, getTashkentTodayISO } from "../../../lib/time";

export function BookingsPage() {
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [barbers, setBarbers] = useState<BarberApi[]>([]);
  const [bookings, setBookings] = useState<AdminBookingApi[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => getTashkentTodayISO());

  const loadBookingsData = useCallback(async () => {
    const [barberRows, bookingRows] = await Promise.all([
      getBarbers(),
      getBookings({ date: selectedDate, status: filter }),
    ]);
    setBarbers(barberRows);
    setBookings(bookingRows);
  }, [filter, selectedDate]);

  const shiftDate = (days: number) => {
    const dateAnchor = new Date(`${selectedDate}T12:00:00Z`);
    dateAnchor.setUTCDate(dateAnchor.getUTCDate() + days);
    setSelectedDate(getTashkentTodayISO(dateAnchor));
  };

  useEffect(() => {
    (async () => {
      try {
        await loadBookingsData();
      } catch (error) {
        console.error("Bron/sartarosh ma'lumotlarini yuklab bo'lmadi:", error);
      }
    })();
  }, [loadBookingsData]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeChannel("bookings", () => {
      void loadBookingsData().catch(() => undefined);
    });
    return unsubscribe;
  }, [loadBookingsData]);

  const filteredBookings = filter === "all" ? bookings : bookings.filter((booking) => booking.status === filter);

  const doneCount = bookings.filter((booking) => booking.status === "completed").length;
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const formattedDate = formatIsoDateInTashkent(selectedDate, "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-eyebrow">{topCopy.bookings.eyebrow}</div>
          <h2 className="ph-title">{topCopy.bookings.title}</h2>
          <p className="ph-sub">{topCopy.bookings.subtitle}</p>
        </div>
      </div>

      <div className="glass-card bk-datebar">
        <button className="bk-nav-btn" aria-label="Oldingi kun" onClick={() => shiftDate(-1)}>
          <IChevronLeft />
        </button>

        <div className="bk-date-main">
          <span className="bk-date-ico">
            <ICal />
          </span>
          <strong>{formattedDate}</strong>
        </div>

        <button className="bk-nav-btn" aria-label="Keyingi kun" onClick={() => shiftDate(1)}>
          <IChevronRight />
        </button>

        <div className="bk-date-stats">
          <span className="bk-chip bk-chip-total">
            {bookings.length} {topCopy.bookings.chips.total}
          </span>
          <span className="bk-chip bk-chip-done">
            {doneCount} {topCopy.bookings.chips.done}
          </span>
          <span className="bk-chip bk-chip-pending">
            {pendingCount} {topCopy.bookings.chips.pending}
          </span>
        </div>
      </div>

      <div className="ftabs">
        {(["all", "completed", "pending", "cancelled"] as const).map((item) => (
          <button
            key={item}
            className={`ftab ${filter === item ? "ft-active" : ""}`}
            onClick={() => setFilter(item)}
          >
            {bookingFilterLabels[item]}
            <span className="fc">
              {item === "all"
                ? bookings.length
                : bookings.filter((booking) => booking.status === item).length}
            </span>
          </button>
        ))}

        <button className="filter-btn">
          <IFilter /> Saralash
        </button>
      </div>

      <div className="glass-card table-card">
        <BookingsTable rows={filteredBookings} barbers={barbers} />
      </div>
    </>
  );
}
