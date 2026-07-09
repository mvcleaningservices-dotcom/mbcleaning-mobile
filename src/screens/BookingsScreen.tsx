import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react-native';

import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { api, Booking } from '../api';
import { session } from '../session';

export function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  
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
      const [bList, w] = await Promise.all([
        api.myBookings(token),
        api.getWallet(token),
      ]);
      setBookings(bList);
      setWalletBalance(w.balance);
    } catch (e) {
      // non-critical — keep last known state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const settleFinalPayment = async (order: Booking) => {
    const token = await session.getToken();
    if (!token) return;
    
    const amt = Math.max(0, Math.floor(Number(walletAmtToPay) || 0));
    setBusy(true);
    try {
      const updated = await api.payFinal(token, order.id, amt);
      setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
      toast.success('Final payment recorded successfully.');
      setExpandedId(null);
    } catch (e: any) {
      toast.error(e.message || 'Could not settle payment');
    } finally {
      setBusy(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'assigned': return 'info';
      case 'started': return 'info';
      default: return 'warning';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary600]} tintColor={theme.colors.primary600} />}
      >
        {loading && bookings.length === 0 && (
          <View>{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</View>
        )}

        {bookings.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><ClipboardList size={32} color={theme.colors.primary400} /></View>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyDesc}>When you book a service, it will appear here.</Text>
            <Button title="Book a Service" onPress={() => navigation.navigate('HomeTab')} style={{ marginTop: 16 }} />
          </View>
        )}

        {bookings.map(b => {
          const isExpanded = expandedId === b.id;
          const due = b.remainingDue || 0;
          
          return (
            <Card key={b.id} style={styles.bookingCard}>
              <TouchableOpacity 
                style={styles.bookingHeader} 
                activeOpacity={0.7}
                onPress={() => setExpandedId(isExpanded ? null : b.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>{b.orderNumber}</Text>
                  <Text style={styles.itemsList} numberOfLines={1}>{b.items.map((i: any) => i.name).join(', ')}</Text>
                  <Text style={styles.dateTime}>{b.scheduledDate} · {b.timeSlot}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Text style={styles.price}>₹{b.totalAmount}</Text>
                  <Badge label={b.status} variant={getStatusVariant(b.status)} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.divider} />
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Worker:</Text>
                    <Text style={styles.detailValue}>{b.assignedWorkerName || 'Not yet assigned'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Advance:</Text>
                    <Text style={styles.detailValue}>₹{b.advanceAmount} {b.advancePaid ? '(Paid)' : '(Unpaid)'}</Text>
                  </View>
                  
                  {b.finalPayment && (
                    <>
                      <View style={styles.divider} />
                      {b.finalPayment.settled ? (
                        <View style={styles.settledBox}>
                          <Text style={styles.settledTitle}>Final payment settled ✓</Text>
                          <Text style={styles.settledSub}>Wallet: ₹{b.finalPayment.walletPaid} · Cash: ₹{b.finalPayment.cashPaid}</Text>
                        </View>
                      ) : due > 0 ? (
                        <View style={styles.paymentBox}>
                          <Text style={styles.dueTitle}>Pay remaining ₹{due}</Text>
                          <Text style={styles.dueSub}>Enter how much to pay from wallet (Balance: ₹{walletBalance}). The rest is paid in cash.</Text>
                          
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
                          
                          <Button 
                            title="Settle Payment" 
                            onPress={() => settleFinalPayment(b)} 
                            loading={busy} 
                            disabled={busy} 
                          />
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
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: { 
    paddingTop: 0, paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[4], 
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 24, color: theme.colors.textPrimary },
  
  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },
  
  emptyState: { padding: theme.spacing[8], alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 18, color: theme.colors.textPrimary, marginBottom: 8 },
  emptyDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  
  bookingCard: { padding: 0, overflow: 'hidden' },
  bookingHeader: { padding: theme.spacing[4], flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  itemsList: { fontFamily: theme.typography.fontFamily.regular, fontSize: 14, color: theme.colors.textSecondary, marginBottom: 6 },
  dateTime: { fontFamily: theme.typography.fontFamily.medium, fontSize: 13, color: theme.colors.textMuted },
  price: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 8 },
  
  expandHint: { alignItems: 'center', paddingBottom: 4, marginTop: -4 },
  
  expandedContent: { paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[4] },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing[3] },
  
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontFamily: theme.typography.fontFamily.regular, fontSize: 14, color: theme.colors.textSecondary },
  detailValue: { fontFamily: theme.typography.fontFamily.medium, fontSize: 14, color: theme.colors.textPrimary },
  
  settledBox: { backgroundColor: theme.colors.successBg, padding: 12, borderRadius: theme.radius.md, marginTop: 8 },
  settledTitle: { fontFamily: theme.typography.fontFamily.bold, color: theme.colors.success, marginBottom: 4 },
  settledSub: { fontFamily: theme.typography.fontFamily.medium, fontSize: 12, color: theme.colors.success },
  
  paymentBox: { backgroundColor: theme.colors.surfaceMuted, padding: 12, borderRadius: theme.radius.md, marginTop: 8 },
  dueTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  dueSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 },
  cashCalc: { fontFamily: theme.typography.fontFamily.medium, fontSize: 13, color: theme.colors.textPrimary, marginBottom: 16 },
  
  dueTag: { backgroundColor: theme.colors.warningBg, paddingVertical: 6, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderLight },
  dueTagText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 12, color: theme.colors.warningText, textAlign: 'center' },
});
