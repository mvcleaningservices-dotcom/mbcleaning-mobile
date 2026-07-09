import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { alertDialog } from '../dialog';
import { api, WalletState, WalletTxn } from '../api';
import { session } from '../session';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** Group transactions by "Month Year", preserving the API's (newest-first) order. */
function groupByMonth(history: WalletTxn[]) {
  const groups: { key: string; items: WalletTxn[] }[] = [];
  for (const t of history) {
    const key = new Date(t.at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.items.push(t);
    else groups.push({ key, items: [t] });
  }
  return groups;
}

export function WalletScreen() {
  const [wallet, setWallet] = useState<WalletState>({ balance: 0, history: [] });
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const token = await session.getToken();
    if (!token) return;
    try {
      setWallet(await api.getWallet(token));
    } catch {
      /* keep last known state on transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const topUp = async () => {
    const value = Math.floor(Number(amount) || 0);
    if (value < 1) return alertDialog('Enter an amount', 'Please enter a valid top-up amount.');
    const token = await session.getToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await api.topupWallet(token, value);
      // Dev/test mode confirms instantly; live mode opens Razorpay checkout.
      if (res.payment.provider === 'test') {
        await api.confirmTopupTest(token, res.transactionId);
        toast.success(`₹${value} added to your wallet.`);
      } else {
        toast.show('Razorpay checkout opens here in production.', 'info');
      }
      setAmount('');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Top-up failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary600} />
      </View>
    );
  }

  const groups = groupByMonth(wallet.history);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.primary600} />}
      >
        <Text style={styles.pageTitle}>Wallet</Text>

        {/* Balance hero */}
        <View style={styles.balanceHero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><WalletIcon color={theme.colors.textInverse} size={20} /></View>
            <Text style={styles.heroLabel}>Available balance</Text>
          </View>
          <Text style={styles.heroValue}>₹{wallet.balance.toLocaleString('en-IN')}</Text>
          <Text style={styles.heroHint}>Use it to pay the advance or the balance on any booking.</Text>
        </View>

        {/* Top-up */}
        <Text style={styles.sectionTitle}>Add money</Text>
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((q) => {
            const sel = amount === String(q);
            return (
              <TouchableOpacity key={q} onPress={() => setAmount(String(q))} activeOpacity={0.8} style={[styles.quickChip, sel && styles.quickChipSel]}>
                <Text style={[styles.quickChipText, sel && styles.quickChipTextSel]}>₹{q}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Input
          label="Amount"
          placeholder="Enter amount"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Button title="Add money" onPress={topUp} loading={busy} disabled={!amount} />

        {/* History */}
        <Text style={styles.sectionTitle}>Transactions</Text>
        {wallet.history.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}><Receipt size={26} color={theme.colors.primary400} /></View>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyDesc}>Add money or book a service and it’ll show up here.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.key}>
              <Text style={styles.monthHeader}>{g.key}</Text>
              {g.items.map((t) => {
                const credit = t.type === 'topup' || t.type === 'refund';
                return (
                  <View key={t.id} style={styles.txnRow}>
                    <View style={[styles.txnIcon, { backgroundColor: credit ? theme.colors.successBg : theme.colors.surfaceMuted }]}>
                      {credit ? <ArrowDownLeft size={18} color={theme.colors.success} /> : <ArrowUpRight size={18} color={theme.colors.textSecondary} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txnDesc} numberOfLines={1}>{t.description || (credit ? 'Top-up' : 'Payment')}</Text>
                      <Text style={styles.txnMeta}>{formatDate(t.at)}</Text>
                    </View>
                    <Text style={[styles.txnAmount, { color: credit ? theme.colors.success : theme.colors.textPrimary }]}>
                      {credit ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  content: { padding: theme.spacing[4], paddingBottom: theme.spacing[16] },
  pageTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary, marginBottom: theme.spacing[4] },

  balanceHero: {
    backgroundColor: theme.colors.primary600,
    borderRadius: theme.radius.xl,
    padding: theme.spacing[5],
    ...theme.shadows.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3] },
  heroIcon: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  heroLabel: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontFamily: theme.typography.fontFamily.extraBold, fontSize: theme.typography.sizes['4xl'], color: theme.colors.textInverse },
  heroHint: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: 'rgba(255,255,255,0.8)', marginTop: theme.spacing[2] },

  sectionTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary, marginTop: theme.spacing[6], marginBottom: theme.spacing[3] },
  quickRow: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[3], flexWrap: 'wrap' },
  quickChip: { borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[4] },
  quickChipSel: { backgroundColor: theme.colors.primary50, borderColor: theme.colors.primary600 },
  quickChipText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  quickChipTextSel: { color: theme.colors.primary700 },

  emptyBox: { alignItems: 'center', paddingVertical: theme.spacing[8] },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing[3] },
  emptyTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, textAlign: 'center', maxWidth: 260 },

  monthHeader: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: theme.spacing[3], marginBottom: theme.spacing[2] },
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    padding: theme.spacing[3], marginBottom: theme.spacing[2],
  },
  txnIcon: { width: 36, height: 36, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center' },
  txnDesc: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  txnMeta: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 1 },
  txnAmount: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md },
});
