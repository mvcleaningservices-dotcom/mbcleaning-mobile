import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { api, AppContentConfig, BannerItem, BannerPlacement } from '../api';

/**
 * Client V2 content — admin-managed banners and the helpline number.
 * Everything here is best-effort: if the request fails, the section simply
 * doesn't show and the rest of the screen works as before.
 */

/** Same WhatsApp number the website used before it became an admin setting. */
const DEFAULT_WHATSAPP_NUMBER = '918151842101';
const EMPTY_CONFIG: AppContentConfig = {
  helplineNumber: '',
  showDefaultHomeBanner: true,
  whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
};

/** Live banners for one placement (and category). `null` placement = skip. */
export function useBanners(placement: BannerPlacement | null, category?: string, reloadKey = 0) {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  useEffect(() => {
    if (!placement || (placement === 'category' && !category)) {
      setBanners([]);
      return;
    }
    let cancelled = false;
    api
      .listBanners(placement, category)
      .then((rows) => { if (!cancelled) setBanners(rows); })
      .catch(() => { if (!cancelled) setBanners([]); });
    return () => { cancelled = true; };
  }, [placement, category, reloadKey]);
  return banners;
}

/** Helpline + default-banner setting. */
export function useAppConfig(reloadKey = 0) {
  const [config, setConfig] = useState<AppContentConfig>(EMPTY_CONFIG);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .contentConfig()
      .then((c) => { if (!cancelled) setConfig({ ...EMPTY_CONFIG, ...c }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);
  return { config, loaded };
}

/** Open the phone dialer on the helpline number. */
export function callHelpline(number: string) {
  const digits = number.replace(/[^\d+]/g, '');
  if (digits) void Linking.openURL(`tel:${digits}`).catch(() => {});
}

/** WhatsApp chat (number from admin → Settings; same greeting as the website). */
const WHATSAPP_TEXT = "Hi! I'd like to book a cleaning service.";
export function openWhatsApp(number: string) {
  const n = number.replace(/\D/g, '');
  if (!n) return;
  void Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(WHATSAPP_TEXT)}`).catch(() => {});
}

/** Open an external banner link (https only — the admin form enforces it too). */
export function openExternal(url: string) {
  if (/^https:\/\//.test(url)) void Linking.openURL(url).catch(() => {});
}

export type { BannerItem };
