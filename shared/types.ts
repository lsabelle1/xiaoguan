export interface Dish {
  id: string;
  name: string;
  desc: string;
  hearts: number;
  emoji: string;
  color: string;
  recommend?: boolean;
}

export interface Category {
  id: string;
  name: string;
  items: Dish[];
}

export interface MenuFile {
  categories: Category[];
}

export interface SiteConfig {
  name: string;
  welcome: string;
  tagline: string;
}

export type OrderStatus = "queued" | "accepted" | "cooking" | "ready";

export type Role = "guest" | "chef";

export interface OrderLine {
  dishId: string;
  name: string;
  emoji: string;
  hearts: number;
  quantity: number;
  note: string;
}

export interface Order {
  id: string;
  items: OrderLine[];
  note: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
