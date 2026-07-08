/**
 * Thin API client for the MV Cleaning backend.
 * Base URL comes from EXPO_PUBLIC_API_URL (see .env.example).
 * NOTE: on a physical device, localhost won't resolve — use your PC's LAN IP.
 */
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || 'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthorized');
  return (await res.json()) as T;
}

export interface AuthUser {
  id: string;
  mobile: string;
  name: string | null;
}

export const api = {
  requestOtp: (mobile: string) =>
    post<{ message: string }>('/auth/otp/request', { mobile }),

  verifyOtp: (mobile: string, code: string) =>
    post<{ accessToken: string; user: AuthUser }>('/auth/otp/verify', {
      mobile,
      code,
    }),

  me: (token: string) =>
    get<{ role: string; user: AuthUser }>('/auth/me', token),
};
