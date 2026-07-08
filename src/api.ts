/**
 * Thin API client for the MV Cleaning backend.
 * Base URL comes from EXPO_PUBLIC_API_URL (see .env.example).
 * NOTE: on a physical device, localhost won't resolve — use your PC's LAN IP.
 */
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function req<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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
}

export interface CreateBookingResult {
  booking: Booking;
  payment: {
    required: boolean;
    provider?: 'razorpay' | 'test';
    razorpayOrderId?: string;
    keyId?: string;
    amount?: number;
  };
}

export const api = {
  requestOtp: (mobile: string) =>
    req<{ message: string }>('/auth/otp/request', {
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

  createBooking: (
    token: string,
    payload: {
      serviceIds: string[];
      scheduledDate: string;
      timeSlot: string;
      address: string;
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
};
