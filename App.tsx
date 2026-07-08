import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, AuthUser, Booking, ServiceItem } from './src/api';
import { session } from './src/session';

type Screen =
  | 'loading'
  | 'mobile'
  | 'otp'
  | 'pincode'
  | 'services'
  | 'details'
  | 'summary'
  | 'confirmation'
  | 'bookings';

const TIME_SLOTS = [
  '08:00-10:00',
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [, setUser] = useState<AuthUser | null>(null);

  // auth inputs
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');

  // discovery / booking
  const [pincode, setPincode] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, ServiceItem>>({});
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [address, setAddress] = useState('');
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  const [busy, setBusy] = useState(false);

  // ---- Auto-login on launch ----
  useEffect(() => {
    (async () => {
      const t = await session.getToken();
      if (!t) return setScreen('mobile');
      try {
        const me = await api.me(t);
        setToken(t);
        setUser(me.user);
        const savedPin = await session.getPincode();
        if (savedPin) {
          setPincode(savedPin);
          await loadServices(savedPin, '');
          setScreen('services');
        } else {
          setScreen('pincode');
        }
      } catch {
        await session.clear();
        setScreen('mobile');
      }
    })();
  }, []);

  // ---- Auth ----
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
      await session.saveToken(res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);
      const savedPin = await session.getPincode();
      if (savedPin) {
        setPincode(savedPin);
        await loadServices(savedPin, '');
        setScreen('services');
      } else {
        setScreen('pincode');
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await session.clear();
    setToken(null);
    setUser(null);
    setMobile('');
    setCode('');
    setPincode('');
    setSelected({});
    setScreen('mobile');
  };

  // ---- Discovery ----
  const loadServices = async (pin: string, q: string) => {
    const list = await api.listServices(pin, q);
    setServices(list);
  };

  const submitPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      return Alert.alert('Invalid pincode', 'Enter a 6-digit pincode');
    }
    setBusy(true);
    try {
      await session.savePincode(pincode);
      await loadServices(pincode, '');
      setScreen('services');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async (q: string) => {
    setSearch(q);
    try {
      await loadServices(pincode, q);
    } catch {
      /* ignore transient search errors */
    }
  };

  const toggleSelect = (svc: ServiceItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[svc.id]) delete next[svc.id];
      else next[svc.id] = svc;
      return next;
    });
  };

  const selectedList = Object.values(selected);
  const total = selectedList.reduce((s, i) => s + i.price, 0);

  // ---- Booking ----
  const placeBooking = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await api.createBooking(token, {
        serviceIds: selectedList.map((s) => s.id),
        scheduledDate: date,
        timeSlot,
        address: address.trim(),
      });

      let finalBooking = res.booking;

      if (!res.payment.required) {
        // Advance is ₹0 — already confirmed.
      } else if (res.payment.provider === 'test') {
        finalBooking = await api.testConfirm(token, res.booking.id);
      } else if (res.payment.provider === 'razorpay') {
        // Live checkout requires react-native-razorpay + keys (added when going live).
        Alert.alert(
          'Payment',
          'Razorpay checkout opens here in production. Booking saved as pending.',
        );
      }

      setConfirmed(finalBooking);
      setSelected({});
      setDate('');
      setTimeSlot('');
      setAddress('');
      setScreen('confirmation');
    } catch (e: any) {
      Alert.alert('Booking failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const openMyBookings = async () => {
    if (!token) return;
    setBusy(true);
    try {
      setMyBookings(await api.myBookings(token));
      setScreen('bookings');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Render ----
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

      {screen === 'pincode' && (
        <View style={styles.card}>
          <Text style={styles.label}>Enter your area pincode</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="6-digit pincode"
            value={pincode}
            onChangeText={setPincode}
            maxLength={6}
          />
          <Button title={busy ? 'Loading…' : 'Find Services'} onPress={submitPincode} disabled={busy} />
        </View>
      )}

      {screen === 'services' && (
        <View style={styles.flexCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Services in {pincode}</Text>
            <TouchableOpacity onPress={() => setScreen('pincode')}>
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Search services…"
            value={search}
            onChangeText={runSearch}
          />
          <ScrollView style={{ flex: 1 }}>
            {services.length === 0 && (
              <Text style={styles.muted}>No services found for this pincode.</Text>
            )}
            {services.map((s) => {
              const isSel = !!selected[s.id];
              return (
                <Pressable
                  key={s.id}
                  style={[styles.serviceCard, isSel && styles.serviceCardSel]}
                  onPress={() => toggleSelect(s)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{s.name}</Text>
                    <Text style={styles.muted}>{s.description}</Text>
                  </View>
                  <Text style={styles.price}>₹{s.price}</Text>
                  <Text style={styles.check}>{isSel ? '☑' : '☐'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Text style={styles.total}>
              {selectedList.length} selected · ₹{total}
            </Text>
            <Button
              title="Continue"
              onPress={() => setScreen('details')}
              disabled={selectedList.length === 0}
            />
          </View>
          <TouchableOpacity onPress={openMyBookings}>
            <Text style={styles.link}>My Bookings</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'details' && (
        <ScrollView contentContainerStyle={styles.card}>
          <Text style={styles.label}>Schedule & address</Text>
          <Text style={styles.muted}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-07-20"
            value={date}
            onChangeText={setDate}
          />
          <Text style={styles.muted}>Time slot</Text>
          <View style={styles.slots}>
            {TIME_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                style={[styles.slot, timeSlot === slot && styles.slotSel]}
                onPress={() => setTimeSlot(slot)}
              >
                <Text style={timeSlot === slot ? styles.slotTextSel : styles.slotText}>
                  {slot}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>Address</Text>
          <TextInput
            style={[styles.input, { height: 72 }]}
            placeholder="Flat, street, landmark"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Button
            title="Review Booking"
            onPress={() => setScreen('summary')}
            disabled={!date || !timeSlot || address.trim().length < 5}
          />
          <TouchableOpacity onPress={() => setScreen('services')}>
            <Text style={styles.link}>Back to services</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === 'summary' && (
        <ScrollView contentContainerStyle={styles.card}>
          <Text style={styles.label}>Booking summary</Text>
          {selectedList.map((s) => (
            <View key={s.id} style={styles.rowBetween}>
              <Text>{s.name}</Text>
              <Text>₹{s.price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>Total</Text>
            <Text style={styles.bold}>₹{total}</Text>
          </View>
          <Text style={styles.muted}>Date: {date} · {timeSlot}</Text>
          <Text style={styles.muted}>Address: {address}</Text>
          <View style={styles.divider} />
          <Text style={styles.muted}>
            Pay a small advance now to confirm. Balance is paid after service
            (wallet / UPI / cash).
          </Text>
          <Button
            title={busy ? 'Processing…' : 'Pay Advance & Confirm'}
            onPress={placeBooking}
            disabled={busy}
          />
          <TouchableOpacity onPress={() => setScreen('details')}>
            <Text style={styles.link}>Edit details</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === 'confirmation' && confirmed && (
        <View style={styles.card}>
          <Text style={styles.success}>Booking confirmed ✓</Text>
          <Text style={styles.orderNo}>{confirmed.orderNumber}</Text>
          <Text style={styles.muted}>Status: {confirmed.status}</Text>
          <Text style={styles.muted}>
            {confirmed.scheduledDate} · {confirmed.timeSlot}
          </Text>
          <Text>Total ₹{confirmed.totalAmount} · Advance ₹{confirmed.advanceAmount}</Text>
          <View style={{ height: 16 }} />
          <Button title="My Bookings" onPress={openMyBookings} />
          <TouchableOpacity onPress={() => setScreen('services')}>
            <Text style={styles.link}>Book another service</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'bookings' && (
        <View style={styles.flexCard}>
          <Text style={styles.label}>My Bookings</Text>
          <ScrollView style={{ flex: 1 }}>
            {myBookings.length === 0 && <Text style={styles.muted}>No bookings yet.</Text>}
            {myBookings.map((b) => (
              <View key={b.id} style={styles.serviceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{b.orderNumber}</Text>
                  <Text style={styles.muted}>
                    {b.items.map((i) => i.name).join(', ')}
                  </Text>
                  <Text style={styles.muted}>
                    {b.scheduledDate} · {b.timeSlot}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>₹{b.totalAmount}</Text>
                  <Text style={styles.status}>{b.status}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Button title="Book a Service" onPress={() => setScreen('services')} />
          <TouchableOpacity onPress={logout}>
            <Text style={[styles.link, { color: '#b00' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
  brand: { fontSize: 20, fontWeight: '700', color: '#1f6feb', marginBottom: 20, textAlign: 'center' },
  card: { width: '100%', maxWidth: 420, gap: 10, alignSelf: 'center' },
  flexCard: { flex: 1, width: '100%', maxWidth: 420, gap: 10, alignSelf: 'center' },
  label: { fontSize: 17, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  link: { color: '#1f6feb', textAlign: 'center', marginTop: 8 },
  muted: { color: '#777', fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, padding: 12, marginBottom: 8 },
  serviceCardSel: { borderColor: '#1f6feb', backgroundColor: '#f0f6ff' },
  serviceName: { fontSize: 15, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '700' },
  check: { fontSize: 20, color: '#1f6feb' },
  footer: { paddingVertical: 8, gap: 8 },
  total: { fontWeight: '600', textAlign: 'center' },
  bold: { fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  slotSel: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
  slotText: { color: '#333', fontSize: 13 },
  slotTextSel: { color: '#fff', fontSize: 13 },
  success: { fontSize: 20, fontWeight: '700', color: '#0a7d33', textAlign: 'center' },
  orderNo: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: '#1f6feb' },
  status: { fontSize: 12, color: '#0a7d33', fontWeight: '600', textTransform: 'capitalize' },
});
