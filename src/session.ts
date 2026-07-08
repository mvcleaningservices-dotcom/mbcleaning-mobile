import * as SecureStore from 'expo-secure-store';

/**
 * Persists the consumer's session token securely on-device, enabling
 * auto-login on subsequent app launches (scope §3.2.1).
 */
const TOKEN_KEY = 'mv_access_token';

export const session = {
  async save(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};
