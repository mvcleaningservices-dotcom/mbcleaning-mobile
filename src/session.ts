import * as SecureStore from 'expo-secure-store';

/**
 * Persists the consumer's session token securely (auto-login, scope §3.2.1)
 * and their pincode (scope §3.2.2 — entered once, reused).
 */
const TOKEN_KEY = 'mv_access_token';
const PINCODE_KEY = 'mv_pincode';

export const session = {
  async saveToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async savePincode(pincode: string) {
    await SecureStore.setItemAsync(PINCODE_KEY, pincode);
  },
  async getPincode(): Promise<string | null> {
    return SecureStore.getItemAsync(PINCODE_KEY);
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PINCODE_KEY);
  },
};
