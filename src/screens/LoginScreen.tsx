import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Phone } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { alertDialog } from '../dialog';
import { api } from '../api';
import { session } from '../session';

export function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigation = useNavigation<any>();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Auto-login logic
  useEffect(() => {
    (async () => {
      const t = await session.getToken();
      if (!t) {
        setCheckingAuth(false);
        return;
      }
      try {
        await api.me(t); // validates the stored token; throws if invalid
        // They have a valid token, resolve pincode
        let pin = '';
        try {
          const p = await api.getProfile(t);
          pin = p.pincode || (await session.getPincode()) || '';
        } catch {
          pin = (await session.getPincode()) || '';
        }
        
        if (pin) await session.savePincode(pin);
        // MV Cleaning is consumer-only — always land in the customer app.
        // (Pincode selection is handled inside the customer app if unset.)
        navigation.replace('CustomerApp');
      } catch {
        await session.clear();
        setCheckingAuth(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!checkingAuth) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [checkingAuth, fadeAnim, slideAnim]);

  const sendOtp = async () => {
    if (mobile.length !== 10) return alertDialog('Invalid number', 'Please enter a 10-digit mobile number');
    setBusy(true);
    try {
      const res = await api.requestOtp(mobile.trim());
      navigation.navigate('Otp', { mobile: mobile.trim(), devOtp: res.devOtp });
    } catch (e: any) {
      toast.error(e.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  if (checkingAuth) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary600 }]}>
        <StatusBar style="light" />
        {/* Auto-login check — brief, but it's the very first thing a returning
            user sees, so it shows the brand rather than a generic sparkle. */}
        <Image
          source={require('../../assets/logo_white.png')}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="MV Cleaning Services"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.topTealPanel, { paddingTop: insets.top + theme.spacing[10] }]}>
        {/* The real logo, not a generic sparkle icon — this is the first screen a
            customer sees. White knockout because the panel is primary-600, where
            the colour mark (which IS that blue) would disappear. */}
        <Image
          source={require('../../assets/logo_white.png')}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="MV Cleaning Services"
        />
        <Text style={styles.title}>Welcome to MV Cleaning</Text>
        <Text style={styles.subtitle}>Enter your mobile number to log in or create an account.</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[
          styles.card, 
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }
        ]}>
          <Input
            label="Mobile Number"
            placeholder="10-digit mobile"
            keyboardType="phone-pad"
            maxLength={10}
            value={mobile}
            onChangeText={setMobile}
            leftIcon={<Phone size={20} color={theme.colors.textMuted} />}
          />
          <Button 
            title="Continue" 
            onPress={sendOtp} 
            loading={busy}
            disabled={mobile.length < 10}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topTealPanel: {
    backgroundColor: theme.colors.primary600,
    paddingBottom: 100,
    paddingHorizontal: theme.spacing[6],
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
    marginTop: -60, // Create overlap with the teal panel
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing[6],
    padding: theme.spacing[6],
    borderRadius: theme.radius.xl,
    ...theme.shadows.lg,
  },
  brandLogo: {
    width: 190,
    height: 56,
    marginBottom: theme.spacing[4],
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes['2xl'],
    color: theme.colors.textInverse,
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.8)', // white with 80% opacity for slight muting
    textAlign: 'center',
  },
});
