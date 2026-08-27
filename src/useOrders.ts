import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "../shared/types";
import { ApiError, api, getToken, wsUrl } from "./api";

export function useOrders(enabled: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    try {
      const list = await api.orders();
      setOrders(list);
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) setAuthLost(true);
    }
  }, []);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer = 0;

    const connect = () => {
      if (cancelled) return;
      socket = new WebSocket(wsUrl(token));
      socket.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        retry = 0;
        void refreshRef.current();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            orders?: Order[];
          };
          if (message.type === "orders" && Array.isArray(message.orders)) {
            setOrders(message.orders);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        retry += 1;
        const wait = Math.min(1000 * 2 ** retry, 8000);
        timer = window.setTimeout(connect, wait);
      };
    };

    void refresh();
    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, [enabled, refresh]);

  return { orders, connected, authLost, refresh };
}
