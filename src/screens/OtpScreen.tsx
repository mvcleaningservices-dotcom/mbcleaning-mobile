import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, Pressable, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { KeyRound } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { alertDialog } from '../dialog';
import { api } from '../api';
import { session } from '../session';

/** Seconds a user must wait between OTP resends. The backend throttles OTP
 *  requests to 3/60s, so a shorter cooldown would just earn them a 429. */
const RESEND_COOLDOWN_SECONDS = 30;

export function OtpScreen() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Start on cooldown: an OTP was just sent to get the user to this screen.
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
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
  }, [fadeAnim, slideAnim]);

  const mobile = route.params?.mobile || '';
  // Held in state, not read straight from params, so a resend can surface the
  // NEW dev code rather than keep showing the stale one.
  const [devOtp, setDevOtp] = useState<string | undefined>(route.params?.devOtp);

  // Resend cooldown countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /**
   * Re-request the OTP. Previously this screen had no resend at all: if the SMS
   * was delayed or lost — routine in India — the user's only recovery was to
   * kill the app and start over, at the narrowest point in the funnel.
   */
  const resend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    try {
      const res = await api.requestOtp(mobile);
      setDevOtp(res.devOtp);
      setCode('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      inputRef.current?.focus();
      toast.success(`New code sent to ${mobile}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) return alertDialog('Invalid OTP', 'Please enter a 6-digit OTP');
    setBusy(true);
    try {
      const res = await api.verifyOtp(mobile, code.trim());
      await session.saveToken(res.accessToken);
      
      // Attempt to load pincode
      let pin = '';
      try {
        const p = await api.getProfile(res.accessToken);
        pin = p.pincode || (await session.getPincode()) || '';
      } catch {
        pin = (await session.getPincode()) || '';
      }
      
      if (pin) await session.savePincode(pin);

      // MV Cleaning is a consumer-only app — no worker/vendor role here.
      navigation.replace('CustomerApp');
    } catch (e: any) {
      toast.error(e.message || 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.topTealPanel, { paddingTop: insets.top + theme.spacing[10] }]}>
        <View style={styles.iconContainer}>
          <KeyRound color={theme.colors.primary600} size={32} />
        </View>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {mobile}</Text>
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
          {devOtp && (
            <View style={styles.devHint}>
              <Text style={styles.devHintText}>Dev mode: OTP is {devOtp}</Text>
            </View>
          )}
          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < code.length;
              const active = i === code.length;
              return (
                <View key={i} style={[styles.otpBox, filled && styles.otpBoxFilled, active && styles.otpBoxActive]}>
                  <Text style={styles.otpDigit}>{code[i] ?? ''}</Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              /* SMS autofill. Without these the app that RECEIVES the SMS made the
                 user read and retype the code, while the website autofilled it —
                 iOS needs textContentType, Android needs autoComplete. */
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              importantForAutofill="yes"
              style={[styles.hiddenInput, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
              caretHidden
            />
          </Pressable>
          <Button
            title="Verify & Login"
            onPress={verify}
            loading={busy}
            disabled={code.length < 6}
          />

          {/* Resend — the recovery path when the SMS never arrives. */}
          <TouchableOpacity
            style={styles.resend}
            onPress={resend}
            disabled={resendIn > 0 || resending}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendIn > 0 || resending }}
            accessibilityLabel={
              resendIn > 0 ? `Resend code available in ${resendIn} seconds` : 'Resend code'
            }
          >
            <Text style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
              {resending
                ? 'Sending…'
                : resendIn > 0
                  ? `Didn't get the code? Resend in ${resendIn}s`
                  : "Didn't get the code? Resend"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.changeNumber} onPress={() => navigation.goBack()}>
            <Text style={styles.changeNumberText}>Change mobile number</Text>
          </TouchableOpacity>
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
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.radius['2xl'],
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing[6],
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
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[6],
    position: 'relative',
    gap: theme.spacing[1], // Prevent boxes from touching when flexible
  },
  otpBox: {
    flex: 1, // Fix overflow: flexibly fill width instead of fixed 48px
    height: 50, // Slightly reduced height to match flexible width
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxFilled: {
    borderColor: theme.colors.primary600,
  },
  otpBoxActive: {
    borderColor: theme.colors.borderFocus, // Matched with Input focus state
    backgroundColor: theme.colors.primary50,
  },
  otpDigit: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes['2xl'],
    color: theme.colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  resend: {
    marginTop: theme.spacing[5],
    alignItems: 'center',
    // Generous vertical padding keeps this a comfortable touch target even
    // though the label itself is a single line of text.
    paddingVertical: theme.spacing[2],
  },
  resendText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary600,
  },
  resendTextDisabled: {
    color: theme.colors.textMuted,
  },
  changeNumber: {
    marginTop: theme.spacing[3],
    alignItems: 'center',
  },
  changeNumberText: {
    color: theme.colors.primary600,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
  },
  devHint: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing[3],
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing[4],
  },
  devHintText: {
    color: theme.colors.warningText,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.medium,
  },
});
