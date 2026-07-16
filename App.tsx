import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import { OfflineBanner } from './src/components/OfflineBanner';
import { CartProvider } from './src/cart/CartContext';
import { ServiceDetailProvider } from './src/detail/ServiceDetailContext';
import { ServiceDetailSheet } from './src/components/ServiceDetailSheet';
import { View, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { theme } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary600} />
      </View>
    );
  }

  const app = (
    <SafeAreaProvider>
      <ToastProvider>
        {/* Cart wraps the navigator: every screen can add to it, and it must
            outlive any single screen (it used to live in ServicesScreen state). */}
        <CartProvider>
          <ServiceDetailProvider>
            <StatusBar style="auto" />
            {/* Overlays every screen — connectivity loss isn't screen-specific. */}
            <OfflineBanner />
            <RootNavigator />
            {/* One sheet instance, opened from any service card on any screen. */}
            <ServiceDetailSheet />
          </ServiceDetailProvider>
        </CartProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );

  // Web-only: frame the app at phone width and center it on a soft backdrop so
  // desktop reviewers see a device-like mockup instead of an edge-to-edge
  // stretch. Gated on Platform.OS === 'web' — the native iOS/Android build is
  // completely unaffected (no width cap there).
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webBackdrop}>
        <View style={styles.webFrame}>{app}</View>
      </View>
    );
  }

  return app;
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    ...theme.shadows.lg,
  },
});
