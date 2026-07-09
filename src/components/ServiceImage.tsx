import React, { useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { theme } from '../theme';
import { localServiceImage } from './serviceImages';

/**
 * A service's image, resolved in priority order:
 *   1. `uri` — an admin-set remote image URL (wins when present & loads).
 *   2. a bundled image matched to the service `name` (see serviceImages.ts).
 *   3. an on-brand icon tile (only if even the generic bundled image is missing).
 *
 * Shared by the Home grid, Services list and Checkout summary so imagery looks
 * identical everywhere.
 */
export function ServiceImage({
  uri,
  name,
  iconSize = 22,
  style,
}: {
  uri?: string;
  name?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle & ImageStyle>;
}) {
  const [broken, setBroken] = useState(false);

  if (uri && !broken) {
    return (
      <Image
        source={{ uri }}
        onError={() => setBroken(true)}
        resizeMode="cover"
        style={style as StyleProp<ImageStyle>}
      />
    );
  }

  const local = localServiceImage(name);
  if (local) {
    return <Image source={local} resizeMode="cover" style={style as StyleProp<ImageStyle>} />;
  }

  return (
    <View style={[styles.fallback, style]}>
      <Sparkles size={iconSize} color={theme.colors.primary300} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: theme.colors.primary50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
