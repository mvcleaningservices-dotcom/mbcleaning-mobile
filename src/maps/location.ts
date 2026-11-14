import { Linking } from 'react-native';
import type { LatLng } from './OsmMapView';

/**
 * Phone location (client V2). expo-location is a native module added in V2,
 * so it's loaded only when needed — an older installed build still opens
 * normally and only the location button reports that an update is needed.
 * Foreground only: nothing runs when the app is closed.
 */
async function loadLocation() {
  try {
    return await import('expo-location');
  } catch {
    throw new Error('Location needs the latest app version. Please update the app.');
  }
}

/** Ask once (if needed) and read the current position. */
export async function currentPosition(): Promise<LatLng> {
  const Location = await loadLocation();
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Location permission is off. You can search or tap the map instead.');
  }
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

/**
 * Follow the position while the app is open (vendor during a job). Returns a
 * stop function. Throws if permission is refused or the build is too old.
 */
export async function watchPosition(onPosition: (p: LatLng) => void): Promise<() => void> {
  const Location = await loadLocation();
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Location permission is off.');
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 30 },
    (loc) => onPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
  );
  return () => sub.remove();
}

/** Free directions — opens the Google Maps app/site. No API key needed. */
export function openDirections(to: LatLng | null | undefined, addressFallback?: string) {
  const url = to
    ? `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressFallback ?? '')}`;
  void Linking.openURL(url).catch(() => {});
}
