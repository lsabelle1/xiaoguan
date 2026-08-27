import { useEffect, useMemo, useRef, useState } from "react";
import type { Dish, MenuFile, SiteConfig } from "../../shared/types";
import { ApiError, api } from "../api";
import { OrderTicket } from "../components/OrderTicket";
import { countOf, heartsOf } from "../status";
import { useOrders } from "../useOrders";

type CartItem = Dish & { quantity: number; note: string };

type Props = {
  config: SiteConfig | null;
  onSwitchRole: () => void;
  onLeave: () => void;
  onUnauthorized: () => void;
};

export function GuestPage({ config, onSwitchRole, onLeave, onUnauthorized }: Props) {
  const [menu, setMenu] = useState<MenuFile | null>(null);
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [openCart, setOpenCart] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [activeCat, setActiveCat] = useState("recommend");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const { orders, connected, authLost } = useOrders(true);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (authLost) onUnauthorized();
  }, [authLost, onUnauthorized]);

  useEffect(() => {
    void api
      .menu()
      .then(setMenu)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.unauthorized) onUnauthorized();
      });
  }, [onUnauthorized]);

  const recommended = useMemo(
    () => menu?.categories.flatMap((cat) => cat.items.filter((dish) => dish.recommend)) ?? [],
    [menu],
  );

  const sections = useMemo(() => {
    if (!menu) return [];
    return [
      { id: "recommend", name: "今日推荐", items: recommended },
      ...menu.categories,
    ];
  }, [menu, recommended]);

  function catchAuth(err: unknown) {
    if (err instanceof ApiError && err.unauthorized) onUnauthorized();
    return err;
  }

  function addDish(dish: Dish) {
    setCart((current) => {
      const found = current.find((item) => item.id === dish.id);
      if (found) {
        return current.map((item) =>
          item.id === dish.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item,
        );
      }
      return [...current, { ...dish, quantity: 1, note: "" }];
    });
  }

  function setQty(id: string, quantity: number) {
    setCart((current) => {
      if (quantity < 1) return current.filter((item) => item.id !== id);
      return current.map((item) => (item.id === id ? { ...item, quantity } : item));
    });
  }

  function setItemNote(id: string, note: string) {
    setCart((current) =>
      current.map((item) => (item.id === id ? { ...item, note } : item)),
    );
  }

  function qtyOf(id: string) {
    return cart.find((item) => item.id === id)?.quantity ?? 0;
  }

  function scrollTo(id: string) {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    setPlaceError("");
    try {
      await api.placeOrder({
        items: cart.map((item) => ({
          dishId: item.id,
          quantity: item.quantity,
          note: item.note,
        })),
        note: orderNote,
      });
      setCart([]);
      setOrderNote("");
      setOpenCart(false);
      setTab("orders");
    } catch (err) {
      catchAuth(err);
      setPlaceError(err instanceof Error ? err.message : "下单失败");
    } finally {
      setPlacing(false);
    }
  }

  const cartCount = countOf(cart);
  const cartHearts = heartsOf(cart);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>{config?.name ?? "两个人的小馆"}</h1>
          <div className={`live${connected ? " on" : ""}`}>
            <i />
            {connected ? "后厨在线" : "正在连后厨…"}
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={onSwitchRole}>
            去后厨
          </button>
          <button className="linkish" onClick={onLeave}>
            离店
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "menu" ? "active" : ""} onClick={() => setTab("menu")}>
          菜单
        </button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          订单{orders.length ? ` ${orders.length}` : ""}
        </button>
      </nav>

      {tab === "menu" ? (
        <>
          <div className="cats">
            {sections.map((section) => (
              <button
                key={section.id}
                className={activeCat === section.id ? "active" : ""}
                onClick={() => scrollTo(section.id)}
              >
                {section.name}
              </button>
            ))}
          </div>
          <div className="menu">
            {!menu ? <p className="empty">菜单准备中…</p> : null}
            {sections.map((section) => (
              <section
                key={section.id}
                ref={(node) => {
                  sectionRefs.current[section.id] = node;
                }}
              >
                <h2 className="section-title">
                  {section.name}
                  {section.id === "recommend" ? <em>厨师今天想做的</em> : null}
                </h2>
                {section.items.map((dish) => (
                  <article className="dish" key={`${section.id}-${dish.id}`}>
                    <div className="dish-art" style={{ background: dish.color }}>
                      {dish.emoji}
                    </div>
                    <div>
                      <h3>
                        {dish.name}
                        {dish.recommend ? <span className="badge">荐</span> : null}
                      </h3>
                      <p>{dish.desc}</p>
                      <div className="hearts">♥ {dish.hearts}</div>
                    </div>
                    <div className="qty-chip">
                      <button className="add" onClick={() => addDish(dish)} aria-label={`添加${dish.name}`}>
                        +
                      </button>
                      {qtyOf(dish.id) ? <b>{qtyOf(dish.id)}</b> : null}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="orders">
          {orders.length === 0 ? (
            <p className="empty">还没有订单。去菜单里点几道，厨师就开工。</p>
          ) : (
            orders.map((order) => <OrderTicket key={order.id} order={order} />)
          )}
        </div>
      )}

      {tab === "menu" && cartCount > 0 ? (
        <div className="cart-bar">
          <span>
            已选 {cartCount} 道 · ♥ {cartHearts}
          </span>
          <button onClick={() => setOpenCart(true)}>去下单</button>
        </div>
      ) : null}

      {openCart ? (
        <>
          <div className="sheet-mask" onClick={() => setOpenCart(false)} />
          <div className="sheet" role="dialog" aria-label="购物车">
            <h2>这一桌</h2>
            {cart.map((item) => (
              <div className="cart-line" key={item.id}>
                <div>
                  <strong>
                    {item.emoji} {item.name}
                  </strong>
                  <div className="hearts">♥ {item.hearts * item.quantity}</div>
                  <input
                    className="note-input"
                    placeholder="这道菜的备注，比如少辣"
                    value={item.note}
                    onChange={(event) => setItemNote(item.id, event.target.value)}
                  />
                </div>
                <div className="stepper">
                  <button onClick={() => setQty(item.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => setQty(item.id, item.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
            <label className="sr-only" htmlFor="order-note">
              想对厨师说的话
            </label>
            <textarea
              id="order-note"
              className="note-area"
              placeholder="想对厨师说的话：多加点米饭、今晚想喝热的…"
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
            />
            {placeError ? <p className="error">{placeError}</p> : null}
            <button className="primary" disabled={placing || cart.length === 0} onClick={() => void placeOrder()}>
              {placing ? "下单中…" : `提交订单 · ♥ ${cartHearts}`}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
