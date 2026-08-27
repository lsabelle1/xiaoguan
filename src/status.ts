import type { OrderStatus } from "../shared/types";

export const STATUS_STEPS: OrderStatus[] = [
  "queued",
  "accepted",
  "cooking",
  "ready",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  queued: "排队中",
  accepted: "已接单",
  cooking: "在做了",
  ready: "可以开吃了",
};

export const NEXT_ACTION: Record<OrderStatus, string | null> = {
  queued: "已接单",
  accepted: "在做了",
  cooking: "可以开吃了",
  ready: null,
};

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_STEPS.indexOf(status);
  if (index < 0 || index >= STATUS_STEPS.length - 1) return null;
  return STATUS_STEPS[index + 1];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function heartsOf(items: { hearts: number; quantity: number }[]) {
  return items.reduce((sum, item) => sum + item.hearts * item.quantity, 0);
}

export function countOf(items: { quantity: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
