"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ShoppingBagOpen, X } from "@phosphor-icons/react";
import {
  DISCOUNT_RATE,
  PRODUCTS,
  money,
  quote,
  staffPrice,
  type CartLine,
  type OrderMode,
  type Product,
} from "@/lib/closet-data";
import { Garment } from "./garment";

const ALLOWANCE = 2000;
const START_BALANCE = 1450;
const CATEGORIES = ["All", ...Array.from(new Set(PRODUCTS.map((p) => p.category)))];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function subscribeViewport(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const viewportSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;
const viewportServerSnapshot = () => "1280x800";

export function Closet() {
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<OrderMode>("allowance");
  const [balance, setBalance] = useState(START_BALANCE);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const items = useMemo(() => (cat === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat)), [cat]);
  const count = items.length;

  // layout metrics, all derived from the viewport so the rail scales from phone to desktop
  const [vw, vh] = useSyncExternalStore(subscribeViewport, viewportSnapshot, viewportServerSnapshot)
    .split("x")
    .map(Number);
  const itemW = clamp(vw * 0.15, 104, 168);
  const itemH = itemW * 1.5;
  const spacing = itemW * 1.14;
  const railY = clamp(vh * 0.2, 96, 168);
  const DETAILS_H = 262;
  const focusScale = Math.max(1, Math.min(1.9, (vh - railY - DETAILS_H - 24) / itemH, (vw * 0.8) / itemW));

  // ---- physics: rail position eases toward a target, hangers swing like pendulums ----
  const trackRef = useRef<HTMLDivElement>(null);
  const phys = useRef({ pos: 0, target: 0, ang: 0, av: 0, raf: 0, dragging: false });
  const dims = useRef({ w: vw, spacing, count });
  const reduced = useRef(false);

  const kick = useCallback(() => {
    const p = phys.current;
    if (p.raf) return;
    const step = () => {
      const el = trackRef.current;
      const d = dims.current;
      const ease = reduced.current ? 1 : p.dragging ? 0.35 : 0.1;
      const next = p.pos + (p.target - p.pos) * ease;
      const v = next - p.pos;
      p.pos = next;
      if (reduced.current) {
        p.ang = 0;
        p.av = 0;
      } else {
        p.av += -0.06 * p.ang - 0.09 * p.av - v * 0.045;
        p.ang = clamp(p.ang + p.av, -16, 16);
      }
      if (el) {
        el.style.transform = `translate3d(${d.w / 2 - p.pos}px,0,0)`;
        el.style.setProperty("--sway", p.ang.toFixed(3));
      }
      const idle = Math.abs(p.target - p.pos) < 0.1 && Math.abs(p.ang) < 0.02 && Math.abs(p.av) < 0.002;
      if (idle) {
        p.pos = p.target;
        p.raf = 0;
      } else {
        p.raf = requestAnimationFrame(step);
      }
    };
    p.raf = requestAnimationFrame(step);
  }, []);

  const clampTarget = useCallback((t: number) => clamp(t, 0, (dims.current.count - 1) * dims.current.spacing), []);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const p = phys.current;
    return () => {
      cancelAnimationFrame(p.raf);
      p.raf = 0; // otherwise kick() thinks a frame is still pending after a Strict Mode remount
    };
  }, []);

  // open on the middle of the rail so both sides are full, like the reference
  useLayoutEffect(() => {
    const p = phys.current;
    p.pos = p.target = ((dims.current.count - 1) / 2) * dims.current.spacing;
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${dims.current.w / 2 - p.pos}px,0,0)`;
  }, []);

  // keep physics in step with layout changes and selection (re-centres the picked garment)
  useEffect(() => {
    const p = phys.current;
    dims.current = { w: vw, spacing, count };
    p.target = selected !== null ? selected * spacing : clamp(p.target, 0, (count - 1) * spacing);
    kick();
  }, [vw, spacing, count, selected, kick]);

  // ---- input: wheel / trackpad, drag, keyboard ----
  const wheelAcc = useRef(0);
  const lastNav = useRef(0);
  const suppressClick = useRef(false);
  const drag = useRef<{ x: number; t: number; moved: boolean; lastX: number; lastT: number; vx: number } | null>(null);
  const selectedRef = useRef(selected);
  const cartOpenRef = useRef(cartOpen);
  useEffect(() => {
    selectedRef.current = selected;
    cartOpenRef.current = cartOpen;
  }, [selected, cartOpen]);

  const go = useCallback((dir: 1 | -1) => {
    const now = performance.now();
    if (now - lastNav.current < 220) return;
    lastNav.current = now;
    setSelected((s) => (s === null ? s : clamp(s + dir, 0, dims.current.count - 1)));
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (selectedRef.current !== null) {
      wheelAcc.current += delta;
      if (Math.abs(wheelAcc.current) > 60) {
        go(wheelAcc.current > 0 ? 1 : -1);
        wheelAcc.current = 0;
      }
      return;
    }
    const p = phys.current;
    p.dragging = false;
    p.target = clampTarget(p.target + delta * 1.1);
    kick();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const now = performance.now();
    drag.current = { x: e.clientX, t: phys.current.target, moved: false, lastX: e.clientX, lastT: now, vx: 0 };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 6) d.moved = true;
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.vx = 0.8 * d.vx + 0.2 * ((e.clientX - d.lastX) / dt);
      d.lastX = e.clientX;
      d.lastT = now;
      if (d.moved && selectedRef.current === null) {
        const p = phys.current;
        p.dragging = true;
        p.target = clampTarget(d.t - dx);
        kick();
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const p = phys.current;
      p.dragging = false;
      if (d.moved) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        const dx = e.clientX - d.x;
        if (selectedRef.current !== null) {
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        } else {
          p.target = clampTarget(p.target - d.vx * 220);
          kick();
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [clampTarget, go, kick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cartOpenRef.current) setCartOpen(false);
        else setSelected(null);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (selectedRef.current !== null) go(dir);
        else {
          const p = phys.current;
          p.target = clampTarget(p.target + dir * dims.current.spacing);
          kick();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clampTarget, go, kick]);

  // ---- cart ----
  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }, []);

  const addToCart = (product: Product, size: string) => {
    setCart((c) => [...c, { id: `${product.sku}-${size}-${Date.now()}`, product, size }]);
    flash(`${product.name} · ${size} hung in your bag`);
  };

  const cartQuote = quote(cart, mode, balance);

  const placeOrder = () => {
    setBalance(cartQuote.balanceAfter);
    setCart([]);
    setCartOpen(false);
    setSelected(null);
    flash("Order placed (demo — nothing was saved)");
  };

  const pickCategory = (c: string) => {
    setCat(c);
    setSelected(null);
    const n = c === "All" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === c).length;
    phys.current.target = ((n - 1) / 2) * dims.current.spacing;
    kick();
  };

  const select = (i: number) => {
    if (suppressClick.current) return;
    setSelected(i);
  };

  const product = selected !== null ? items[selected] : null;

  return (
    <main
      className="relative h-svh w-full select-none overflow-clip bg-[#f3f2ee] text-[#1a1a1a]"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", overscrollBehavior: "none" }}
    >
      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-5 sm:px-8 sm:pt-6">
        <div className="pointer-events-auto w-28 sm:w-40">
          <p className="whitespace-nowrap text-[9px] uppercase tracking-[0.16em] text-[#8b8b86] sm:text-[10px]">Allowance left</p>
          <p className="mt-0.5 whitespace-nowrap text-xs font-medium tabular-nums sm:text-sm">
            {money(balance)} <span className="text-[#8b8b86]">/ {money(ALLOWANCE)}</span>
          </p>
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#7ee34b] transition-[width] duration-700"
              style={{ width: `${clamp((balance / ALLOWANCE) * 100, 0, 100)}%` }}
            />
          </div>
        </div>

        <span className="rounded-full bg-[#7ee34b] px-3.5 py-1 text-[15px] font-black lowercase tracking-tight text-[#10210a] shadow-[0_2px_0_rgba(0,0,0,0.12)]">
          fom
        </span>
        <nav className="pointer-events-auto absolute inset-x-0 top-[68px] flex justify-center gap-4 text-[11px] uppercase tracking-[0.16em]">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => pickCategory(c)}
                className={`pb-0.5 transition-colors ${
                  cat === c ? "border-b border-[#1a1a1a] text-[#1a1a1a]" : "text-[#8b8b86] hover:text-[#1a1a1a]"
                }`}
              >
                {c}
              </button>
            ))}
        </nav>

        <div className="pointer-events-auto flex w-28 justify-end sm:w-40">
          <button
            onClick={() => setCartOpen(true)}
            className="group relative flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-xs backdrop-blur transition hover:bg-white"
            aria-label={`Open bag, ${cart.length} items`}
          >
            <ShoppingBagOpen size={16} weight="regular" />
            <span className="tabular-nums">{cart.length}</span>
          </button>
        </div>
      </header>

      {/* stage: rail + hanging garments */}
      <div
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          if (e.target === e.currentTarget && !suppressClick.current) setSelected(null);
        }}
      >
        <div
          className="pointer-events-none absolute left-[4vw] right-[4vw] transition-opacity duration-500"
          style={{ top: railY - 1.5, opacity: product ? 0.45 : 1 }}
        >
          <div className="h-[3px] rounded-full bg-gradient-to-b from-[#d4d7da] via-[#f7f8f9] to-[#8d9399] shadow-[0_3px_5px_rgba(0,0,0,0.12)]" />
          <span className="absolute -left-1 -top-[3px] size-[9px] rounded-full bg-[#b9bdc2] shadow" />
          <span className="absolute -right-1 -top-[3px] size-[9px] rounded-full bg-[#b9bdc2] shadow" />
        </div>

        <div ref={trackRef} className="pointer-events-none absolute left-0 top-0 h-0 w-0 will-change-transform" style={{ transform: `translate3d(${vw / 2}px,0,0)` }}>
          {items.map((p, i) => {
            const isSel = selected === i;
            const dim = selected !== null && !isSel;
            return (
              <div
                key={p.sku}
                className="absolute"
                style={{ left: i * spacing - itemW / 2, top: railY - itemH * 0.04, width: itemW, height: itemH }}
              >
                <button
                  onClick={() => select(i)}
                  aria-label={p.name}
                  aria-pressed={isSel}
                  className="pointer-events-auto group block size-full origin-[50%_3%] cursor-pointer outline-none transition-[transform,filter,opacity] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:drop-shadow-[0_0_0_#7ee34b]"
                  style={{
                    transform: isSel ? `scale(${focusScale})` : dim ? "scale(0.86)" : "scale(1)",
                    filter: dim ? "blur(5px) saturate(0.7)" : "none",
                    opacity: dim ? 0.38 : 1,
                  }}
                >
                  <div
                    className="size-full origin-[50%_3%] transition-transform duration-300 group-hover:-translate-y-1"
                    style={{ rotate: `calc(var(--sway, 0) * ${0.85 + (i % 3) * 0.12} * 1deg)` }}
                  >
                    <Garment
                      product={p}
                      className="size-full drop-shadow-[0_14px_14px_rgba(0,0,0,0.13)]"
                    />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* idle hint */}
      <p
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-[11px] uppercase tracking-[0.18em] text-[#8b8b86] transition-opacity duration-500 ${
          product ? "opacity-0" : "opacity-100"
        }`}
        style={{ top: railY + itemH + 36 }}
      >
        Scroll or drag the rail · tap to pick
      </p>

      {/* selected product details */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex justify-center px-5 pb-8 transition-all duration-500 ${
          product ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        {product && (
          <Details
            key={product.sku}
            product={product}
            mode={mode}
            setMode={setMode}
            balance={balance}
            onAdd={addToCart}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* bag sheet */}
      <div
        className={`absolute inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setCartOpen(false)}
      />
      <aside
        aria-hidden={!cartOpen}
        className={`absolute inset-y-0 right-0 z-50 flex w-[min(92vw,380px)] flex-col bg-[#faf9f6] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-[11px] uppercase tracking-[0.18em]">Your bag</h2>
          <button onClick={() => setCartOpen(false)} aria-label="Close bag" className="rounded-full p-1.5 hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        <ul className="mt-5 flex-1 divide-y divide-black/8 overflow-y-auto px-6">
          {cart.length === 0 && <li className="py-10 text-center text-sm text-[#8b8b86]">Nothing hanging here yet.</li>}
          {cart.map((l) => (
            <li key={l.id} className="flex items-center gap-4 py-3">
              <Garment product={l.product} className="h-16 w-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.product.name}</p>
                <p className="text-xs text-[#8b8b86]">Size {l.size}</p>
              </div>
              <p className="text-sm tabular-nums">{money(mode === "discount" ? staffPrice(l.product.rsp) : l.product.rsp)}</p>
              <button
                onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))}
                aria-label={`Remove ${l.product.name}`}
                className="rounded-full p-1 text-[#8b8b86] hover:bg-black/5 hover:text-black"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-4 border-t border-black/8 px-6 py-5">
          <ModeToggle mode={mode} setMode={setMode} />
          <dl className="space-y-1.5 text-sm">
            <Row label="Retail total" value={money(cartQuote.totalRsp)} muted={mode === "discount"} />
            {mode === "discount" ? (
              <>
                <Row label={`Staff discount (${Math.round(DISCOUNT_RATE * 100)}%)`} value={`-${money(cartQuote.totalRsp * DISCOUNT_RATE)}`} />
                <Row label="You pay" value={money(cartQuote.payIn)} strong />
              </>
            ) : (
              <>
                <Row label="From allowance" value={`-${money(cartQuote.fromAllowance)}`} />
                {cartQuote.payIn > 0 && <Row label="Pay-in at full price" value={money(cartQuote.payIn)} strong />}
                <Row label="Allowance after" value={money(cartQuote.balanceAfter)} muted />
              </>
            )}
          </dl>
          {cartQuote.isSplit && (
            <p className="rounded-lg bg-[#7ee34b]/20 px-3 py-2 text-xs leading-snug text-[#2b4a1a]">
              Your allowance doesn’t cover everything, so this becomes a split order: allowance first, the remainder paid in.
            </p>
          )}
          <button
            disabled={cart.length === 0}
            onClick={placeOrder}
            className="w-full rounded-full bg-[#1a1a1a] py-3 text-xs uppercase tracking-[0.16em] text-white transition enabled:hover:bg-black disabled:opacity-30"
          >
            Place order
          </button>
        </div>
      </aside>

      {/* toast */}
      <div
        className={`pointer-events-none absolute left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full bg-[#1a1a1a] px-4 py-2 text-xs text-white shadow-lg transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
        role="status"
      >
        {toast}
      </div>

      {/* the lime ground strip from the reference */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2 bg-[#7ee34b]" />
    </main>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between tabular-nums ${muted ? "text-[#8b8b86]" : ""} ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: OrderMode; setMode: (m: OrderMode) => void }) {
  const opts: { id: OrderMode; label: string }[] = [
    { id: "allowance", label: "Allowance" },
    { id: "discount", label: `Staff discount ${Math.round(DISCOUNT_RATE * 100)}%` },
  ];
  return (
    <div role="radiogroup" aria-label="Order type" className="grid grid-cols-2 rounded-full bg-black/6 p-0.5 text-[11px] uppercase tracking-[0.1em]">
      {opts.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={mode === o.id}
          onClick={() => setMode(o.id)}
          className={`whitespace-nowrap rounded-full px-3 py-2 transition ${mode === o.id ? "bg-white shadow-sm" : "text-[#8b8b86] hover:text-black"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Details({
  product,
  mode,
  setMode,
  balance,
  onAdd,
  onClose,
}: {
  product: Product;
  mode: OrderMode;
  setMode: (m: OrderMode) => void;
  balance: number;
  onAdd: (p: Product, size: string) => void;
  onClose: () => void;
}) {
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const q = quote([{ id: "x", product, size: size ?? "" }], mode, balance);

  const sub =
    mode === "discount"
      ? `${Math.round(DISCOUNT_RATE * 100)}% staff discount · retail ${money(product.rsp)}`
      : q.payIn === 0
        ? `from your allowance · ${money(q.balanceAfter)} left after`
        : q.fromAllowance > 0
          ? `split: ${money(q.fromAllowance)} allowance + ${money(q.payIn)} pay-in`
          : "allowance is used up — this would be paid in";

  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b8b86]">{product.category} · {product.sku}</p>
      <h1 className="mt-1 text-[13px] font-semibold uppercase tracking-[0.18em]">{product.name}</h1>

      <p className="mt-2 text-3xl font-light tabular-nums tracking-tight">
        {money(mode === "discount" ? staffPrice(product.rsp) : product.rsp)}
        {mode === "discount" && <span className="ml-2 text-base text-[#8b8b86] line-through">{money(product.rsp)}</span>}
      </p>
      <p className="mt-1 text-xs text-[#6d6d68]">{sub}</p>

      <div className="mt-3.5 flex justify-center gap-1.5" role="radiogroup" aria-label="Size">
        {product.sizes.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={size === s}
            onClick={() => setSize(s)}
            className={`min-w-9 rounded-full border px-2.5 py-1.5 text-[11px] tabular-nums transition ${
              size === s ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-black/15 hover:border-black/50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-3.5 max-w-[21rem]">
        <ModeToggle mode={mode} setMode={setMode} />
      </div>

      <div className="mt-3.5 flex items-center justify-center gap-3">
        <button
          disabled={!size}
          onClick={() => {
            if (!size) return;
            onAdd(product, size);
            setAdded(true);
            window.setTimeout(() => setAdded(false), 1400);
          }}
          className="flex min-w-44 items-center justify-center gap-2 rounded-full bg-[#1a1a1a] px-6 py-3 text-xs uppercase tracking-[0.16em] text-white transition enabled:hover:bg-black disabled:opacity-30"
        >
          {added ? (
            <>
              <Check size={14} weight="bold" /> Added
            </>
          ) : size ? (
            "Hang in bag"
          ) : (
            "Pick a size"
          )}
        </button>
        <button onClick={onClose} className="text-[11px] uppercase tracking-[0.16em] text-[#8b8b86] hover:text-black">
          Back
        </button>
      </div>
    </div>
  );
}
