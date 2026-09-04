"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { CartItem, CustomSize, Product } from "@/types/ecommerce";
import { formatCustomSize } from "@/lib/custom-size";
import {
  calcTax,
  calcShipping,
  calcTotal,
  payableSubtotal,
  DEFAULT_RATES,
  type DeliveryRates,
} from "@/lib/pricing";
import {
  amountOf,
  hasLapsed,
  isDiscountKind,
  type AppliedDiscount,
} from "@/lib/discounts/lifecycle";

export interface VariantOptions {
  size?: string | null;
  /** Set when the buyer asked for this design cut to their own bed. */
  custom?: CustomSize | null;
}

/**
 * The bag as an API payload: one entry per *line*, not per product.
 *
 * Exported because two callers build it — the promo field, which asks what a
 * code is worth against this bag, and checkout, which places it. They have to
 * describe the same bag or the subtotal a code was quoted against is not the
 * subtotal it is spent against.
 */
export function cartLines(items: CartItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    size: item.size ?? null,
    custom: item.custom ?? null,
  }));
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, variant?: VariantOptions) => void;
  /** Operates on a cart *line* (`item.id`), not a product id — one product can
   *  appear more than once when bought in several sizes. */
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Units of a given product already in the bag, summed across every size. */
  quantityOfProduct: (productId: string) => number;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  tax: number;
  shipping: number;
  totalPrice: number;
  /** Live delivery rates, configurable from the admin panel. */
  rates: DeliveryRates;
  /* ── Discount code ─────────────────────────────────────────────────────── */
  /** The rule currently on the bag, or null. */
  discount: AppliedDiscount | null;
  /** What that rule takes off at this subtotal. Zero when nothing is applied. */
  discountAmount: number;
  /** Subtotal minus the discount — what delivery and the total are figured on. */
  payable: number;
  /** Checks a code against this bag and applies it if it holds. */
  applyDiscount: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeDiscount: () => void;
  /** Set when a code came off by itself, e.g. the bag fell below its minimum. */
  discountNotice: string | null;
  dismissDiscountNotice: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CART_STORAGE_KEY = "dreamstitch_cart_v1";

/**
 * The applied code, kept beside the bag rather than inside it.
 *
 * Only the four fields of `AppliedDiscount` are stored, and none of them is
 * the reduction itself — that is recomputed from the live subtotal every
 * render, so a code cannot survive a change to the bag as a stale number. The
 * cap and the dates are not stored at all: they are checked by Postgres, twice,
 * and a copy here would only be a second answer to a question the server has
 * already settled.
 */
const DISCOUNT_STORAGE_KEY = "dreamstitch_discount_v1";

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * Lines are keyed by product *and* variant so two sizes stay separate rows —
 * and two different sets of measurements do too. Without the dimensions in the
 * key, ordering an 82×78 and a 90×80 of the same sheet would collapse into one
 * line of quantity 2, and only one of the two beds would get a sheet that fits.
 */
function lineIdFor(productId: string, variant?: VariantOptions): string {
  const custom = variant?.custom ? formatCustomSize(variant.custom) : "";
  return `${productId}::${variant?.size ?? ""}::${custom}`;
}

export function CartProvider({
  children,
  rates = DEFAULT_RATES,
}: {
  children: React.ReactNode;
  rates?: DeliveryRates;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [discountNotice, setDiscountNotice] = useState<string | null>(null);

  // Hydrate cart from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }

      /* Restored rather than dropped, so a reload does not silently cost
         somebody the code they typed. It is not trusted on the way back in —
         the fields are checked, the reduction is recomputed from the live bag,
         and checkout re-validates the code against Postgres regardless. */
      const storedDiscount = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (storedDiscount) {
        const parsed = JSON.parse(storedDiscount);
        if (
          parsed &&
          typeof parsed.code === "string" &&
          typeof parsed.value === "number" &&
          isDiscountKind(String(parsed.kind))
        ) {
          setDiscount({
            code: parsed.code,
            kind: parsed.kind,
            value: parsed.value,
            minSubtotal: Number(parsed.minSubtotal) || 0,
          });
        }
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save cart to localStorage whenever items change after initial hydration
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [items, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (discount) localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(discount));
      else localStorage.removeItem(DISCOUNT_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to save the discount code to localStorage", e);
    }
  }, [discount, isHydrated]);

  const addItem = useCallback(
    (product: Product, quantity: number = 1, variant?: VariantOptions) => {
      if (!product || quantity <= 0) return;

      setItems((prevItems) => {
        const lineId = lineIdFor(product.id, variant);
        const stockCap = product.stock || 99;

        // Stock is held per product, so cap against every size of it at once
        const otherLinesQty = prevItems
          .filter((item) => item.productId === product.id && item.id !== lineId)
          .reduce((sum, item) => sum + item.quantity, 0);
        const remaining = Math.max(0, stockCap - otherLinesQty);
        if (remaining === 0) return prevItems;

        const existingIndex = prevItems.findIndex((item) => item.id === lineId);

        if (existingIndex > -1) {
          const updated = [...prevItems];
          const existing = updated[existingIndex];
          updated[existingIndex] = {
            ...existing,
            quantity: Math.min(existing.quantity + quantity, remaining),
            maxStock: stockCap,
            price: Number(product.price),
          };
          return updated;
        }

        const newItem: CartItem = {
          id: lineId,
          productId: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(product.price),
          imageUrl: product.image_url,
          quantity: Math.min(quantity, remaining),
          maxStock: stockCap,
          categoryName: product.category?.name || null,
          size: variant?.size ?? null,
          custom: variant?.custom ?? null,
        };
        return [...prevItems, newItem];
      });

      // Open the drawer so the addition is immediately visible
      setIsOpen(true);
    },
    []
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== lineId));
  }, []);

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(lineId);
        return;
      }

      setItems((prev) => {
        const target = prev.find((item) => item.id === lineId);
        if (!target) return prev;

        const otherLinesQty = prev
          .filter((item) => item.productId === target.productId && item.id !== lineId)
          .reduce((sum, item) => sum + item.quantity, 0);
        const remaining = Math.max(1, (target.maxStock || 99) - otherLinesQty);

        return prev.map((item) =>
          item.id === lineId ? { ...item, quantity: Math.min(quantity, remaining) } : item
        );
      });
    },
    [removeItem]
  );

  const quantityOfProduct = useCallback(
    (productId: string) =>
      items
        .filter((item) => item.productId === productId)
        .reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    /* The code goes with the bag. It was applied to *these* items, and leaving
       it behind for whatever gets added next would be quoting a reduction
       nobody asked for against a bag it was never checked against. */
    setDiscount(null);
    setDiscountNotice(null);
  }, []);

  /**
   * Checks a code against this bag, and keeps it if it holds.
   *
   * The bag goes to the server as lines, not as a subtotal: /api/discount
   * prices it from the catalogue, so what comes back is a reduction against
   * the bag that actually exists. What is kept is the *rule* — the reduction
   * itself is recomputed locally as items are added and removed, which is why
   * changing a quantity does not cost another round trip.
   *
   * Nothing here is a security boundary. Checkout re-checks the code, the cap,
   * the window and the per-customer limit against Postgres before an order is
   * written, and it is the only thing that can.
   */
  const applyDiscount = useCallback(
    async (code: string): Promise<{ ok: boolean; message: string }> => {
      const trimmed = code.trim();
      if (!trimmed) return { ok: false, message: "Enter a code first." };
      if (items.length === 0) return { ok: false, message: "Your bag is empty." };

      try {
        const res = await fetch("/api/discount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed, items: cartLines(items) }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          return {
            ok: false,
            message: data?.error ?? "That code could not be applied.",
          };
        }

        setDiscount({
          code: data.discount.code,
          kind: data.discount.kind,
          value: Number(data.discount.value),
          minSubtotal: Number(data.discount.minSubtotal) || 0,
        });
        setDiscountNotice(null);

        return { ok: true, message: data.message ?? "Code applied." };
      } catch {
        return { ok: false, message: "A network error interrupted that. Please try again." };
      }
    },
    [items]
  );

  const removeDiscount = useCallback(() => {
    setDiscount(null);
    setDiscountNotice(null);
  }, []);

  const dismissDiscountNotice = useCallback(() => setDiscountNotice(null), []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  /* Recomputed from the live subtotal rather than stored, so the reduction can
     never be stale: change a quantity and it moves with the bag. Same function
     Postgres runs at checkout — see lib/discounts/lifecycle.ts. */
  const discountAmount = useMemo(() => amountOf(discount, subtotal), [discount, subtotal]);

  const payable = useMemo(
    () => payableSubtotal(subtotal, discountAmount),
    [subtotal, discountAmount]
  );

  /**
   * A code comes off by itself once the bag no longer qualifies for it.
   *
   * Leaving it on, greyed out and worth nothing, is the alternative, and it is
   * the one that gets read as "the discount is still coming" right up to the
   * total that says otherwise. Taking it off and saying so is the version
   * somebody can act on — they are usually one item away from earning it back.
   *
   * An empty bag is not a lapse: `clearCart()` has already dropped the code,
   * and removing the last item on the way to adding a different one should not
   * produce a message about a minimum.
   */
  useEffect(() => {
    if (!discount || items.length === 0) return;
    if (!hasLapsed(discount, subtotal)) return;

    setDiscountNotice(`${discount.code} came off — your bag is below its minimum.`);
    setDiscount(null);
  }, [discount, subtotal, items.length]);

  const tax = useMemo(() => calcTax(payable), [payable]);
  const shipping = useMemo(
    () => calcShipping(payable, totalItems, rates),
    [payable, totalItems, rates]
  );
  const totalPrice = useMemo(
    () => calcTotal(subtotal, totalItems, rates, discountAmount),
    [subtotal, totalItems, rates, discountAmount]
  );

  const contextValue = useMemo<CartContextType>(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      quantityOfProduct,
      clearCart,
      totalItems,
      subtotal,
      tax,
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
      openCart,
      closeCart,
      toggleCart,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      quantityOfProduct,
      clearCart,
      totalItems,
      subtotal,
      tax,
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
      openCart,
      closeCart,
      toggleCart,
    ]
  );

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
