"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

interface WishlistContextType {
  /** Saved product ids, newest first. */
  ids: string[];
  count: number;
  /** False until localStorage has been read — gate counts on it so the server
   *  and the first client paint agree. */
  isHydrated: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const WISHLIST_STORAGE_KEY = "dreamstitch_wishlist_v1";

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Local-only wishlist. Persisted per browser — there is no wishlist table yet,
 * and a saved item shouldn't require an account. Held in context rather than
 * read from localStorage at each call site so the header count, the heart on
 * every card and the wishlist grid all move together.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIds(readStored());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* private browsing — the list still holds for this session */
    }
  }, [ids, isHydrated]);

  // A second tab saving something shouldn't leave this one showing a stale count
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === WISHLIST_STORAGE_KEY) setIds(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback((productId: string) => {
    setIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev]
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const contextValue = useMemo<WishlistContextType>(
    () => ({ ids, count: ids.length, isHydrated, has, toggle, remove, clear }),
    [ids, isHydrated, has, toggle, remove, clear]
  );

  return (
    <WishlistContext.Provider value={contextValue}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
