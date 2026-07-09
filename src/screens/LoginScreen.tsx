import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, Phone } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { session } from '../session';

export function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigation = useNavigation<any>();
  const toast = useToast();

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

  const sendOtp = async () => {
    if (mobile.length !== 10) return Alert.alert('Invalid number', 'Please enter a 10-digit mobile number');
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Sparkles color={theme.colors.primary600} size={48} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Sparkles color={theme.colors.primary600} size={32} />
        </View>
        <Text style={styles.title}>Welcome to MV Cleaning</Text>
        <Text style={styles.subtitle}>Enter your mobile number to log in or create an account.</Text>
      </View>

      <View style={styles.form}>
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
});
