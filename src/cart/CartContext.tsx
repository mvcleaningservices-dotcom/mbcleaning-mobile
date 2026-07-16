import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServiceItem } from '../api';

/**
 * The booking cart (selected services), shared across every screen and persisted
 * so closing the app doesn't lose the selection.
 *
 * Mirrors web's CartContext API exactly (items/count/total/has/toggle/remove/clear)
 * so the two platforms cannot drift apart again — previously mobile had no cart at
 * all: selection lived in ServicesScreen's local useState, which meant the home
 * screen literally could not add anything, and the cart vanished on app close.
 *
 * AsyncStorage (not SecureStore): a cart isn't a secret, and SecureStore caps
 * values at ~2KB — a large cart would silently fail to save.
 */
const KEY = 'mv_cart';

interface CartState {
  items: ServiceItem[];
  count: number;
  total: number;
  has: (id: string) => boolean;
  toggle: (service: ServiceItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, ServiceItem>>({});
  // AsyncStorage is async, so unlike web we can't seed state synchronously.
  // Until the first read resolves we must not persist, or we'd overwrite the
  // saved cart with the empty initial state on every cold start.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        setMap(JSON.parse(raw) as Record<string, ServiceItem>);
      })
      .catch(() => {
        /* corrupt/unavailable storage → start with an empty cart, never crash */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(KEY, JSON.stringify(map)).catch(() => {
      /* a failed write must not break the booking flow */
    });
  }, [map, hydrated]);

  const toggle = useCallback((service: ServiceItem) => {
    setMap((prev) => {
      const next = { ...prev };
      if (next[service.id]) delete next[service.id];
      else next[service.id] = service;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => setMap({}), []);

  const items = useMemo(() => Object.values(map), [map]);
  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);

  const value: CartState = useMemo(
    () => ({
      items,
      count: items.length,
      total,
      has: (id: string) => !!map[id],
      toggle,
      remove,
      clear,
    }),
    [items, total, map, toggle, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
