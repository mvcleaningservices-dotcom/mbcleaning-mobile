import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Persists the consumer's session token (auto-login, scope §3.2.1) and pincode
 * (scope §3.2.2 — entered once, reused).
 *
 * Uses expo-secure-store on native (iOS/Android). On web (used for quick dev
 * testing in a browser) SecureStore is unavailable, so it falls back to
 * localStorage.
 */
const TOKEN_KEY = 'mv_access_token';
const PINCODE_KEY = 'mv_pincode';
const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string) {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const session = {
  saveToken: (token: string) => setItem(TOKEN_KEY, token),
  getToken: () => getItem(TOKEN_KEY),
  savePincode: (pincode: string) => setItem(PINCODE_KEY, pincode),
  getPincode: () => getItem(PINCODE_KEY),
  async clear() {
    await removeItem(TOKEN_KEY);
    await removeItem(PINCODE_KEY);
  },
};
