import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme';
import type { BannerItem } from '../api';

/** Phone banners are uploaded at 1200 × 500 px (see admin → Banners). */
const ASPECT = 500 / 1200;
const AUTO_MS = 5000;

/**
 * Admin-managed banners (client V2). One banner shows on its own; several
 * slide (swipe, or auto every 5 s). `leading` is an optional built-in slide
 * shown first — the Home screen passes its default banner here.
 */
export function BannerSlider({
  banners,
  leading,
  onPress,
  style,
}: {
  banners: BannerItem[];
  leading?: React.ReactNode;
  onPress: (b: BannerItem) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  const count = banners.length + (leading ? 1 : 0);
  const height = Math.round(width * ASPECT);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = () => {
    stop();
    if (count < 2 || !width) return;
    timer.current = setInterval(() => {
      const next = (indexRef.current + 1) % count;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, AUTO_MS);
  };

  // (Re)start autoplay when the size or the number of slides changes.
  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
    start();
    return stop;
    // start/stop only read refs + these two values, so they're not deps.
  }, [count, width]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    indexRef.current = i;
    setIndex(i);
    start(); // restart the 5 s wait after a manual swipe
  };

  if (count === 0) return null;

  return (
    <View style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={stop}
          onMomentumScrollEnd={onMomentumEnd}
          style={[styles.track, { height }]}
        >
          {leading ? <View style={{ width, height }}>{leading}</View> : null}
          {banners.map((b) => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={b.linkType === 'none' ? 1 : 0.9}
              disabled={b.linkType === 'none'}
              onPress={() => onPress(b)}
              accessibilityRole={b.linkType === 'none' ? 'image' : 'button'}
              accessibilityLabel={b.alt}
              style={{ width, height }}
            >
              <Image
                source={{ uri: b.imageMobile || b.imageDesktop }}
                resizeMode="cover"
                style={styles.image}
                accessibilityIgnoresInvertColors
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {count > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: theme.radius.xl, overflow: 'hidden', backgroundColor: theme.colors.primary50 },
  image: { width: '100%', height: '100%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: theme.spacing[2] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  dotActive: { width: 16, backgroundColor: theme.colors.primary600 },
});
