/**
 * useRealtimeChannel
 *
 * Subscribes to /ws/events/{channel} and calls onEvent for every
 * matching event from the server.
 *
 * Usage:
 *   useRealtimeChannel("bookings", token, (event, data) => { ... });
 *   useRealtimeChannel(`barber:${barberId}`, token, handler);
 */
import { useCallback } from "react";
import { useWebSocket, WsStatus } from "./useWebSocket";

export interface RealtimeEvent {
  event_id: string;
  event: string;
  channel: string;
  timestamp: string;
  sent_at_ms: number;
  data: Record<string, unknown>;
}

export type RealtimeEventHandler = (event: string, data: Record<string, unknown>, full: RealtimeEvent) => void;

export function useRealtimeChannel(
  channel: string,
  token: string | null | undefined,
  onEvent: RealtimeEventHandler,
  enabled = true,
): WsStatus {
  const onMessage = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const ev = payload as RealtimeEvent;
      if (typeof ev.event !== "string") return;
      onEvent(ev.event, ev.data ?? {}, ev);
    },
    [onEvent],
  );

  return useWebSocket(`/ws/events/${encodeURIComponent(channel)}`, {
    token,
    enabled: enabled && !!channel,
    onMessage,
  });
}
