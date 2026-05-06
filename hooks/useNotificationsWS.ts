/**
 * useNotificationsWS
 *
 * Personal notification stream via /ws/notifications/{user_id}.
 * Calls onNotification for each incoming message.
 *
 * The backend broadcasts a notification payload (same shape as
 * UserNotificationApi) when a booking-related event occurs for this user.
 */
import { useCallback } from "react";
import { useWebSocket, WsStatus } from "./useWebSocket";

export interface WsNotificationPayload {
  id: number;
  type: string;
  title: string;
  message: string;
  barber_id?: number | null;
  appointment_id?: number | null;
  sms_sent?: boolean;
  voice_sent?: boolean;
  is_read?: boolean;
  created_at?: string | null;
}

export function useNotificationsWS(
  userId: number | null | undefined,
  token: string | null | undefined,
  onNotification: (notification: WsNotificationPayload) => void,
  enabled = true,
): WsStatus {
  const onMessage = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const notif = payload as WsNotificationPayload;
      if (typeof notif.id !== "number") return;
      onNotification(notif);
    },
    [onNotification],
  );

  return useWebSocket(userId ? `/ws/notifications/${userId}` : "", {
    token,
    enabled: enabled && !!userId && !!token,
    onMessage,
  });
}
