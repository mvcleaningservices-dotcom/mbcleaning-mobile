import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, AuthUser } from './src/api';
import { session } from './src/session';

type Screen = 'loading' | 'mobile' | 'otp' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-login: on launch, try the stored token (scope §3.2.1).
  useEffect(() => {
    (async () => {
      const token = await session.get();
      if (!token) return setScreen('mobile');
      try {
        const me = await api.me(token);
        setUser(me.user);
        setScreen('home');
      } catch {
        await session.clear();
        setScreen('mobile');
      }
    })();
  }, []);

  const sendOtp = async () => {
    setBusy(true);
    try {
      await api.requestOtp(mobile.trim());
      setScreen('otp');
    } catch (e: any) {
      Alert.alert('Could not send OTP', e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await api.verifyOtp(mobile.trim(), code.trim());
      await session.save(res.accessToken);
      setUser(res.user);
      setScreen('home');
    } catch (e: any) {
      Alert.alert('Verification failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await session.clear();
    setUser(null);
    setMobile('');
    setCode('');
    setScreen('mobile');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.brand}>MV Cleaning Services</Text>

      {screen === 'loading' && <ActivityIndicator size="large" />}

      {screen === 'mobile' && (
        <View style={styles.card}>
          <Text style={styles.label}>Enter your mobile number</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="10-digit mobile"
            value={mobile}
            onChangeText={setMobile}
            maxLength={10}
          />
          <Button title={busy ? 'Sending…' : 'Send OTP'} onPress={sendOtp} disabled={busy} />
        </View>
      )}

      {screen === 'otp' && (
        <View style={styles.card}>
          <Text style={styles.label}>Enter the 6-digit OTP sent to {mobile}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="6-digit OTP"
            value={code}
            onChangeText={setCode}
            maxLength={6}
          />
          <Button title={busy ? 'Verifying…' : 'Verify & Login'} onPress={verify} disabled={busy} />
          <TouchableOpacity onPress={() => setScreen('mobile')}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'home' && user && (
        <View style={styles.card}>
          <Text style={styles.label}>You're logged in ✓</Text>
          <Text>Mobile: {user.mobile}</Text>
          <View style={{ height: 16 }} />
          <Button title="Logout" onPress={logout} color="#b00" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: { fontSize: 22, fontWeight: '700', color: '#1f6feb', marginBottom: 32 },
  card: { width: '100%', maxWidth: 360, gap: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  link: { color: '#1f6feb', textAlign: 'center', marginTop: 8 },
});
