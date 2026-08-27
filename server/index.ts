import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import type {
  MenuFile,
  Order,
  OrderLine,
  OrderStatus,
  SiteConfig,
} from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const distDir = path.join(rootDir, "dist");
const isProd = process.argv.includes("--prod");
const PORT = Number(process.env.PORT) || 3001;
const COUPLE_CODE = (process.env.COUPLE_CODE || "xiaoguan").trim();

const STATUSES: OrderStatus[] = ["queued", "accepted", "cooking", "ready"];

const sessions = new Set<string>();
const sockets = new Set<WebSocket>();

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function loadConfig(): SiteConfig {
  return readJson<SiteConfig>(path.join(dataDir, "config.json"));
}

function loadMenu(): MenuFile {
  return readJson<MenuFile>(path.join(dataDir, "menu.json"));
}

function ordersPath() {
  return path.join(dataDir, "orders.json");
}

function loadOrders(): Order[] {
  const file = ordersPath();
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(ordersPath(), JSON.stringify(orders, null, 2), "utf8");
}

function dishIndex(menu: MenuFile) {
  const map = new Map<string, MenuFile["categories"][number]["items"][number]>();
  for (const category of menu.categories) {
    for (const dish of category.items) map.set(dish.id, dish);
  }
  return map;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: "请先输入口令进店" });
    return;
  }
  next();
}

function tokenFromUrl(requestUrl: string | undefined) {
  try {
    const url = new URL(requestUrl ?? "", "http://localhost");
    return url.searchParams.get("token") ?? "";
  } catch {
    return "";
  }
}

function broadcastOrders(orders: Order[]) {
  const payload = JSON.stringify({ type: "orders", orders });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/info", (_req, res) => {
  res.json(loadConfig());
});

app.post("/api/login", (req, res) => {
  const code = String(req.body?.code ?? "").trim();
  if (!code || code !== COUPLE_CODE) {
    res.status(401).json({ error: "口令不对，再问问店长" });
    return;
  }
  const token = randomUUID();
  sessions.add(token);
  res.json({ token, config: loadConfig() });
});

app.get("/api/config", requireAuth, (_req, res) => {
  res.json(loadConfig());
});

app.get("/api/menu", requireAuth, (_req, res) => {
  res.json(loadMenu());
});

app.get("/api/orders", requireAuth, (_req, res) => {
  res.json(loadOrders());
});

app.post("/api/orders", requireAuth, (req, res) => {
  const menu = loadMenu();
  const dishes = dishIndex(menu);
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const note = String(req.body?.note ?? "").trim().slice(0, 200);

  const items: OrderLine[] = [];
  for (const raw of rawItems) {
    const dish = dishes.get(String(raw?.dishId ?? ""));
    const quantity = Number(raw?.quantity);
    if (!dish || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      res.status(400).json({ error: "菜品或份数不对，重新选一下" });
      return;
    }
    items.push({
      dishId: dish.id,
      name: dish.name,
      emoji: dish.emoji,
      hearts: dish.hearts,
      quantity,
      note: String(raw?.note ?? "").trim().slice(0, 80),
    });
  }

  if (items.length === 0) {
    res.status(400).json({ error: "还没点菜呢" });
    return;
  }

  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    items,
    note,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  const orders = [order, ...loadOrders()];
  saveOrders(orders);
  broadcastOrders(orders);
  res.status(201).json(order);
});

app.patch("/api/orders/:id", requireAuth, (req, res) => {
  const status = req.body?.status as OrderStatus;
  if (!STATUSES.includes(status)) {
    res.status(400).json({ error: "状态不对" });
    return;
  }
  const orders = loadOrders();
  const index = orders.findIndex((order) => order.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "找不到这张单" });
    return;
  }
  orders[index] = {
    ...orders[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  saveOrders(orders);
  broadcastOrders(orders);
  res.json(orders[index]);
});

if (isProd) {
  if (!existsSync(distDir)) {
    console.error("缺少 dist，请先运行 npm run build");
    process.exit(1);
  }
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket) => {
  sockets.add(socket);
  socket.send(JSON.stringify({ type: "orders", orders: loadOrders() }));
  socket.on("close", () => sockets.delete(socket));
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "", "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const token = tokenFromUrl(request.url);
  if (!token || !sessions.has(token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    isProd
      ? `小馆已开门 http://localhost:${PORT}`
      : `后厨接口 http://localhost:${PORT}  （前端请走 Vite :5173）`,
  );
});
