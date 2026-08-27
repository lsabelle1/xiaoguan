import { useEffect, useRef, useState } from "react";
import type { SiteConfig } from "../../shared/types";
import { ApiError, api } from "../api";
import { OrderTicket } from "../components/OrderTicket";
import { NEXT_ACTION, nextStatus } from "../status";
import { useOrders } from "../useOrders";

type Props = {
  config: SiteConfig | null;
  onSwitchRole: () => void;
  onLeave: () => void;
  onUnauthorized: () => void;
};

export function ChefPage({ config, onSwitchRole, onLeave, onUnauthorized }: Props) {
  const { orders, connected, authLost } = useOrders(true);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLost) onUnauthorized();
  }, [authLost, onUnauthorized]);

  useEffect(() => {
    if (!primed.current) {
      if (!connected) return;
      for (const order of orders) seen.current.add(order.id);
      primed.current = true;
      return;
    }
    const newcomers = orders.filter((order) => !seen.current.has(order.id));
    if (newcomers.length === 0) return;
    for (const order of newcomers) seen.current.add(order.id);
    setFresh(new Set(newcomers.map((order) => order.id)));
    setBanner(true);
    const timer = window.setTimeout(() => {
      setBanner(false);
      setFresh(new Set());
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [orders, connected]);

  async function advance(id: string, status: ReturnType<typeof nextStatus>) {
    if (!status) return;
    setBusyId(id);
    try {
      await api.updateStatus(id, status);
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) onUnauthorized();
    } finally {
      setBusyId(null);
    }
  }

  const active = orders.filter((order) => order.status !== "ready");
  const done = orders.filter((order) => order.status === "ready");

  return (
    <div className="app-shell wide">
      <header className="topbar">
        <div>
          <h1>{config?.name ?? "两个人的小馆"} · 后厨</h1>
          <div className={`live${connected ? " on" : ""}`}>
            <i />
            {connected ? "实时接单中" : "正在重连…"}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={onSwitchRole}>
            去点菜
          </button>
          <button className="linkish" onClick={onLeave}>
            离店
          </button>
        </div>
      </header>
      {banner ? <div className="banner">新订单来了，厨房开工。</div> : null}
      <div className="kitchen">
        {orders.length === 0 ? (
          <p className="empty">还没有人点菜。把网址发给她，你在这边等单就好。</p>
        ) : null}
        {active.map((order) => (
          <OrderTicket
            key={order.id}
            order={order}
            fresh={fresh.has(order.id)}
            actionLabel={NEXT_ACTION[order.status]}
            busy={busyId === order.id}
            onAction={() => void advance(order.id, nextStatus(order.status))}
          />
        ))}
        {done.map((order) => (
          <OrderTicket key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
