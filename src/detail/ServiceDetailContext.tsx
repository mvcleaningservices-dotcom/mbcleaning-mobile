import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ServiceItem } from '../api';

/**
 * Controls the service-detail bottom sheet (one instance, opened from any card).
 * Mirrors web's ServiceDetailContext so the platforms stay in step.
 */
interface DetailState {
  service: ServiceItem | null;
  open: (service: ServiceItem) => void;
  close: () => void;
}

const Ctx = createContext<DetailState | null>(null);

export function ServiceDetailProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<ServiceItem | null>(null);
  const open = useCallback((s: ServiceItem) => setService(s), []);
  const close = useCallback(() => setService(null), []);
  return <Ctx.Provider value={{ service, open, close }}>{children}</Ctx.Provider>;
}

export function useServiceDetail(): DetailState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServiceDetail must be used within <ServiceDetailProvider>');
  return ctx;
}
