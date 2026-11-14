import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Lock, AtSign, ArrowLeft, KeyRound } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { session } from '../session';

type Mode = 'create' | 'reset' | 'change';

const COPY: Record<Mode, { title: string; subtitle: string; button: string }> = {
  create: {
    title: 'Create a password',
    subtitle: 'Next time, log in with your mobile number (or username) and password — no OTP needed.',
    button: 'Save password',
  },
  reset: {
    title: 'Set a new password',
    subtitle: 'Your number is verified. Choose a new password to log in with.',
    button: 'Save new password',
  },
  change: {
    title: 'Login & password',
    subtitle: 'Change your password or username.',
    button: 'Save changes',
  },
};

/**
 * Customer password (client V2). Reached after OTP sign-up ("create", can be
 * skipped), after "Forgot password" ("reset"), or from Account ("change").
 */
export function SetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const mode: Mode = route.params?.mode ?? 'create';
  const copy = COPY[mode];

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The username on file; null until loaded. An empty username clears it on
  // the server, so "" is only sent once we know what was there.
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);

  // Keep the existing username when resetting/changing.
  useEffect(() => {
    (async () => {
      const t = await session.getToken();
      if (!t) return;
      try {
        const s = await api.passwordStatus(t);
        setLoadedUsername(s.username);
        setUsername((cur) => cur || s.username);
      } catch {
        /* optional */
      }
    })();
  }, []);

  const done = () => {
    if (mode === 'change') navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'CustomerApp' }] });
  };

  const save = async () => {
    setError('');
    const u = username.trim();
    if (u && !/^(?!\d+$)[a-zA-Z0-9._]{3,30}$/.test(u)) {
      return setError('Username: 3–30 letters, numbers, dots or underscores (not only numbers).');
    }
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    const t = await session.getToken();
    if (!t) return setError('Your session has expired. Please log in again.');
    setBusy(true);
    try {
      // Blank box + username not loaded yet → leave the saved username alone.
      await api.setPassword(t, password, u === '' && loadedUsername === null ? undefined : u);
      toast.success(mode === 'create' ? 'Password created.' : 'Password updated.');
      done();
    } catch (e: any) {
      setError(e.message || 'Could not save your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.topPanel, { paddingTop: insets.top + theme.spacing[6] }]}>
        {mode === 'change' && (
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <ArrowLeft size={22} color={theme.colors.textInverse} />
          </TouchableOpacity>
        )}
        <View style={styles.iconContainer}>
          <KeyRound color={theme.colors.primary600} size={30} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1, marginTop: -60 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: theme.spacing[8] }}>
          <View style={styles.card}>
            <Input
              label="Username (optional)"
              placeholder="e.g. priya.k"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              leftIcon={<AtSign size={18} color={theme.colors.textMuted} />}
            />
            <Text style={styles.fieldHint}>You can always log in with your mobile number too.</Text>
            <Input
              label="New password"
              placeholder="At least 6 characters"
              secureTextEntry={!show}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
            />
            <Input
              label="Confirm password"
              placeholder="Type it again"
              secureTextEntry={!show}
              autoCapitalize="none"
              value={confirm}
              onChangeText={setConfirm}
              onSubmitEditing={save}
              leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
            />
            <TouchableOpacity onPress={() => setShow((v) => !v)} style={{ marginBottom: theme.spacing[4] }}>
              <Text style={styles.linkMuted}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
            </TouchableOpacity>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button title={copy.button} onPress={save} loading={busy} disabled={busy} />

            {mode === 'create' && (
              <TouchableOpacity style={styles.skip} onPress={done} disabled={busy}>
                <Text style={styles.linkMuted}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topPanel: {
    backgroundColor: theme.colors.primary600,
    paddingBottom: 100,
    paddingHorizontal: theme.spacing[6],
    alignItems: 'center',
  },
  back: { position: 'absolute', left: theme.spacing[4], top: 0, padding: theme.spacing[2], marginTop: 40 },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.radius['2xl'],
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing[6],
    padding: theme.spacing[6],
    borderRadius: theme.radius.xl,
    ...theme.shadows.lg,
  },
  fieldHint: {
    marginTop: -theme.spacing[2],
    marginBottom: theme.spacing[4],
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  linkMuted: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  error: {
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing[3],
  },
  skip: { alignItems: 'center', marginTop: theme.spacing[4], paddingVertical: theme.spacing[2] },
});
