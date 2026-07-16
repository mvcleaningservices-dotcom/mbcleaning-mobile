import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Navigation handle usable from outside React components.
 *
 * Needed so the API layer can send an expired session back to the auth flow —
 * it has no access to hooks or component state.
 */
export const navigationRef = createNavigationContainerRef();

/** Reset to the auth flow, discarding history so Back can't re-enter the app. */
export function resetToAuth() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Auth' as never }] });
  }
}
