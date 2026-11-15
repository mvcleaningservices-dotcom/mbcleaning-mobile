import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Animated, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, Lock, Briefcase } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { PasswordEye } from '../components/PasswordEye';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { alertDialog } from '../dialog';
import { api } from '../api';
import { session } from '../session';

type Mode = 'customer' | 'vendor';

/** A bare 10-digit Indian mobile (also accepts +91 / 91 prefixes). */
const asMobile = (v: string) => {
  const d = v.replace(/\D/g, '');
  const m = d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
  return /^[6-9]\d{9}$/.test(m) ? m : null;
};

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('customer');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'login' | 'otp' | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigation = useNavigation<any>();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Auto-login: resume whichever side (customer / vendor) was last used.
  useEffect(() => {
    (async () => {
      const t = await session.getToken();
      if (!t) {
        setCheckingAuth(false);
        return;
      }
      try {
        if ((await session.getKind()) === 'vendor') {
          await api.vendorProfile(t); // validates the vendor token
          navigation.replace('VendorApp');
          return;
        }
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

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword('');
  };

  /** Customer: land in the app, carrying over the saved pincode. */
  const enterCustomerApp = async (token: string) => {
    await session.saveSession(token, 'customer');
    try {
      const p = await api.getProfile(token);
      const pin = p.pincode || (await session.getPincode()) || '';
      if (pin) await session.savePincode(pin);
    } catch {
      /* pincode is optional here */
    }
    navigation.replace('CustomerApp');
  };

  const passwordLogin = async () => {
    if (!identifier.trim() || !password) {
      return alertDialog('Missing details', 'Enter your mobile number or username, and your password.');
    }
    setBusy('login');
    try {
      if (mode === 'vendor') {
        const res = await api.vendorLogin(identifier.trim(), password);
        await session.saveSession(res.accessToken, 'vendor');
        navigation.replace('VendorApp');
      } else {
        const res = await api.customerLogin(identifier.trim(), password);
        await enterCustomerApp(res.accessToken);
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not log in');
    } finally {
      setBusy(null);
    }
  };

  /** OTP is used for new customers, customers without a password, and resets. */
  const continueWithOtp = async (purpose: 'login' | 'reset') => {
    const mobile = asMobile(identifier);
    if (!mobile) {
      return alertDialog(
        'Enter your mobile number',
        purpose === 'reset'
          ? 'Type your 10-digit mobile number above and tap "Forgot password?" again — we’ll send you an OTP.'
          : 'Type your 10-digit mobile number above to get an OTP.',
      );
    }
    setBusy('otp');
    try {
      const res = await api.requestOtp(mobile);
      navigation.navigate('Otp', { mobile, devOtp: res.devOtp, purpose });
    } catch (e: any) {
      toast.error(e.message || 'Could not send OTP');
    } finally {
      setBusy(null);
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

  const isVendor = mode === 'vendor';

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
        <Text style={styles.title}>{isVendor ? 'Vendor login' : 'Welcome to MV Cleaning'}</Text>
        <Text style={styles.subtitle}>
          {isVendor
            ? 'Log in with the details MV Cleaning gave you.'
            : 'Log in with your password, or continue with an OTP.'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Bottom space includes the phone's navigation bar, so the last line
            is never hidden behind the system buttons. */}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: theme.spacing[8] + insets.bottom }}>
          <Animated.View style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}>
            {/* Customer / Vendor — the dedicated "Login as Vendor" entry point. */}
            <View style={styles.segment} accessibilityRole="tablist">
              {(['customer', 'vendor'] as const).map((m) => {
                const sel = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.segmentBtn, sel && styles.segmentBtnSel]}
                    onPress={() => switchMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: sel }}
                    activeOpacity={0.8}
                  >
                    {m === 'vendor' && <Briefcase size={15} color={sel ? theme.colors.textInverse : theme.colors.textSecondary} />}
                    {/* Fits its half on every phone, including phones set to
                        large text: one line normally, two only when very tight. */}
                    <Text
                      style={[styles.segmentText, sel && styles.segmentTextSel]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.3}
                    >
                      {m === 'customer' ? 'Customer' : 'Login as Vendor'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Mobile number or username"
              placeholder="10-digit mobile or username"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
              leftIcon={<User size={20} color={theme.colors.textMuted} />}
            />
            <Input
              label="Password"
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={passwordLogin}
              leftIcon={<Lock size={20} color={theme.colors.textMuted} />}
              rightAccessory={<PasswordEye shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
            {!isVendor && (
              <View style={[styles.row, { justifyContent: 'flex-end' }]}>
                <TouchableOpacity onPress={() => continueWithOtp('reset')} disabled={!!busy} accessibilityRole="button">
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            )}

            <Button
              title={isVendor ? 'Log in as Vendor' : 'Log in'}
              onPress={passwordLogin}
              loading={busy === 'login'}
              disabled={!!busy || !identifier.trim() || !password}
            />

            {isVendor ? (
              <Text style={styles.hint}>
                Forgot your vendor login? Please contact the MV Cleaning office.
              </Text>
            ) : (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <Button
                  title="Continue with OTP"
                  variant="secondary"
                  onPress={() => continueWithOtp('login')}
                  loading={busy === 'otp'}
                  disabled={!!busy}
                />
                <Text style={styles.hint}>
                  New customer, or haven't set a password yet? Enter your mobile number and continue with OTP.
                </Text>
              </>
            )}
          </Animated.View>
        </ScrollView>
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
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
    padding: 4,
    marginBottom: theme.spacing[5],
  },
  segmentBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing[2] + 2,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.radius.md,
  },
  segmentBtnSel: { backgroundColor: theme.colors.primary600 },
  segmentText: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  segmentTextSel: { color: theme.colors.textInverse },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -theme.spacing[1],
    marginBottom: theme.spacing[5],
  },
  link: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary600,
    paddingVertical: theme.spacing[1],
  },
  linkMuted: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing[1],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginVertical: theme.spacing[4],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  hint: {
    marginTop: theme.spacing[3],
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
