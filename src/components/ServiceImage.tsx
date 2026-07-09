import React, { useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { theme } from '../theme';

/**
 * A service's marketing image with a graceful, on-brand fallback for empty or
 * broken URLs. Shared by the Home grid and the Services select list so imagery
 * looks identical everywhere.
 */
export function ServiceImage({
  uri,
  iconSize = 22,
  style,
}: {
  uri?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle & ImageStyle>;
}) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <View style={[styles.fallback, style]}>
        <Sparkles size={iconSize} color={theme.colors.primary300} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setBroken(true)}
      resizeMode="cover"
      style={style as StyleProp<ImageStyle>}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: theme.colors.primary50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
