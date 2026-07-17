import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Button } from './Button';
import { useCart } from '../cart/CartContext';

/**
 * Sticky cart summary — the mobile counterpart to web's CartBar.
 *
 * Without this, adding from the Home screen is a dead end: the card highlights
 * but nothing tells the user what's in the cart or how to check out.
 *
 * Positioning: `bottom: 0` is correct on BOTH tab screens and pushed stack
 * screens. The tab bar is not absolutely positioned (see RootNavigator), so it
 * occupies real layout space and React Navigation already ends the screen above
 * it — offsetting by the tab bar's height as well would push the bar into the
 * middle of the screen. Safe-area insets are likewise handled by the tab bar
 * itself; on stack screens we add them here since there's no tab bar to do it.
 */
export function CartBar({ inTabScreen = false }: { inTabScreen?: boolean }) {
  const { count, total } = useCart();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  if (count === 0) return null;

  const bottom = inTabScreen ? 0 : insets.bottom;

  return (
    <View style={[styles.bar, { bottom }]}>
      <View style={styles.info}>
        <Text style={styles.count}>
          {count} {count === 1 ? 'service' : 'services'}
        </Text>
        <Text style={styles.total}>₹{total}</Text>
      </View>
      <Button
        title="Continue"
        onPress={() => navigation.navigate('Checkout')}
        style={{ paddingHorizontal: theme.spacing[8] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  info: { flex: 1 },
  count: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  total: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
  },
});
