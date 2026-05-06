import { useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotificationsWS, type WsNotificationPayload } from "@/hooks/useNotificationsWS";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { showLocalNotification } from "@/services/NotificationService";

function getRealtimeNotificationCopy(event: string, data: Record<string, unknown>, role: string) {
  const clientName = String(data.client_name ?? data.client ?? "Mijoz");
  const barberName = String(data.barber_name ?? data.barber ?? "Sartarosh");
  const date = String(data.appointment_date ?? data.date ?? "").trim();
  const time = String(data.appointment_time ?? data.time ?? "").trim();
  const when = [date, time].filter(Boolean).join(" ");

  if (role === "admin") {
    if (event.includes("created")) {
      return {
        title: "📲 Yangi bron",
        body: `${clientName} ${when || "yangi vaqt"} uchun bron qoldirdi`,
        type: "admin_booking_created",
      };
    }

    if (event.includes("accepted")) {
      return {
        title: "✅ Bron tasdiqlandi",
        body: `${barberName} ${clientName} bronini tasdiqladi`,
        type: "admin_booking_accepted",
      };
    }

    if (event.includes("rated")) {
      return {
        title: "⭐ Yangi baholash",
        body: `${barberName} uchun yangi baho kelib tushdi`,
        type: "admin_booking_rated",
      };
    }

    if (event.includes("completed")) {
      return {
        title: "✅ Bron yakunlandi",
        body: `${barberName} ${clientName} xizmatini yakunladi`,
        type: "admin_booking_completed",
      };
    }

    return {
      title: "📡 Admin yangilanishi",
      body: `${clientName} bo‘yicha yangi holat keldi`,
      type: "admin_realtime",
    };
  }

  if (event.includes("created")) {
    return {
      title: "💈 Yangi bron",
      body: `${clientName} ${when || "yaqin vaqt"} uchun sizga yozildi`,
      type: "barber_booking_created",
    };
  }

  if (event.includes("accepted")) {
    return {
      title: "✅ Bron tasdiqlandi",
      body: `${clientName} broni tasdiqlandi`,
      type: "barber_booking_accepted",
    };
  }

  if (event.includes("rated")) {
    return {
      title: "⭐ Sizni baholashdi",
      body: `${clientName} sizga baho qoldirdi`,
      type: "barber_booking_rated",
    };
  }

  if (event.includes("discount")) {
    return {
      title: "🏷️ Skidka yangilandi",
      body: "Skidka qiymati muvaffaqiyatli yangilandi",
      type: "barber_discount_updated",
    };
  }

  if (event.includes("updated") || event.includes("completed")) {
    return {
      title: "🔔 Bron holati o‘zgardi",
      body: `${clientName} broni bo‘yicha yangi status keldi`,
      type: "barber_realtime",
    };
  }

  return {
    title: "📩 Yangi xabar",
    body: `${clientName} bo‘yicha yangilanish bor`,
    type: "barber_realtime",
  };
}

export default function RealtimeNotificationBridge() {
  const { session } = useAuth();
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const seenRealtimeIdsRef = useRef<Set<string>>(new Set());

  const handleUserNotification = useCallback((notification: WsNotificationPayload) => {
    if (seenNotificationIdsRef.current.has(notification.id)) {
      return;
    }

    seenNotificationIdsRef.current.add(notification.id);
    void showLocalNotification(
      notification.title || "📩 Yangi bildirishnoma",
      notification.message || "Sizga yangi xabar keldi",
      notification.type || "user_notification",
    );
  }, []);

  const handleAdminEvent = useCallback((event: string, data: Record<string, unknown>, full: { event_id: string }) => {
    if (!full?.event_id || seenRealtimeIdsRef.current.has(full.event_id)) {
      return;
    }

    seenRealtimeIdsRef.current.add(full.event_id);
    const next = getRealtimeNotificationCopy(event, data, "admin");
    void showLocalNotification(next.title, next.body, next.type);
  }, []);

  const handleBarberEvent = useCallback((event: string, data: Record<string, unknown>, full: { event_id: string }) => {
    if (!full?.event_id || seenRealtimeIdsRef.current.has(full.event_id)) {
      return;
    }

    seenRealtimeIdsRef.current.add(full.event_id);
    const next = getRealtimeNotificationCopy(event, data, "barber");
    void showLocalNotification(next.title, next.body, next.type);
  }, []);

  const handleUserBookingEvent = useCallback((event: string, data: Record<string, unknown>, full: { event_id: string }) => {
    if (!full?.event_id || seenRealtimeIdsRef.current.has(full.event_id)) {
      return;
    }

    const role = (session?.role || "").toLowerCase();
    if (!(role === "student" || role === "user")) {
      return;
    }

    const userId = Number(session?.user_id || 0);
    const payloadUserId = Number(data.student_id ?? data.user_id ?? 0);
    if (!userId || !payloadUserId || userId !== payloadUserId) {
      return;
    }

    const watched = ["booking.accepted", "booking.completed", "booking.cancelled", "booking.rated"];
    if (!watched.includes(event)) {
      return;
    }

    seenRealtimeIdsRef.current.add(full.event_id);

    const barberName = String(data.barber_name ?? data.barber ?? "Sartarosh");
    const date = String(data.appointment_date ?? data.date ?? "").trim();
    const time = String(data.appointment_time ?? data.time ?? "").trim();
    const when = [date, time].filter(Boolean).join(" ");

    if (event === "booking.accepted") {
      void showLocalNotification(
        "✅ Bron tasdiqlandi",
        `${barberName} sizning broningizni tasdiqladi${when ? ` · ${when}` : ""}`,
        "booking_accepted",
      );
      return;
    }

    if (event === "booking.completed") {
      void showLocalNotification(
        "🏁 Xizmat yakunlandi",
        `${barberName} xizmatni yakunladi${when ? ` · ${when}` : ""}`,
        "booking_completed",
      );
      return;
    }

    if (event === "booking.cancelled") {
      void showLocalNotification(
        "❌ Bron bekor qilindi",
        `${barberName} bron holatini bekor qildi${when ? ` · ${when}` : ""}`,
        "booking_cancelled",
      );
      return;
    }

    void showLocalNotification(
      "⭐ Baholash yangilandi",
      `${barberName} bo‘yicha bron holati yangilandi${when ? ` · ${when}` : ""}`,
      "booking_rated",
    );
  }, [session?.role, session?.user_id]);

  const role = session?.role || "";
  const token = session?.access_token ?? null;
  const userId = session?.user_id ?? null;

  useNotificationsWS(
    role === "student" || role === "user" ? userId : null,
    token,
    handleUserNotification,
    (role === "student" || role === "user") && !!token,
  );

  useRealtimeChannel(
    role === "admin" ? "bookings" : "",
    token,
    handleAdminEvent,
    role === "admin" && !!token,
  );

  useRealtimeChannel(
    role === "barber" && userId ? `barber:${userId}` : "",
    token,
    handleBarberEvent,
    role === "barber" && !!token && !!userId,
  );

  useRealtimeChannel(
    (role === "student" || role === "user") ? "bookings" : "",
    token,
    handleUserBookingEvent,
    (role === "student" || role === "user") && !!token,
  );

  return null;
}
