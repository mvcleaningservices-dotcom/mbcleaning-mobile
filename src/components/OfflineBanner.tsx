import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';

import { theme } from '../theme';

/**
 * Persistent "you're offline" bar.
 *
 * Mobile users lose connectivity constantly (lifts, basements, patchy data) and
 * previously the app gave no indication — requests just failed. This tells them
 * why before they blame the app.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable is null while unknown — only claim offline once
      // NetInfo is actually sure, otherwise the banner flickers on startup.
      const reachable =
        state.isInternetReachable === null ? state.isConnected : state.isInternetReachable;
      setOffline(!reachable);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <WifiOff size={14} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingBottom: 8,
    paddingHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
  },
});
