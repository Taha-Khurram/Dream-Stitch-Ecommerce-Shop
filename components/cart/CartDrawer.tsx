"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import { amountToFreeShipping } from "@/lib/pricing";
import { BRAND } from "@/lib/constants";
import { usePresence, useScrollLock } from "@/components/motion/usePresence";
import {
  X,
  Plus,
  Minus,
  ArrowLeft,
  Loader2,
  Check,
  AlertTriangle,
  Truck,
} from "lucide-react";

type Stage = "bag" | "address" | "done";

/** Keep in step with --duration-panel / .sheet-right in globals.css. */
const EXIT_MS = 460;

const EMPTY_ADDRESS = {
  fullName: "",
  email: "",
  streetAddress: "",
  city: "",
  state: "",
  postalCode: "",
  country: "Pakistan",
  phone: "",
};

export function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    subtotal,
    shipping,
    totalPrice,
    rates,
    isOpen,
    closeCart,
  } = useCart();

  const [stage, setStage] = useState<Stage>("bag");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<{ orderId: string; totalAmount: number } | null>(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  // Stays mounted through the slide-out so the panel can animate away.
  const { mounted, state } = usePresence(isOpen, EXIT_MS);
  useScrollLock(isOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeCart]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // Cart lines are per size; the order API works per product, so merge them
      const merged = new Map<string, number>();
      items.forEach((item) => {
        merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
      });

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [...merged].map(([productId, quantity]) => ({ productId, quantity })),
          shippingAddress: address,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "We couldn't place your order. Please try again.");
        return;
      }

      setOrder({ orderId: data.orderId, totalAmount: data.totalAmount });
      setStage("done");
      clearCart();
    } catch {
      setErrorMessage("A network error interrupted checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    closeCart();
    // Reset back to the bag once the panel has slid away
    setTimeout(() => {
      setStage("bag");
      setOrder(null);
      setErrorMessage(null);
    }, EXIT_MS);
  };

  if (!mounted) return null;

  const remainingForFreeShipping = amountToFreeShipping(subtotal, rates);
  // A zero threshold means everything ships free, so the bar is already full.
  const progress =
    rates.freeShippingThreshold > 0
      ? Math.min(100, (subtotal / rates.freeShippingThreshold) * 100)
      : 100;

  const inputClass =
    "w-full border-b border-line bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors focus:border-ink focus:outline-none";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="veil absolute inset-0 bg-ink/40" data-state={state} onClick={close} />

      <div
        className="sheet-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[0_0_60px_-15px_rgba(42,27,51,0.45)]"
        data-state={state}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            {stage === "address" && (
              <button
                onClick={() => setStage("bag")}
                aria-label="Back to bag"
                className="cursor-pointer text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="eyebrow text-ink">
                {stage === "bag" ? "Shopping Bag" : stage === "address" ? "Delivery" : "Confirmed"}
              </h2>
              {stage === "bag" && (
                <p className="mt-1 text-[11px] text-muted">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={close}
            aria-label="Close bag"
            className="cursor-pointer text-muted transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Order confirmed ─────────────────────────────────────────── */}
        {stage === "done" && order && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade text-white">
              <Check className="h-6 w-6" />
            </span>
            <h3 className="mt-6 font-[family-name:var(--font-display)] text-2xl text-ink">
              Thank you for your order
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              We&apos;ve emailed your confirmation. Your parcel leaves our Karachi studio within 24
              hours.
            </p>
            <dl className="mt-7 w-full space-y-2 border-y border-line py-5 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">Order number</dt>
                <dd className="text-ink">{order.orderId.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Total paid</dt>
                <dd className="text-ink">{formatPrice(order.totalAmount)}</dd>
              </div>
            </dl>
            <button onClick={close} className="btn-primary mt-8 w-full cursor-pointer">
              Continue Shopping
            </button>
          </div>
        )}

        {/* ── Empty bag ───────────────────────────────────────────────── */}
        {stage !== "done" && items.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <h3 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Your bag is empty
            </h3>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Nothing here yet. Start with what&apos;s new in the studio this week.
            </p>
            <Link href="/shop?sort=newest" onClick={close} className="btn-primary mt-8">
              Shop New In
            </Link>
          </div>
        )}

        {/* ── Bag contents ────────────────────────────────────────────── */}
        {stage === "bag" && items.length > 0 && (
          <>
            <div className="border-b border-line px-6 py-4">
              {remainingForFreeShipping > 0 ? (
                <p className="text-[11px] text-ink-soft">
                  <Truck className="mr-1.5 inline h-3.5 w-3.5 text-purple" strokeWidth={1.4} />
                  Add {formatPrice(remainingForFreeShipping)} more for free delivery
                </p>
              ) : (
                <p className="text-[11px] text-jade">
                  <Check className="mr-1.5 inline h-3.5 w-3.5" /> You&apos;ve unlocked free delivery
                </p>
              )}
              <div className="mt-2.5 h-[2px] w-full bg-line">
                <div
                  className="h-full bg-purple transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="scroll-area flex-1 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b border-line-soft py-5">
                  <Link
                    href={`/shop/${item.productId}`}
                    onClick={close}
                    className="block h-28 w-20 shrink-0 overflow-hidden bg-lilac"
                  >
                    {item.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : null}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/shop/${item.productId}`}
                          onClick={close}
                          className="block truncate text-[13px] text-ink transition-colors hover:text-purple"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                          {item.size && <span>Size {item.size}</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="eyebrow shrink-0 cursor-pointer text-[8px] text-muted transition-colors hover:text-sale"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="flex items-center border border-line">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center text-muted transition-colors hover:text-ink"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-[12px] text-ink">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.maxStock}
                          aria-label="Increase quantity"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-faint"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="text-[13px] text-ink">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-6 py-5">
              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-ink">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className={shipping === 0 ? "text-jade" : "text-ink"}>
                    {shipping === 0 ? "Free" : formatPrice(shipping)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3">
                  <dt className="eyebrow text-ink">Total</dt>
                  <dd className="font-[family-name:var(--font-display)] text-lg text-ink">
                    {formatPrice(totalPrice)}
                  </dd>
                </div>
              </dl>

              <p className="mt-2 text-[10px] text-muted">Prices include GST.</p>

              <button
                onClick={() => setStage("address")}
                className="btn-primary mt-5 w-full cursor-pointer"
              >
                Checkout
              </button>
              <button
                onClick={close}
                className="eyebrow link-underline mx-auto mt-4 block cursor-pointer text-muted transition-colors hover:text-ink"
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}

        {/* ── Delivery details ────────────────────────────────────────── */}
        {stage === "address" && items.length > 0 && (
          <form onSubmit={submitOrder} className="flex flex-1 flex-col overflow-hidden">
            <div className="scroll-area flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {errorMessage && (
                <div className="flex items-start gap-2.5 border-l-2 border-sale bg-frost px-4 py-3 text-[12px] text-ink-soft">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sale" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="eyebrow text-muted" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  required
                  value={address.fullName}
                  onChange={handleChange}
                  placeholder="Ayesha Khan"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="eyebrow text-muted" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={address.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="eyebrow text-muted" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  value={address.phone}
                  onChange={handleChange}
                  placeholder="+92 300 1234567"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="eyebrow text-muted" htmlFor="streetAddress">
                  Address
                </label>
                <input
                  id="streetAddress"
                  name="streetAddress"
                  required
                  value={address.streetAddress}
                  onChange={handleChange}
                  placeholder="House 12, Street 4, Block B"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="eyebrow text-muted" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    required
                    value={address.city}
                    onChange={handleChange}
                    placeholder="Karachi"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="eyebrow text-muted" htmlFor="state">
                    Province
                  </label>
                  <input
                    id="state"
                    name="state"
                    required
                    value={address.state}
                    onChange={handleChange}
                    placeholder="Sindh"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="eyebrow text-muted" htmlFor="postalCode">
                    Postal Code
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    required
                    value={address.postalCode}
                    onChange={handleChange}
                    placeholder="75500"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="eyebrow text-muted" htmlFor="country">
                    Country
                  </label>
                  <input
                    id="country"
                    name="country"
                    required
                    value={address.country}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-muted">
                You need a {BRAND.name} account to place an order.{" "}
                <Link href="/signin" onClick={close} className="link-rule text-ink">
                  Sign in
                </Link>{" "}
                if you haven&apos;t already.
              </p>
            </div>

            <div className="border-t border-line px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-ink">Total</span>
                <span className="font-[family-name:var(--font-display)] text-lg text-ink">
                  {formatPrice(totalPrice)}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-4 w-full cursor-pointer disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Placing Order
                  </>
                ) : (
                  "Place Order"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
