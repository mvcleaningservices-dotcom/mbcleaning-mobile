/**
 * Thin API client for the MV Cleaning backend.
 * Base URL comes from EXPO_PUBLIC_API_URL (see .env.example).
 * NOTE: on a physical device, localhost won't resolve — use your PC's LAN IP.
 */
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

/**
 * Called when the server rejects our token (expired / invalidated).
 *
 * api.ts can't navigate on its own, so the navigation layer registers a handler
 * at startup (see RootNavigator). Without this, an expired token left the user
 * stuck on "Unauthorized" errors with no route back to login — consumer tokens
 * last 30 days, so it's rare but total when it happens.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** The login endpoints — a 401 there is a bad OTP, not an expired session. */
const AUTH_PATHS = [
  '/auth/otp/request',
  '/auth/otp/verify',
  '/auth/customer/login',
  '/auth/vendor/login',
];

async function req<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    // fetch rejects (rather than returning a response) when the device can't
    // reach the network at all. React Native surfaces this as the bare string
    // "Network request failed", which is meaningless to a customer — so give
    // them something they can act on.
    throw new Error(
      "Can't reach MV Cleaning. Please check your internet connection and try again.",
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Expired/invalid session → hand control back to the auth flow.
    if (res.status === 401 && token && !AUTH_PATHS.some((p) => path.startsWith(p))) {
      onUnauthorized?.();
    }
    const msg = Array.isArray((data as any)?.message)
      ? (data as any).message.join(', ')
      : (data as any)?.message || 'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

export interface AuthUser {
  id: string;
  mobile: string;
  name: string | null;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

/** A service ranked by real booking count (consumer "Popular" section). */
export interface PopularService extends ServiceItem {
  bookingCount: number;
}

/** V2 banners — only banners that are live today (IST) come back. */
export type BannerPlacement = 'home' | 'category' | 'promo';
export interface BannerItem {
  id: string;
  placement: BannerPlacement;
  category: string;
  imageDesktop: string;
  /** Phone image (falls back to the desktop image on the server). */
  imageMobile: string;
  alt: string;
  linkType: 'none' | 'service' | 'category' | 'external';
  linkValue: string;
}

export interface AppContentConfig {
  /** Emergency helpline; empty = hide the button. */
  helplineNumber: string;
  /** Keep the built-in home banner in the slider alongside uploaded ones. */
  showDefaultHomeBanner: boolean;
  /** WhatsApp chat number set in admin (91XXXXXXXXXX); empty = hidden. */
  whatsappNumber?: string;
}

export interface Booking {
  id: string;
  orderNumber: string;
  items: { name: string; price: number }[];
  scheduledDate: string;
  timeSlot: string;
  address: string;
  totalAmount: number;
  advanceAmount: number;
  advancePaid: boolean;
  status: string;
  assignedWorkerName?: string | null;
  remainingDue?: number;
  finalPayment?: {
    walletPaid: number;
    cashPaid: number;
    onlinePaid: number;
    settled: boolean;
  };
}

export interface Profile {
  id: string;
  mobile: string;
  name: string | null;
  address: string;
  pincode: string;
}

export interface WalletTxn {
  id: string;
  type: 'topup' | 'debit' | 'refund';
  amount: number;
  balanceAfter: number | null;
  description: string;
  at: string;
}

export interface WalletState {
  balance: number;
  history: WalletTxn[];
}

/* ── V2: password login + Vendor mode ──────────────────────────────────── */

export interface CustomerSession {
  accessToken: string;
  user: AuthUser;
  hasPassword: boolean;
}

export interface VendorSession {
  accessToken: string;
  partner: { id: string; name: string; username: string };
}

export type VendorDocType = 'aadhaar' | 'driving_licence' | 'electricity_bill' | 'other';

export interface VendorDocument {
  id: string;
  type: VendorDocType;
  typeLabel: string;
  uploadedAt: string | null;
  viewUrl: string;
}

export interface VendorProfile {
  id: string;
  name: string;
  username: string;
  contactNumber: string;
  area: string;
  services: string[];
  photoUrl: string;
  documents: VendorDocument[];
  planName: string;
  planExpiresAt: string | null;
  planActive: boolean;
}

export interface VendorOrder {
  orderNumber: string;
  services: string[];
  scheduledDate: string;
  timeSlot: string;
  address: string;
  pincode?: string;
  /** Customer's pin / looked-up address — for "Directions". */
  location?: { lat: number; lng: number } | null;
  status: string;
  value: number;
  createdAt: string;
}

/** V2 maps (OpenStreetMap). */
export interface GeoPlace {
  lat: number;
  lng: number;
  label: string;
}
export interface BookingTracking {
  orderNumber: string;
  status: string;
  address: string;
  home: { lat: number; lng: number; source?: string } | null;
  /** Positions are shared only while the job is In Progress. */
  sharing: boolean;
  assignedNames: string[];
  partners: { name: string; lat: number; lng: number; at: string; distanceKm: number | null }[];
}

export interface RechargePlan {
  id: string;
  name: string;
  months: number;
  price: number;
}

export interface RechargeOverview {
  planName: string;
  planExpiresAt: string | null;
  planActive: boolean;
  plans: RechargePlan[];
  history: {
    id: string;
    planName: string;
    months: number;
    amount: number;
    paidAt: string | null;
    validUntil: string | null;
  }[];
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  type?: 'authenticated';
  uploadUrl: string;
}

export interface CreateBookingResult {
  booking: Booking;
  payment: {
    required: boolean;
    provider?: 'razorpay' | 'test';
    razorpayOrderId?: string;
    keyId?: string;
    amount?: number;
    paidVia?: 'wallet';
  };
}

export const api = {
  requestOtp: (mobile: string) =>
    req<{ message: string; devOtp?: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    }),

  verifyOtp: (mobile: string, code: string) =>
    req<CustomerSession>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ mobile, code }),
    }),

  // ---- V2: customer password login ----
  customerLogin: (identifier: string, password: string) =>
    req<CustomerSession>('/auth/customer/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  passwordStatus: (token: string) =>
    req<{ hasPassword: boolean; username: string }>('/auth/customer/password', {}, token),
  setPassword: (token: string, password: string, username?: string) =>
    req<{ hasPassword: boolean; username: string }>(
      '/auth/customer/password',
      { method: 'PUT', body: JSON.stringify({ password, username }) },
      token,
    ),

  // ---- V2: Vendor login + switching ----
  vendorLogin: (identifier: string, password: string) =>
    req<VendorSession>('/auth/vendor/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  vendorAvailable: (token: string) =>
    req<{ available: boolean; name: string | null }>('/auth/vendor/available', {}, token),
  switchToVendor: (token: string) =>
    req<VendorSession>('/auth/vendor/switch', { method: 'POST' }, token),
  switchToCustomer: (token: string) =>
    req<CustomerSession>('/auth/customer/switch', { method: 'POST' }, token),

  // ---- V2: Vendor app ----
  vendorProfile: (token: string) => req<VendorProfile>('/vendor/profile', {}, token),
  vendorOrders: (token: string) => req<VendorOrder[]>('/partner/orders', {}, token),
  vendorUploadSignature: (token: string, kind: 'photo' | 'document') =>
    req<UploadSignature>(
      '/vendor/upload/signature',
      { method: 'POST', body: JSON.stringify({ kind }) },
      token,
    ),
  vendorSetPhoto: (token: string, url: string) =>
    req<VendorProfile>('/vendor/photo', { method: 'PATCH', body: JSON.stringify({ url }) }, token),
  vendorAddDocument: (
    token: string,
    dto: { type: VendorDocType; label?: string; publicId: string; format: string },
  ) =>
    req<VendorProfile>('/vendor/documents', { method: 'POST', body: JSON.stringify(dto) }, token),
  vendorRemoveDocument: (token: string, id: string) =>
    req<VendorProfile>(`/vendor/documents/${id}`, { method: 'DELETE' }, token),
  vendorRecharge: (token: string) => req<RechargeOverview>('/vendor/recharge', {}, token),
  vendorRechargeOrder: (token: string, planId: string) =>
    req<{
      paymentId: string;
      payment: {
        required: boolean;
        provider: 'razorpay' | 'test';
        razorpayOrderId?: string;
        keyId?: string;
        amount: number;
      };
    }>('/vendor/recharge/order', { method: 'POST', body: JSON.stringify({ planId }) }, token),
  vendorRechargeVerify: (
    token: string,
    payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) =>
    req<RechargeOverview>(
      '/vendor/recharge/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  vendorRechargeTestConfirm: (token: string, paymentId: string) =>
    req<RechargeOverview>(
      '/vendor/recharge/test-confirm',
      { method: 'POST', body: JSON.stringify({ paymentId }) },
      token,
    ),

  me: (token: string) =>
    req<{ role: string; user: AuthUser }>('/auth/me', {}, token),

  listServices: (pincode: string, search: string) =>
    req<ServiceItem[]>(
      `/services?pincode=${encodeURIComponent(pincode)}${
        search ? `&search=${encodeURIComponent(search)}` : ''
      }`,
    ),

  listPopular: (pincode: string) =>
    req<PopularService[]>(`/services/popular?pincode=${encodeURIComponent(pincode)}`),

  // Full active catalogue (no pincode filter) — used to reconcile a saved cart
  // against what still exists. Only ids are needed here.
  listCatalog: () => req<{ id: string }[]>('/services/catalog'),

  // V2 maps (OpenStreetMap, via our backend — no API key).
  geoSearch: (token: string, q: string) =>
    req<GeoPlace[]>(`/geo/search?q=${encodeURIComponent(q)}`, {}, token),
  bookingTracking: (token: string, bookingId: string) =>
    req<BookingTracking>(`/bookings/${bookingId}/tracking`, {}, token),
  /** Vendor phone position — kept by the server only while a job is In Progress. */
  vendorLocation: (token: string, lat: number, lng: number) =>
    req<{ sharing: boolean; orders: string[] }>(
      '/vendor/location',
      { method: 'POST', body: JSON.stringify({ lat, lng }) },
      token,
    ),

  // V2 content (public, no login): banners set by the admin + helpline number.
  listBanners: (placement: BannerPlacement, category?: string) =>
    req<BannerItem[]>(
      `/content/banners?placement=${placement}${
        category ? `&category=${encodeURIComponent(category)}` : ''
      }`,
    ),
  contentConfig: () => req<AppContentConfig>('/content/config'),

  createBooking: (
    token: string,
    payload: {
      serviceIds: string[];
      scheduledDate: string;
      timeSlot: string;
      address: string;
      pincode?: string;
      advanceMethod?: 'razorpay' | 'wallet';
      /** V2: optional map pin for the home (OpenStreetMap). */
      lat?: number;
      lng?: number;
    },
  ) =>
    req<CreateBookingResult>(
      '/bookings',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // Test-mode advance confirmation (dev only — live uses Razorpay checkout).
  testConfirm: (token: string, bookingId: string) =>
    req<Booking>(
      '/payments/test-confirm',
      { method: 'POST', body: JSON.stringify({ bookingId }) },
      token,
    ),

  // Hand Razorpay's checkout result to the server, which verifies the
  // signature before confirming the booking.
  verifyPayment: (
    token: string,
    payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) =>
    req<Booking>(
      '/payments/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  myBookings: (token: string) => req<Booking[]>('/bookings/mine', {}, token),

  // ---- Wallet (Phase 4) ----
  getWallet: (token: string) => req<WalletState>('/wallet', {}, token),

  topupWallet: (token: string, amount: number) =>
    req<{
      transactionId: string;
      payment: {
        required: boolean;
        provider?: 'razorpay' | 'test';
        razorpayOrderId?: string;
        keyId?: string;
        amount?: number;
      };
    }>(
      '/wallet/topup',
      { method: 'POST', body: JSON.stringify({ amount }) },
      token,
    ),

  // Verify a wallet top-up paid through Razorpay checkout (server-side HMAC check).
  verifyTopup: (
    token: string,
    payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) =>
    req<{ balance: number }>(
      '/wallet/topup/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // Test-mode top-up confirmation (dev only — live uses Razorpay checkout).
  confirmTopupTest: (token: string, transactionId: string) =>
    req<{ balance: number }>(
      '/wallet/topup/test-confirm',
      { method: 'POST', body: JSON.stringify({ transactionId }) },
      token,
    ),

  // Settle the final balance after service: part/all from wallet, rest cash.
  payFinal: (token: string, bookingId: string, walletAmount: number) =>
    req<Booking>(
      `/bookings/${bookingId}/final-payment`,
      { method: 'POST', body: JSON.stringify({ walletAmount }) },
      token,
    ),

  // ---- Profile (Phase 5) ----
  getProfile: (token: string) => req<Profile>('/users/me', {}, token),

  updateProfile: (
    token: string,
    dto: { name?: string; address?: string; pincode?: string },
  ) =>
    req<Profile>(
      '/users/me',
      { method: 'PATCH', body: JSON.stringify(dto) },
      token,
    ),
};
