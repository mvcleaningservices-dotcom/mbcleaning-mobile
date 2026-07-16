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
const AUTH_PATHS = ['/auth/otp/request', '/auth/otp/verify'];

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
    req<{ accessToken: string; user: AuthUser }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ mobile, code }),
    }),

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

  createBooking: (
    token: string,
    payload: {
      serviceIds: string[];
      scheduledDate: string;
      timeSlot: string;
      address: string;
      pincode?: string;
      advanceMethod?: 'razorpay' | 'wallet';
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

  myBookings: (token: string) => req<Booking[]>('/bookings/mine', {}, token),

  // ---- Wallet (Phase 4) ----
  getWallet: (token: string) => req<WalletState>('/wallet', {}, token),

  topupWallet: (token: string, amount: number) =>
    req<{ transactionId: string; payment: { required: boolean; provider?: string; amount?: number } }>(
      '/wallet/topup',
      { method: 'POST', body: JSON.stringify({ amount }) },
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
