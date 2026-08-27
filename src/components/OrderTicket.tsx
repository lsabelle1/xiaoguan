import type { Order } from "../../shared/types";
import { countOf, formatTime, heartsOf, STATUS_LABEL, STATUS_STEPS } from "../status";

type Props = {
  order: Order;
  fresh?: boolean;
  actionLabel?: string | null;
  onAction?: () => void;
  busy?: boolean;
};

export function OrderTicket({ order, fresh, actionLabel, onAction, busy }: Props) {
  const done = order.status === "ready";
  const reached = STATUS_STEPS.indexOf(order.status);

  return (
    <article className={`ticket${fresh ? " fresh" : ""}${done ? " done" : ""}`}>
      <div className="ticket-head">
        <strong>{STATUS_LABEL[order.status]}</strong>
        <span className="muted">{formatTime(order.createdAt)}</span>
      </div>
      <ul>
        {order.items.map((item) => (
          <li key={item.dishId}>
            <span>
              {item.emoji} {item.name} × {item.quantity}
              {item.note ? <div className="line-note">备注：{item.note}</div> : null}
            </span>
            <span className="hearts">♥ {item.hearts * item.quantity}</span>
          </li>
        ))}
      </ul>
      {order.note ? <p className="order-note">想对厨师说：{order.note}</p> : null}
      <div className="stepper-status" aria-label="后厨进度">
        {STATUS_STEPS.map((step, index) => (
          <span key={step} className={index <= reached ? "on" : ""}>
            {STATUS_LABEL[step]}
          </span>
        ))}
      </div>
      <p className="muted">
        {countOf(order.items)} 道 · ♥ {heartsOf(order.items)}
      </p>
      {actionLabel && onAction ? (
        <button className="primary" style={{ marginTop: 12 }} onClick={onAction} disabled={busy}>
          {busy ? "更新中…" : actionLabel}
        </button>
      ) : null}
    </article>
  );
}
