import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A soft pulsing placeholder shown while content loads. */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius: radius ?? theme.radius.md,
          backgroundColor: theme.colors.shimmer,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** A skeleton shaped like a service/list card. */
export function SkeletonCard() {
  return (
    <Animated.View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing[4],
        marginBottom: theme.spacing[3],
        gap: theme.spacing[3],
      }}
    >
      <Skeleton width="60%" height={18} />
      <Skeleton width="90%" height={13} />
      <Skeleton width="100%" height={36} radius={theme.radius.md} />
    </Animated.View>
  );
}
