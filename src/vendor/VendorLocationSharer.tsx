import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from '../api';
import { session } from '../session';
import { watchPosition } from '../maps/location';

const CHECK_MS = 60_000; // how often to check for an In Progress job
const SEND_GAP_MS = 25_000; // at most one position every 25 s

/**
 * Vendor live location (client V2 5.3). Runs only in Vendor mode, only while
 * the app is open (stops in the background), and only while one of the
 * vendor's jobs is In Progress — the server ignores positions otherwise.
 * Renders nothing.
 */
export function VendorLocationSharer() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let starting = false;
    let refused = false; // don't keep asking after a "no" this session
    let lastSent = 0;
    let disposed = false;

    const stopWatching = () => {
      stop?.();
      stop = null;
    };

    const send = async (lat: number, lng: number) => {
      if (Date.now() - lastSent < SEND_GAP_MS) return;
      lastSent = Date.now();
      const t = await session.getToken();
      if (!t) return;
      try {
        const r = await api.vendorLocation(t, lat, lng);
        if (!r.sharing) stopWatching(); // job finished — stop the GPS
      } catch { /* next position retries */ }
    };

    const check = async () => {
      if (disposed || AppState.currentState !== 'active') return;
      const t = await session.getToken();
      if (!t || (await session.getKind()) !== 'vendor') return;
      let active = false;
      try {
        active = (await api.vendorOrders(t)).some((o) => o.status === 'in_progress');
      } catch {
        return; // offline — try again next check
      }
      if (!active) return stopWatching();
      if (stop || starting || refused) return;
      starting = true;
      try {
        lastSent = 0;
        const s = await watchPosition((p) => { void send(p.lat, p.lng); });
        if (disposed) s();
        else stop = s;
      } catch {
        refused = true; // permission off, or app build too old for location
      } finally {
        starting = false;
      }
    };

    void check();
    const iv = setInterval(() => { void check(); }, CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
      else stopWatching(); // only while the app is open
    });
    return () => {
      disposed = true;
      clearInterval(iv);
      sub.remove();
      stopWatching();
    };
  }, []);

  return null;
}
