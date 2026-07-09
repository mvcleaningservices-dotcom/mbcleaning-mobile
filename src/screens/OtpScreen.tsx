import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, TextInput, Pressable, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { KeyRound } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { session } from '../session';

export function OtpScreen() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
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
  const devOtp = route.params?.devOtp;

  const verify = async () => {
    if (code.length !== 6) return Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP');
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
  changeNumber: {
    marginTop: theme.spacing[6],
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
