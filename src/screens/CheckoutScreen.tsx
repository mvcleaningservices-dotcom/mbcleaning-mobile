import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar, Clock, MapPin, CreditCard, Wallet, ShieldCheck, Smartphone, Check } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ServiceImage } from '../components/ServiceImage';
import { useToast } from '../components/Toast';
import { api, ServiceItem } from '../api';
import { useCart } from '../cart/CartContext';
import { session } from '../session';

const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

/** Must match MAX_DAYS_AHEAD in the backend's BookingsService. */
const MAX_DAYS_AHEAD = 60;

/** YYYY-MM-DD from LOCAL date parts (avoids the UTC day-shift in IST). */
function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Next 7 selectable days, using LOCAL date parts (avoids UTC day-shift in IST).
function nextSevenDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = dateOffset(i);
    return {
      iso: localIso(d),
      weekday: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d.getDate(),
    };
  });
}

/** e.g. "Mon, 24 Aug" — for a date picked outside the quick chips. */
function longLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export function CheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Read the shared cart rather than navigation params: params meant only the one
  // screen that owned the selection could ever start a checkout, and a reload or
  // deep link arrived with an empty order.
  const { items: selectedServices, total, clear: clearCart } = useCart();

  const [date, setDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
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

      // The order is placed, so the cart has served its purpose. It now persists
      // across app restarts, so failing to clear it would leave the customer
      // carrying the services they just booked into their next visit.
      clearCart();

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
  // A date chosen from the calendar rather than the quick chips: no chip is lit,
  // so it needs its own confirmation line or the choice looks like it was lost.
  const customDate = date && !days.some((d) => d.iso === date) ? date : '';

  /**
   * Android shows a self-dismissing dialog and fires 'dismissed' on cancel; iOS
   * renders inline and stays put. So the flag is cleared for Android on EVERY
   * event — leaving it set means the dialog immediately reopens itself and the
   * screen becomes impossible to leave.
   */
  const onPickDate = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    setDate(localIso(selected));
  };

  const isFormValid = date.length > 5 && !!timeSlot && address.trim().length > 5;
  const ctaLabel = !date
    ? 'Select a date'
    : !timeSlot
    ? 'Select a time slot'
    : address.trim().length <= 5
    ? 'Add your address'
    : 'Pay advance & confirm';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>

        {/* Summary */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Your order</Text>
          {selectedServices.map((s) => (
            <View key={s.id} style={styles.summaryItem}>
              <ServiceImage uri={s.imageUrl} name={s.name} iconSize={16} style={styles.summaryThumb} />
              <Text style={styles.summaryName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.summaryPrice}>₹{s.price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{total}</Text>
          </View>
        </Card>

        {/* Schedule */}
        <Card style={styles.card}>
          <View style={styles.labelRow}>
            <Calendar size={16} color={theme.colors.primary600} />
            <Text style={styles.sectionTitle}>Pick a date</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsScroll}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
              {days.map((d) => {
                const sel = date === d.iso;
                return (
                  <TouchableOpacity key={d.iso} activeOpacity={0.7} onPress={() => setDate(d.iso)} style={[styles.dateChip, sel && styles.dateChipSel]}>
                    <Text style={[styles.dateChipDay, sel && styles.dateChipTextSel]}>{d.weekday}</Text>
                    <Text style={[styles.dateChipNum, sel && styles.dateChipTextSel]}>{d.dayNum}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPicker(true)}
            style={styles.moreDatesBtn}
            accessibilityRole="button"
            accessibilityLabel="Choose another date from the calendar"
          >
            <Calendar size={15} color={theme.colors.primary600} />
            <Text style={styles.moreDatesText}>
              {customDate ? longLabel(customDate) : 'Choose another date'}
            </Text>
            {!!customDate && <Check size={15} color={theme.colors.primary600} />}
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={date ? new Date(`${date}T00:00:00`) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={dateOffset(0)}
              maximumDate={dateOffset(MAX_DAYS_AHEAD)}
              onChange={onPickDate}
            />
          )}

          <View style={[styles.labelRow, { marginTop: theme.spacing[5] }]}>
            <Clock size={16} color={theme.colors.primary600} />
            <Text style={styles.sectionTitle}>Pick a time slot</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsScroll}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity key={slot} activeOpacity={0.7} onPress={() => setTimeSlot(slot)} style={[styles.slot, timeSlot === slot && styles.slotSel]}>
                  <Text style={[styles.slotText, timeSlot === slot && styles.slotTextSel]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>

        {/* Address */}
        <Card style={styles.card}>
          <View style={styles.labelRow}>
            <MapPin size={16} color={theme.colors.primary600} />
            <Text style={styles.sectionTitle}>Service address</Text>
          </View>
          <Input
            placeholder="Flat / house no, street, landmark"
            value={address}
            onChangeText={setAddress}
            multiline
            leftIcon={<MapPin size={18} color={theme.colors.textMuted} />}
          />
        </Card>

        {/* Payment */}
        <Card style={styles.card}>
          <View style={styles.labelRow}>
            <CreditCard size={16} color={theme.colors.primary600} />
            <Text style={styles.sectionTitle}>Pay advance</Text>
          </View>

          <TouchableOpacity style={[styles.payRow, payAdvanceFromWallet && styles.payRowSel]} onPress={() => setPayAdvanceFromWallet(true)} activeOpacity={0.8}>
            <Wallet size={20} color={payAdvanceFromWallet ? theme.colors.primary600 : theme.colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>Pay from wallet</Text>
              <Text style={styles.paySub}>Balance ₹{walletBalance}</Text>
            </View>
            <View style={[styles.radio, payAdvanceFromWallet && styles.radioSel]}>{payAdvanceFromWallet && <Check size={13} color={theme.colors.textInverse} />}</View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.payRow, !payAdvanceFromWallet && styles.payRowSel]} onPress={() => setPayAdvanceFromWallet(false)} activeOpacity={0.8}>
            <Smartphone size={20} color={!payAdvanceFromWallet ? theme.colors.primary600 : theme.colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>Pay online</Text>
              <Text style={styles.paySub}>UPI, card or netbanking</Text>
            </View>
            <View style={[styles.radio, !payAdvanceFromWallet && styles.radioSel]}>{!payAdvanceFromWallet && <Check size={13} color={theme.colors.textInverse} />}</View>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <ShieldCheck size={16} color={theme.colors.success} />
            <Text style={styles.trustText}>You only pay the balance after the service is completed.</Text>
          </View>
        </Card>

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, theme.spacing[4]) }]}>
        <View style={styles.barTotal}>
          <Text style={styles.barTotalLabel}>Total</Text>
          <Text style={styles.barTotalValue}>₹{total}</Text>
        </View>
        <Button
          title={ctaLabel}
          icon={isFormValid ? <CreditCard size={18} color={theme.colors.textInverse} /> : undefined}
          onPress={placeBooking}
          disabled={!isFormValid || busy}
          loading={busy}
          style={{ flex: 1, marginLeft: theme.spacing[4] }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },

  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 120, gap: theme.spacing[4] },

  card: { padding: theme.spacing[5] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[4] },

  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[3] },
  summaryThumb: { width: 40, height: 40, borderRadius: theme.radius.md },
  summaryName: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary, flex: 1 },
  summaryPrice: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  divider: { height: 1, backgroundColor: theme.colors.border, marginTop: theme.spacing[2], marginBottom: theme.spacing[3] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  totalAmount: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.primary600 },

  slotsScroll: { marginHorizontal: -theme.spacing[5], paddingHorizontal: theme.spacing[5], paddingBottom: 4 },
  dateChip: { alignItems: 'center', justifyContent: 'center', minWidth: 56, paddingVertical: 10, paddingHorizontal: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  dateChipSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  // Calendar escape hatch. Quieter than the chips — most bookings are this week,
  // so the common path stays the loud one. 44pt tall for the touch target.
  moreDatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: theme.spacing[3],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  moreDatesText: { fontFamily: theme.typography.fontFamily.medium, fontSize: 13, color: theme.colors.primary700 },
  dateChipDay: { fontFamily: theme.typography.fontFamily.medium, fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
  dateChipNum: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary },
  dateChipTextSel: { color: theme.colors.primary700 },
  slot: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  // Was referenced by the slot chips but never defined, so the selected slot had
  // no highlight — only its label changed colour. Matches dateChipSel.
  slotSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  slotText: { fontFamily: theme.typography.fontFamily.medium, fontSize: 13, color: theme.colors.textSecondary },
  slotTextSel: { color: theme.colors.primary700 },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[3], borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing[2] },
  payRowSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  payTitle: { fontFamily: theme.typography.fontFamily.semiBold, color: theme.colors.textPrimary, fontSize: theme.typography.sizes.sm },
  paySub: { fontFamily: theme.typography.fontFamily.regular, color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  radioSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary600 },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginTop: theme.spacing[2], backgroundColor: theme.colors.successBg, padding: theme.spacing[3], borderRadius: theme.radius.md },
  trustText: { flex: 1, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.xs, color: theme.colors.success, lineHeight: 16 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  barTotal: { minWidth: 64 },
  barTotalLabel: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary },
  barTotalValue: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },
});
