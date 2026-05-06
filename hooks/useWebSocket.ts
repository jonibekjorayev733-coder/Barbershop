/**
 * useWebSocket — reconnecting WebSocket hook
 *
 * Manages connection lifecycle, automatic exponential-backoff reconnection,
 * ping/pong keep-alive, and cleanup on unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { API_BASE_URL } from "@/services/api";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export interface UseWebSocketOptions {
  /** Called for every incoming JSON message */
  onMessage: (payload: unknown) => void;
  /** Optional raw-text handler (e.g. "pong") */
  onText?: (text: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Bearer token — if falsy the socket will not connect */
  token: string | null | undefined;
  /** Skip connecting (e.g. user logged out) */
  enabled?: boolean;
  /** Interval in ms to send a "ping" text frame (default 20 000 ms) */
  pingIntervalMs?: number;
  /** Max reconnect delay in ms (default 30 000) */
  maxReconnectDelayMs?: number;
}

/** Convert http(s):// to ws(s):// */
function toWsBase(url: string): string {
  return url.replace(/^http/, "ws");
}

const WS_BASE = toWsBase(API_BASE_URL);

export function buildWsUrl(path: string, token: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${WS_BASE}${path}${sep}token=${encodeURIComponent(token)}`;
}

export function useWebSocket(path: string, options: UseWebSocketOptions): WsStatus {
  const {
    onMessage,
    onText,
    onOpen,
    onClose,
    token,
    enabled = true,
    pingIntervalMs = 20_000,
    maxReconnectDelayMs = 30_000,
  } = options;

  const [status, setStatus] = useState<WsStatus>("closed");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const mountedRef = useRef(true);
  const pathRef = useRef(path);
  const onMessageRef = useRef(onMessage);
  const onTextRef = useRef(onText);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const tokenRef = useRef(token);

  // Keep refs up to date without triggering reconnect
  useEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const clearPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    clearPing();
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000);
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, [clearPing]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (!tokenRef.current) return;

    clearReconnect();
    closeWs();

    const url = buildWsUrl(pathRef.current, tokenRef.current);
    if (mountedRef.current) setStatus("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      if (mountedRef.current) setStatus("error");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectDelayRef.current = 1_000;
      setStatus("open");
      onOpenRef.current?.();

      // start ping keep-alive
      clearPing();
      pingTimerRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send("ping"); } catch { /* ignore */ }
        }
      }, pingIntervalMs);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      const raw = event.data as string;
      if (typeof raw === "string" && raw !== "pong") {
        try {
          const parsed = JSON.parse(raw);
          onMessageRef.current(parsed);
        } catch {
          onTextRef.current?.(raw);
        }
      } else if (typeof raw === "string") {
        onTextRef.current?.(raw);
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) setStatus("error");
    };

    ws.onclose = () => {
      clearPing();
      if (!mountedRef.current) return;
      setStatus("closed");
      onCloseRef.current?.();

      // exponential backoff reconnect
      if (enabled && tokenRef.current) {
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, maxReconnectDelayMs);
        reconnectTimerRef.current = setTimeout(() => connect(), delay);
      }
    };
  }, [clearPing, clearReconnect, closeWs, enabled, maxReconnectDelayMs, pingIntervalMs]);

  // Connect / disconnect based on enabled + token
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && token) {
      connect();
    } else {
      closeWs();
      clearReconnect();
      setStatus("closed");
    }

    return () => {
      mountedRef.current = false;
      clearPing();
      clearReconnect();
      closeWs();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token]);

  // Reconnect when app comes to foreground (native only)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && enabled && tokenRef.current) {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          reconnectDelayRef.current = 1_000;
          connect();
        }
      }
    });
    return () => sub.remove();
  }, [connect, enabled]);

  return status;
}
