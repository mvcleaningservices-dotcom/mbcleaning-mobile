import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, ChevronDown, ChevronUp, Calendar, User, Check, XCircle } from 'lucide-react-native';

import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { api, Booking } from '../api';
import { session } from '../session';

const STEPS = ['Placed', 'Assigned', 'Ongoing', 'Done'];
function stepIndex(status: string) {
  if (['pending', 'confirmed'].includes(status)) return 0;
  if (status === 'assigned') return 1;
  if (['in_progress', 'started'].includes(status)) return 2;
  if (status === 'completed') return 3;
  return -1; // cancelled / unknown
}
const isPastStatus = (s: string) => s === 'completed' || s === 'cancelled';

/** Horizontal order-progress stepper derived from the order status. */
function StatusTimeline({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledRow}>
        <XCircle size={16} color={theme.colors.error} />
        <Text style={styles.cancelledText}>This booking was cancelled.</Text>
      </View>
    );
  }
  const idx = stepIndex(status);
  return (
    <View style={styles.timeline}>
      {STEPS.map((label, i) => {
        const done = i <= idx;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={styles.stepDotRow}>
              <View style={[styles.halfLine, i === 0 && styles.hiddenLine, i <= idx && styles.lineDone]} />
              <View style={[styles.stepDot, done && styles.stepDotDone]}>{done && <Check size={10} color={theme.colors.textInverse} />}</View>
              <View style={[styles.halfLine, i === STEPS.length - 1 && styles.hiddenLine, i < idx && styles.lineDone]} />
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [walletAmtToPay, setWalletAmtToPay] = useState('');
  const [busy, setBusy] = useState(false);

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const fetchBookings = async () => {
    try {
      const token = await session.getToken();
      if (!token) return;
      const [bList, w] = await Promise.all([api.myBookings(token), api.getWallet(token)]);
      setBookings(bList);
      setWalletBalance(w.balance);
    } catch (e) {
      // non-critical — keep last known state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchBookings(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const settleFinalPayment = async (order: Booking) => {
    const token = await session.getToken();
    if (!token) return;
    const amt = Math.max(0, Math.floor(Number(walletAmtToPay) || 0));
    setBusy(true);
    try {
      const updated = await api.payFinal(token, order.id, amt);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success('Final payment recorded successfully.');
      setExpandedId(null);
    } catch (e: any) {
      toast.error(e.message || 'Could not settle payment');
    } finally {
      setBusy(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'assigned':
      case 'started':
      case 'in_progress': return 'info';
      default: return 'warning';
    }
  };

  const visible = bookings.filter((b) => (tab === 'past' ? isPastStatus(b.status) : !isPastStatus(b.status)));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <Text style={styles.headerTitle}>My bookings</Text>
        <View style={styles.segment}>
          {(['upcoming', 'past'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]} onPress={() => { setTab(t); setExpandedId(null); }} activeOpacity={0.8}>
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>{t === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* FlatList (not ScrollView + .map): order history grows without bound, and
          mounting every card at once gets slower with each booking a loyal
          customer makes. FlatList virtualises so only visible rows are mounted. */}
      <FlatList
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        data={visible}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary600]} tintColor={theme.colors.primary600} />}
        ListEmptyComponent={
          loading && bookings.length === 0 ? (
            <View>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>
          ) : !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><ClipboardList size={32} color={theme.colors.primary400} /></View>
              <Text style={styles.emptyTitle}>{tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings yet'}</Text>
              <Text style={styles.emptyDesc}>{tab === 'upcoming' ? 'Book a service and it’ll show up here — it only takes a minute.' : 'Completed and cancelled bookings will appear here.'}</Text>
              {tab === 'upcoming' && <Button title="Book a service" onPress={() => navigation.navigate('HomeTab')} style={{ marginTop: 16, paddingHorizontal: theme.spacing[8] }} />}
            </View>
          ) : null
        }
        renderItem={({ item: b }) => {
          const isExpanded = expandedId === b.id;
          const due = b.remainingDue || 0;

          return (
            <Card style={styles.bookingCard}>
              <TouchableOpacity style={styles.bookingHeader} activeOpacity={0.7} onPress={() => setExpandedId(isExpanded ? null : b.id)}>
                <View style={{ flex: 1, marginRight: theme.spacing[3] }}>
                  <Text style={styles.orderNumber}>{b.orderNumber}</Text>
                  <Text style={styles.itemsList} numberOfLines={1}>{b.items.map((i: any) => i.name).join(', ')}</Text>
                  <View style={styles.metaRow}>
                    <Calendar size={13} color={theme.colors.textMuted} />
                    <Text style={styles.dateTime}>{b.scheduledDate} · {b.timeSlot}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Text style={styles.price}>₹{b.totalAmount}</Text>
                  <Badge label={b.status.replace('_', ' ')} variant={getStatusVariant(b.status)} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.divider} />
                  <StatusTimeline status={b.status} />
                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelWrap}>
                      <User size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.detailLabel}>Professional</Text>
                    </View>
                    <Text style={styles.detailValue}>{b.assignedWorkerName || 'Not yet assigned'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Advance</Text>
                    <Text style={styles.detailValue}>₹{b.advanceAmount} {b.advancePaid ? '· Paid' : '· Unpaid'}</Text>
                  </View>

                  {b.finalPayment && (
                    <>
                      <View style={styles.divider} />
                      {b.finalPayment.settled ? (
                        <View style={styles.settledBox}>
                          <Text style={styles.settledTitle}>Final payment settled ✓</Text>
                          <Text style={styles.settledSub}>Wallet ₹{b.finalPayment.walletPaid} · Cash ₹{b.finalPayment.cashPaid}</Text>
                        </View>
                      ) : due > 0 ? (
                        <View style={styles.paymentBox}>
                          <Text style={styles.dueTitle}>Pay remaining ₹{due}</Text>
                          <Text style={styles.dueSub}>Choose how much to pay from your wallet (balance ₹{walletBalance}). The rest is paid in cash.</Text>
                          <Input
                            keyboardType="number-pad"
                            placeholder="Wallet amount (0 = all cash)"
                            value={walletAmtToPay}
                            onChangeText={setWalletAmtToPay}
                            style={{ backgroundColor: theme.colors.surface }}
                          />
                          <Text style={styles.cashCalc}>
                            Cash to pay: ₹{Math.max(0, due - Math.min(Math.max(0, Math.floor(Number(walletAmtToPay) || 0)), due))}
                          </Text>
                          <Button title="Settle payment" onPress={() => settleFinalPayment(b)} loading={busy} disabled={busy} />
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              )}

              {!isExpanded && due > 0 && (
                <View style={styles.dueTag}>
                  <Text style={styles.dueTagText}>₹{due} due after service</Text>
                </View>
              )}

              <View style={styles.expandHint}>
                {isExpanded ? <ChevronUp size={16} color={theme.colors.textMuted} /> : <ChevronDown size={16} color={theme.colors.textMuted} />}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: {
    paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary, marginBottom: theme.spacing[3] },

  segment: { flexDirection: 'row', backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: theme.colors.surface, ...theme.shadows.sm },
  segmentText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary700, fontFamily: theme.typography.fontFamily.semiBold },

  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },

  emptyState: { padding: theme.spacing[8], alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary, marginBottom: 8 },
  emptyDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  bookingCard: { padding: 0, overflow: 'hidden' },
  bookingHeader: { padding: theme.spacing[4], flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: 4 },
  itemsList: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateTime: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  price: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: 8 },

  expandHint: { alignItems: 'center', paddingBottom: 4, marginTop: -4 },
  expandedContent: { paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4] },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing[3] },

  // Status stepper
  timeline: { flexDirection: 'row', paddingHorizontal: theme.spacing[1] },
  stepCol: { flex: 1, alignItems: 'center' },
  stepDotRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  halfLine: { flex: 1, height: 2, backgroundColor: theme.colors.border },
  hiddenLine: { backgroundColor: 'transparent' },
  lineDone: { backgroundColor: theme.colors.primary600 },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: theme.colors.primary600, borderColor: theme.colors.primary600 },
  stepLabel: { fontFamily: theme.typography.fontFamily.medium, fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  stepLabelDone: { color: theme.colors.primary700, fontFamily: theme.typography.fontFamily.semiBold },
  cancelledRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], backgroundColor: theme.colors.errorBg, padding: theme.spacing[3], borderRadius: theme.radius.md },
  cancelledText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.error },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabel: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  detailValue: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },

  settledBox: { backgroundColor: theme.colors.successBg, padding: 12, borderRadius: theme.radius.md },
  settledTitle: { fontFamily: theme.typography.fontFamily.bold, color: theme.colors.success, marginBottom: 4 },
  settledSub: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.xs, color: theme.colors.success },

  paymentBox: { backgroundColor: theme.colors.surfaceMuted, padding: 12, borderRadius: theme.radius.md },
  dueTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: 4 },
  dueSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 16 },
  cashCalc: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary, marginTop: 8, marginBottom: 16 },

  dueTag: { backgroundColor: theme.colors.warningBg, paddingVertical: 6, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderLight },
  dueTagText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.xs, color: theme.colors.warningText, textAlign: 'center' },
});
