import type { MenuFile, Order, OrderStatus, Role, SiteConfig } from "../shared/types";

const TOKEN_KEY = "xiaoguan-token";
const ROLE_KEY = "xiaoguan-role";

export class ApiError extends Error {
  unauthorized: boolean;
  constructor(message: string, unauthorized = false) {
    super(message);
    this.unauthorized = unauthorized;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): Role | null {
  const role = localStorage.getItem(ROLE_KEY);
  return role === "guest" || role === "chef" ? role : null;
}

export function setSession(token: string, role: Role) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const data: unknown = await response.json().catch(() => ({}));
  const message =
    typeof data === "object" && data && "error" in data
      ? String((data as { error: string }).error)
      : "请求失败";
  if (response.status === 401) {
    clearSession();
    throw new ApiError(message, true);
  }
  if (!response.ok) throw new ApiError(message);
  return data as T;
}

export const api = {
  info: () => request<SiteConfig>("/api/info"),
  login: (code: string) =>
    request<{ token: string; config: SiteConfig }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  menu: () => request<MenuFile>("/api/menu"),
  orders: () => request<Order[]>("/api/orders"),
  placeOrder: (body: {
    items: { dishId: string; quantity: number; note: string }[];
    note: string;
  }) =>
    request<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStatus: (id: string, status: OrderStatus) =>
    request<Order>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

export function wsUrl(token: string) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) {
    return `ws://${location.hostname}:3001/ws?token=${encodeURIComponent(token)}`;
  }
  return `${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`;
}
