import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { KeyRound } from 'lucide-react-native';

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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <KeyRound color={theme.colors.primary600} size={32} />
        </View>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {mobile}</Text>
      </View>

      <View style={styles.form}>
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
            style={styles.hiddenInput}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: theme.spacing[16],
    paddingHorizontal: theme.spacing[6],
    alignItems: 'center',
    marginBottom: theme.spacing[8],
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.radius['2xl'],
    backgroundColor: theme.colors.primary50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing[6],
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes['2xl'],
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: theme.spacing[6],
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[6],
    position: 'relative',
  },
  otpBox: {
    width: 48,
    height: 56,
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
    borderColor: theme.colors.primary600,
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
