"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { CartItem, Product } from "@/types/ecommerce";
import {
  calcTax,
  calcShipping,
  calcTotal,
  DEFAULT_RATES,
  type DeliveryRates,
} from "@/lib/pricing";

export interface VariantOptions {
  size?: string | null;
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
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CART_STORAGE_KEY = "dreamstitch_cart_v1";

const CartContext = createContext<CartContextType | undefined>(undefined);

/** Lines are keyed by product *and* size so two sizes stay separate rows. */
function lineIdFor(productId: string, variant?: VariantOptions): string {
  return `${productId}::${variant?.size ?? ""}`;
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
  }, []);

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

  const tax = useMemo(() => calcTax(subtotal), [subtotal]);
  const shipping = useMemo(
    () => calcShipping(subtotal, totalItems, rates),
    [subtotal, totalItems, rates]
  );
  const totalPrice = useMemo(
    () => calcTotal(subtotal, totalItems, rates),
    [subtotal, totalItems, rates]
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
