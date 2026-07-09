import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, Clock, MapPin, CreditCard, Wallet } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { useToast } from '../components/Toast';
import { api, ServiceItem } from '../api';
import { session } from '../session';

const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

// Next 7 selectable days, using LOCAL date parts (avoids UTC day-shift in IST).
function nextSevenDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      iso,
      weekday: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d.getDate(),
    };
  });
}

export function CheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const selectedServices: ServiceItem[] = route.params?.selectedServices || [];
  const total: number = route.params?.total || 0;

  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [address, setAddress] = useState('');
  const [payAdvanceFromWallet, setPayAdvanceFromWallet] = useState(false);
  
  const [walletBalance, setWalletBalance] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await session.getToken();
      if (t) {
        try {
          const w = await api.getWallet(t);
          setWalletBalance(w.balance);
          
          const p = await api.getProfile(t);
          if (p.address) setAddress(p.address);
        } catch (e) {
          // ignore
        }
      }
    })();
  }, []);

  const placeBooking = async () => {
    const token = await session.getToken();
    if (!token) return;
    
    setBusy(true);
    try {
      const pin = await session.getPincode() || '';
      const res = await api.createBooking(token, {
        serviceIds: selectedServices.map((s) => s.id),
        scheduledDate: date.trim(),
        timeSlot,
        address: address.trim(),
        pincode: pin,
        advanceMethod: payAdvanceFromWallet ? 'wallet' : 'razorpay',
      });

      let finalBooking = res.booking;

      if (!res.payment.required) {
        // Advance is ₹0 or paid from wallet fully
      } else if (res.payment.provider === 'test') {
        finalBooking = await api.testConfirm(token, res.booking.id);
      } else if (res.payment.provider === 'razorpay') {
        toast.show('Booking saved. Complete payment to confirm.', 'info');
      }

      // Success! Navigate to Bookings tab (reset stack so they can't go back to checkout)
      if (res.payment.provider !== 'razorpay') {
        toast.success('Booking confirmed! 🎉');
      }
      navigation.reset({
        index: 0,
        routes: [{ name: 'CustomerApp', params: { screen: 'BookingsTab' } }],
      });

    } catch (e: any) {
      toast.error(e.message || 'Booking failed');
    } finally {
      setBusy(false);
    }
  };

  const days = nextSevenDays();
  const isFormValid = date.length > 5 && timeSlot && address.trim().length > 5;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        
        {/* Summary Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {selectedServices.map(s => (
            <View key={s.id} style={styles.summaryItem}>
              <Text style={styles.summaryName}>{s.name}</Text>
              <Text style={styles.summaryPrice}>₹{s.price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{total}</Text>
          </View>
        </Card>

        {/* Schedule Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Schedule</Text>

          <View style={styles.labelRow}>
            <Calendar size={16} color={theme.colors.textSecondary} />
            <Text style={styles.label}>Select Date</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsScroll}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
              {days.map((d) => {
                const sel = date === d.iso;
                return (
                  <TouchableOpacity
                    key={d.iso}
                    activeOpacity={0.7}
                    onPress={() => setDate(d.iso)}
                    style={[styles.dateChip, sel && styles.dateChipSel]}
                  >
                    <Text style={[styles.dateChipDay, sel && styles.dateChipTextSel]}>{d.weekday}</Text>
                    <Text style={[styles.dateChipNum, sel && styles.dateChipTextSel]}>{d.dayNum}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Text style={[styles.label, { marginTop: theme.spacing[4] }]}>Time Slot</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsScroll}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  activeOpacity={0.7}
                  onPress={() => setTimeSlot(slot)}
                  style={[styles.slot, timeSlot === slot && styles.slotSel]}
                >
                  <Clock size={14} color={timeSlot === slot ? theme.colors.primary600 : theme.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.slotText, timeSlot === slot && styles.slotTextSel]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>

        {/* Address Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Input
            placeholder="Flat, street, landmark"
            value={address}
            onChangeText={setAddress}
            multiline
            leftIcon={<MapPin size={18} color={theme.colors.textMuted} />}
          />
        </Card>

        {/* Payment Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.mutedText}>Pay a small advance to confirm. Balance is paid after service completion.</Text>
          
          <TouchableOpacity 
            style={[styles.walletRow, payAdvanceFromWallet && styles.walletRowSel]} 
            onPress={() => setPayAdvanceFromWallet(v => !v)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Wallet size={20} color={payAdvanceFromWallet ? theme.colors.primary600 : theme.colors.textSecondary} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.walletTitle}>Pay advance from wallet</Text>
                <Text style={styles.walletSub}>Balance: ₹{walletBalance}</Text>
              </View>
            </View>
            <View style={[styles.checkbox, payAdvanceFromWallet && styles.checkboxSel]}>
              {payAdvanceFromWallet && <View style={styles.checkboxInner} />}
            </View>
          </TouchableOpacity>
        </Card>

      </ScrollView>

      <View style={styles.bottomBar}>
        <Button 
          title="Pay Advance & Confirm" 
          icon={<CreditCard size={18} color="#fff" />}
          onPress={placeBooking}
          disabled={!isFormValid || busy}
          loading={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 0, paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4], 
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 18, color: theme.colors.textPrimary },
  
  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },
  
  card: { padding: theme.spacing[5] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary, marginBottom: theme.spacing[4] },
  
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing[2] },
  summaryName: { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.textSecondary, flex: 1 },
  summaryPrice: { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.textPrimary },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing[3] },
  totalLabel: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 16, color: theme.colors.textPrimary },
  totalAmount: { fontFamily: theme.typography.fontFamily.bold, fontSize: 18, color: theme.colors.primary600 },
  
  label: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary, marginBottom: theme.spacing[2] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
  slotsScroll: { marginHorizontal: -theme.spacing[5], paddingHorizontal: theme.spacing[5], paddingBottom: 8 },
  dateChip: { alignItems: 'center', justifyContent: 'center', minWidth: 56, paddingVertical: 10, paddingHorizontal: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  dateChipSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  dateChipDay: { fontFamily: theme.typography.fontFamily.medium, fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
  dateChipNum: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary },
  dateChipTextSel: { color: theme.colors.primary700 },
  slot: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  slotSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  slotText: { fontFamily: theme.typography.fontFamily.medium, fontSize: 13, color: theme.colors.textSecondary },
  slotTextSel: { color: theme.colors.primary700 },
  
  mutedText: { fontFamily: theme.typography.fontFamily.regular, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20, marginBottom: theme.spacing[4] },
  
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing[3], borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  walletRowSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  walletTitle: { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.textPrimary, fontSize: 14 },
  walletSub: { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxSel: { borderColor: theme.colors.primary600 },
  checkboxInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary600 },

  bottomBar: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: theme.colors.surface, 
    paddingHorizontal: theme.spacing[5], 
    paddingVertical: theme.spacing[4],
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing[4],
    borderTopWidth: 1, 
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
});
