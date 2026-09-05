"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useCart, cartLines } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import { amountToFreeShipping } from "@/lib/pricing";
import { formatCustomSize } from "@/lib/custom-size";
import { isDiscountOutcome } from "@/lib/discounts/lifecycle";
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_COPY,
  PAYMENT_METHODS,
  isAvailableMethod,
  isCollectOnDelivery,
  totalLabel,
  type PaymentMethod,
} from "@/lib/orders/payment";
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
  Tag,
  Truck,
  Wallet,
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
    discount,
    discountAmount,
    payable,
    applyDiscount,
    removeDiscount,
    discountNotice,
    dismissDiscountNotice,
    isOpen,
    closeCart,
  } = useCart();

  const [stage, setStage] = useState<Stage>("bag");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    orderId: string;
    totalAmount: number;
    discountCode: string | null;
    discountAmount: number;
    paymentMethod: string | null;
  } | null>(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  /* How they intend to pay. Cash on delivery to start with, because it is the
     only method live today and because a payment step that opens with nothing
     chosen is a step everyone has to touch to get past. */
  const [payment, setPayment] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);

  /* The promo field's own state. Deliberately not in the cart context: what has
     been typed but not yet submitted is this control's business, and the
     context holds only the code that actually held. */
  const [codeInput, setCodeInput] = useState("");
  const [codePending, setCodePending] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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
      /* One payload entry per cart *line*. These used to be merged down to one
         entry per product, which threw away the size — and would throw away a
         set of measurements, leaving an order nobody could cut. The server
         re-checks stock across the lines of a product. */
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines(items),
          shippingAddress: address,
          discountCode: discount?.code ?? null,
          paymentMethod: payment,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        /* The server re-checks the code against the cap, the window and the
           per-customer limit, and it can refuse one the drawer was holding
           quite legitimately — a limited code claimed by somebody else in the
           meantime, or a once-per-customer code the shopper has now signed in
           to. Taking it off is what makes Place Order work on the second
           press; leaving it on would refuse the order again for the same
           reason, with no way to clear it. */
        if (isDiscountOutcome(String(data.outcome ?? ""))) removeDiscount();

        setErrorMessage(data.error || "We couldn't place your order. Please try again.");
        return;
      }

      setOrder({
        orderId: data.orderId,
        totalAmount: data.totalAmount,
        discountCode: data.discountCode ?? null,
        discountAmount: Number(data.discountAmount ?? 0),
        /* What the server recorded, not what this component last had selected
           — the two can differ if the payment column is not installed yet. */
        paymentMethod: data.paymentMethod ?? null,
      });
      setStage("done");
      clearCart();
    } catch {
      setErrorMessage("A network error interrupted checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    dismissDiscountNotice();
    setCodePending(true);

    const result = await applyDiscount(codeInput);

    setCodePending(false);
    if (result.ok) setCodeInput("");
    else setCodeError(result.message);
  };

  const close = () => {
    closeCart();
    // Reset back to the bag once the panel has slid away
    setTimeout(() => {
      setStage("bag");
      setOrder(null);
      setErrorMessage(null);
      /* The applied code survives — it belongs to the bag, and the bag is
         still there. Only what was typed and refused is cleared. */
      setCodeInput("");
      setCodeError(null);
      setPayment(DEFAULT_PAYMENT_METHOD);
    }, EXIT_MS);
  };

  if (!mounted) return null;

  /* Measured against what is actually being paid for the goods, which is what
     `calcShipping` charges on. A code that drops the bag under the threshold
     takes the free delivery with it, and the bar has to move when it does —
     see the note on calcShipping in lib/pricing.ts. */
  const remainingForFreeShipping = amountToFreeShipping(payable, rates);
  // A zero threshold means everything ships free, so the bar is already full.
  const progress =
    rates.freeShippingThreshold > 0
      ? Math.min(100, (payable / rates.freeShippingThreshold) * 100)
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
              {/* From the response, not from the cart — the bag has already
                  been emptied, and this is what was actually recorded against
                  the order rather than what the drawer last calculated. */}
              {order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="truncate text-muted">Discount · {order.discountCode}</dt>
                  <dd className="shrink-0 text-purple">−{formatPrice(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{totalLabel(order.paymentMethod)}</dt>
                <dd className="shrink-0 text-ink">{formatPrice(order.totalAmount)}</dd>
              </div>
            </dl>
            {/* The one instruction a cash order leaves the customer with. It
                belongs on the confirmation rather than only in the email,
                because this is the screen they are looking at. */}
            {isCollectOnDelivery(order.paymentMethod) && (
              <p className="mt-5 flex items-start gap-2 text-left text-[11px] leading-relaxed text-ink-soft">
                <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.5} />
                <span>
                  You&apos;re paying cash on delivery — please have{" "}
                  {formatPrice(order.totalAmount)} ready for the courier.
                </span>
              </p>
            )}
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
                          {item.custom ? (
                            <span className="text-purple">
                              Custom · {formatCustomSize(item.custom)}
                            </span>
                          ) : (
                            item.size && <span>Size {item.size}</span>
                          )}
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
              {/* ── Discount code ──────────────────────────────────────────
                  Above the totals, not below them: it is a thing to do, and
                  the numbers under it change when it is done. Applied, the
                  field is replaced by the code itself rather than sitting
                  there empty inviting a second one — a bag takes one code,
                  which is a rule enforced by a UNIQUE on the ledger. */}
              {discount ? (
                <div className="mb-4 flex items-center justify-between gap-3 border border-purple/30 bg-lilac px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.6} />
                    <span className="truncate text-[12px] font-medium tracking-[0.08em] text-purple">
                      {discount.code}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="eyebrow shrink-0 cursor-pointer text-[8px] text-muted transition-colors hover:text-sale"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={submitCode} className="mb-4 flex items-center gap-2">
                  <input
                    name="discountCode"
                    value={codeInput}
                    onChange={(e) => {
                      /* Upper-cased as it is typed, because that is how it is
                         stored and compared. Doing it here rather than only on
                         the server means the field shows the shopper the code
                         that is about to be checked. */
                      setCodeInput(e.target.value.toUpperCase());
                      setCodeError(null);
                    }}
                    placeholder="Discount code"
                    aria-label="Discount code"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    className="min-w-0 flex-1 border border-line bg-white px-3 py-2 text-[12px] tracking-[0.08em] text-ink placeholder-faint transition-colors focus:border-purple focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={codePending || !codeInput.trim()}
                    className="eyebrow shrink-0 cursor-pointer border border-ink px-4 py-2.5 text-[9px] text-ink transition-colors hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-faint disabled:hover:bg-transparent"
                  >
                    {codePending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                  </button>
                </form>
              )}

              {/* One line for both, because they never coexist: a code that
                  lapsed has already been removed, and a code being refused was
                  never applied. */}
              {(codeError || discountNotice) && (
                <p role="status" className="mb-4 -mt-2 text-[11px] leading-relaxed text-sale">
                  {codeError ?? discountNotice}
                </p>
              )}

              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-ink">{formatPrice(subtotal)}</dd>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <dt className="truncate text-muted">Discount · {discount?.code}</dt>
                    <dd className="shrink-0 text-purple">−{formatPrice(discountAmount)}</dd>
                  </div>
                )}
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
                  minLength={2}
                  maxLength={100}
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
                  maxLength={30}
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
                  minLength={5}
                  maxLength={200}
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
                    minLength={2}
                    maxLength={100}
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
                    minLength={2}
                    maxLength={100}
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
                    minLength={3}
                    maxLength={20}
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
                    minLength={2}
                    maxLength={100}
                    value={address.country}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* ── Payment ───────────────────────────────────────────────
                  Last, under the address, because it is the last thing decided
                  and the cheapest to change: everything above is typed, this is
                  picked. The method that is not live yet is shown rather than
                  hidden — a shopper who wants to pay by card should find out
                  here that they cannot, not after typing an address for
                  nothing. */}
              <fieldset className="border-t border-line pt-5">
                <legend className="sr-only">Payment method</legend>
                <p className="eyebrow text-muted">Payment</p>

                <div className="mt-3 space-y-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const copy = PAYMENT_COPY[method];
                    const available = isAvailableMethod(method);
                    const selected = payment === method;

                    return (
                      <label
                        key={method}
                        /* Built as one branch rather than layered overrides:
                           `cursor-pointer` and `cursor-not-allowed` carry the
                           same specificity, so which wins is decided by the
                           order Tailwind emits them in, not the order they are
                           written here. Only ever emit the one that applies. */
                        className={`flex items-start gap-3 border px-3.5 py-3 transition-colors ${
                          !available
                            ? "cursor-not-allowed border-line opacity-55"
                            : selected
                              ? "cursor-pointer border-purple bg-lilac"
                              : "cursor-pointer border-line hover:border-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={selected}
                          disabled={!available}
                          onChange={() => setPayment(method)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-purple)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[13px] text-ink">{copy.label}</span>
                            {!available && (
                              <span className="eyebrow border border-line px-1.5 py-0.5 text-[8px] text-muted">
                                Coming soon
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                            {copy.note}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Said once, plainly, and only when it applies: the courier
                    wants the exact figure and the person answering the door is
                    not always the person who ordered. */}
                {isCollectOnDelivery(payment) && (
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.5} />
                    <span>
                      Please have {formatPrice(totalPrice)} ready for the courier. We
                      cannot take card at the door.
                    </span>
                  </p>
                )}
              </fieldset>

              <p className="text-[11px] leading-relaxed text-muted">
                You need a {BRAND.name} account to place an order.{" "}
                <Link href="/signin" onClick={close} className="link-rule text-ink">
                  Sign in
                </Link>{" "}
                if you haven&apos;t already.
              </p>
            </div>

            <div className="border-t border-line px-6 py-5">
              {/* Carried through to the last step on purpose: the code was
                  applied a screen ago, and a total that is lower than the
                  subtotal with nothing to explain it reads as a mistake. */}
              {discountAmount > 0 && (
                <p className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="truncate text-muted">Discount · {discount?.code}</span>
                  <span className="shrink-0 text-purple">−{formatPrice(discountAmount)}</span>
                </p>
              )}
              {/* Named for what the number is about to do. On a cash order
                  the figure is not paid at this button, it is owed at a door,
                  and the button above says "Place Order" rather than "Pay". */}
              <div className="flex items-baseline justify-between gap-4">
                <span className="eyebrow text-ink">{totalLabel(payment)}</span>
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
