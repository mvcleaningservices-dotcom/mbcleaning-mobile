import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarCheck, CalendarX, Zap } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { confirmDialog } from '../../dialog';
import { RazorpayCheckout, type CheckoutResult } from '../../components/RazorpayCheckout';
import { api, type RechargeOverview, type RechargePlan } from '../../api';
import { session } from '../../session';

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Vendor recharge plans (client V2 item 5.5) — pay with Razorpay, like the wallet top-up. */
export function VendorRechargeScreen() {
  const [data, setData] = useState<RechargeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ keyId: string; orderId: string; amount: number; plan: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const t = await session.getToken();
    if (!t) return;
    try {
      setData(await api.vendorRecharge(t));
    } catch (e: any) {
      toast.error(e.message || 'Could not load plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // `toast` is deliberately left out: its object changes whenever a toast
    // shows, which would re-run this on focus and could loop after an error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buy = async (plan: RechargePlan) => {
    const ok = await confirmDialog({
      title: `Recharge ${plan.name}`,
      message: `Pay ₹${plan.price} for ${plan.months} month${plan.months > 1 ? 's' : ''}?`,
      confirmLabel: 'Pay',
    });
    if (!ok) return;
    const t = await session.getToken();
    if (!t) return;
    setBusyPlan(plan.id);
    try {
      const res = await api.vendorRechargeOrder(t, plan.id);
      if (res.payment.provider === 'razorpay') {
        // Stays busy until the checkout finishes (onSuccess / onCancel).
        setPayment({ keyId: res.payment.keyId!, orderId: res.payment.razorpayOrderId!, amount: res.payment.amount, plan: plan.name });
        return;
      }
      // Test mode (local development only).
      setData(await api.vendorRechargeTestConfirm(t, res.paymentId));
      toast.success(`Recharged: ${plan.name}`);
      setBusyPlan(null);
    } catch (e: any) {
      toast.error(e.message || 'Recharge failed. Please try again.');
      setBusyPlan(null);
    }
  };

  const onPaid = async (result: CheckoutResult) => {
    const name = payment?.plan ?? '';
    setPayment(null);
    try {
      const t = await session.getToken();
      if (!t) throw new Error('Session expired. Please log in again.');
      setData(await api.vendorRechargeVerify(t, result));
      toast.success(`Recharged: ${name}`);
    } catch (e: any) {
      // Money may have left their account — never imply nothing happened.
      toast.error(e.message || 'Payment taken but the plan did not update. Pull down to refresh.');
    } finally {
      setBusyPlan(null);
    }
  };

  const onCancel = (reason?: string) => {
    setPayment(null);
    setBusyPlan(null);
    toast.show(reason || 'Payment cancelled.', 'info');
  };

  if (loading || !data) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary600} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recharge</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.colors.primary600]} />}
      >
        <View style={[styles.status, data.planActive ? styles.statusOn : styles.statusOff]}>
          {data.planActive
            ? <CalendarCheck size={26} color={theme.colors.success} />
            : <CalendarX size={26} color={theme.colors.error} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {data.planActive ? `${data.planName} plan active` : data.planExpiresAt ? 'Your plan has expired' : 'No active plan'}
            </Text>
            <Text style={styles.statusSub}>
              {data.planActive
                ? `Valid till ${fmt(data.planExpiresAt)}`
                : data.planExpiresAt
                  ? `Ended on ${fmt(data.planExpiresAt)}. Recharge to continue.`
                  : 'Choose a plan below to recharge.'}
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Plans</Text>
        {data.plans.length === 0 && <Text style={styles.muted}>No plans available right now.</Text>}
        {data.plans.map((p) => (
          <View key={p.id} style={styles.plan}>
            <View style={styles.planIcon}><Zap size={20} color={theme.colors.primary600} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.muted}>{p.months} month{p.months > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.price}>₹{p.price.toLocaleString('en-IN')}</Text>
              <Button title="Recharge" onPress={() => buy(p)} loading={busyPlan === p.id} disabled={!!busyPlan} style={styles.planBtn} />
            </View>
          </View>
        ))}
        {data.planActive && data.plans.length > 0 && (
          <Text style={styles.note}>Recharging early adds the new months after your current plan ends — you don't lose any days.</Text>
        )}

        {data.history.length > 0 && (
          <>
            <Text style={styles.section}>Recharge history</Text>
            {data.history.map((h) => (
              <View key={h.id} style={styles.hist}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTitle}>{h.planName} · ₹{h.amount.toLocaleString('en-IN')}</Text>
                  <Text style={styles.muted}>Paid {fmt(h.paidAt)} · valid till {fmt(h.validUntil)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {payment && (
        <RazorpayCheckout
          visible
          keyId={payment.keyId}
          orderId={payment.orderId}
          amount={payment.amount}
          description={`Vendor recharge — ${payment.plan}`}
          onSuccess={onPaid}
          onCancel={onCancel}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary },
  content: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[3] },
  status: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[4], borderRadius: theme.radius.lg, borderWidth: 1 },
  statusOn: { backgroundColor: theme.colors.successBg, borderColor: theme.colors.successBg },
  statusOff: { backgroundColor: theme.colors.errorBg, borderColor: theme.colors.errorBg },
  statusTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  statusSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: 2 },
  section: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: theme.spacing[2] },
  plan: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing[4] },
  planIcon: { width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center' },
  planName: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  price: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },
  planBtn: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 0 },
  muted: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  note: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, textAlign: 'center' },
  hist: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing[3] },
  histTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
});
