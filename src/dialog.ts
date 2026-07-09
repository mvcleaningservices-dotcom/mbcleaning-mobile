import { Alert, Platform } from 'react-native';

/**
 * Cross-platform dialogs. React Native's `Alert` is a no-op on react-native-web,
 * so on web we fall back to the browser's native confirm()/alert(). On iOS and
 * Android we use the real `Alert`.
 */

export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', destructive } = opts;

  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title);
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function alertDialog(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
