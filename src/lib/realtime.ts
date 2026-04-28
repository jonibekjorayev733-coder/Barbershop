import { API_BASE_URL } from "../features/admin-panel/api";

export interface RealtimeEventPayload<T = Record<string, unknown>> {
  event_id?: string;
  event: string;
  channel: string;
  timestamp: string;
  sent_at_ms?: number;
  source_instance?: string;
  data: T;
}

const SESSION_STORAGE_KEY = "sharpcuts_session";
const RECENT_EVENT_LIMIT = 300;

function getAccessTokenFromSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { accessToken?: string };
    if (typeof parsed?.accessToken === "string" && parsed.accessToken.trim()) {
      return parsed.accessToken;
    }
  } catch {
    return null;
  }

  return null;
}

function getRealtimeBaseUrl(): string {
  const apiUrl = new URL(API_BASE_URL);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return apiUrl.toString().replace(/\/$/, "");
}

export function subscribeRealtimeChannel(
  channel: string,
  onEvent: (payload: RealtimeEventPayload) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const accessToken = getAccessTokenFromSession();
  const wsUrl = `${getRealtimeBaseUrl()}/ws/events/${encodeURIComponent(channel)}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ""}`;
  let socket: WebSocket | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let manuallyClosed = false;
  const recentEventIds: string[] = [];
  const seenEventIds = new Set<string>();

  const rememberEvent = (eventId: string) => {
    if (seenEventIds.has(eventId)) {
      return false;
    }

    seenEventIds.add(eventId);
    recentEventIds.push(eventId);

    if (recentEventIds.length > RECENT_EVENT_LIMIT) {
      const dropped = recentEventIds.shift();
      if (dropped) {
        seenEventIds.delete(dropped);
      }
    }

    return true;
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    clearReconnect();
    const nextSocket = new WebSocket(wsUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      reconnectAttempts = 0;
      clearHeartbeat();
      heartbeatTimer = window.setInterval(() => {
        if (nextSocket.readyState === WebSocket.OPEN) {
          nextSocket.send("ping");
        }
      }, 25000);
    };

    nextSocket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RealtimeEventPayload;
        if (parsed?.event && parsed?.channel) {
          if (typeof parsed.event_id === "string" && parsed.event_id) {
            const accepted = rememberEvent(parsed.event_id);
            if (!accepted) {
              return;
            }
          }
          onEvent(parsed);
        }
      } catch {
        return;
      }
    };

    nextSocket.onclose = () => {
      clearHeartbeat();
      if (manuallyClosed) {
        return;
      }

      reconnectAttempts += 1;
      const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
      const jitter = randomInt(0, 600);
      const retryDelay = baseDelay + jitter;
      reconnectTimer = window.setTimeout(() => {
        connect();
      }, retryDelay);
    };

    nextSocket.onerror = () => {
      if (nextSocket.readyState === WebSocket.OPEN || nextSocket.readyState === WebSocket.CONNECTING) {
        nextSocket.close();
      }
    };
  };

  connect();

  return () => {
    manuallyClosed = true;
    clearHeartbeat();
    clearReconnect();
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
