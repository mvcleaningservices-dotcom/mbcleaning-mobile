import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { api, WalletState } from '../api';
import { session } from '../session';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

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
    if (value < 1) return Alert.alert('Enter an amount', 'Please enter a valid top-up amount.');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.primary600} />}
      >
        <Text style={styles.pageTitle}>My Wallet</Text>

        {/* Balance card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.walletIcon}>
              <WalletIcon color={theme.colors.primary600} size={22} />
            </View>
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceValue}>₹{wallet.balance.toLocaleString()}</Text>
        </Card>

        {/* Top-up */}
        <Text style={styles.sectionTitle}>Add Money</Text>
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((q) => (
            <Text
              key={q}
              style={styles.quickChip}
              onPress={() => setAmount(String(q))}
            >
              ₹{q}
            </Text>
          ))}
        </View>
        <Input
          label="Amount"
          placeholder="Enter amount"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Button title="Add Money" onPress={topUp} loading={busy} disabled={!amount} />

        {/* History */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {wallet.history.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
          wallet.history.map((t) => {
            const credit = t.type === 'topup' || t.type === 'refund';
            return (
              <View key={t.id} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: credit ? theme.colors.successBg : theme.colors.surfaceMuted }]}>
                  {credit
                    ? <ArrowDownLeft size={18} color={theme.colors.success} />
                    : <ArrowUpRight size={18} color={theme.colors.textSecondary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{t.description || (credit ? 'Top-up' : 'Payment')}</Text>
                  <Text style={styles.txnType}>{t.type}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: credit ? theme.colors.success : theme.colors.textPrimary }]}>
                  {credit ? '+' : '−'}₹{t.amount.toLocaleString()}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  content: { padding: theme.spacing[4], paddingBottom: theme.spacing[16] },
  pageTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes['2xl'],
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing[4],
  },
  balanceCard: { backgroundColor: theme.colors.primary50, borderColor: theme.colors.primary100, marginBottom: theme.spacing[6] },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
  walletIcon: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  balanceLabel: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  balanceValue: { fontFamily: theme.typography.fontFamily.extraBold, fontSize: theme.typography.sizes['4xl'], color: theme.colors.primary700 },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[3],
  },
  quickRow: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[3], flexWrap: 'wrap' },
  quickChip: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary700,
    backgroundColor: theme.colors.primary50,
    borderWidth: 1, borderColor: theme.colors.primary100,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[4],
    overflow: 'hidden',
  },
  empty: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.md, color: theme.colors.textMuted, paddingVertical: theme.spacing[4] },
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    padding: theme.spacing[3], marginBottom: theme.spacing[2],
  },
  txnIcon: { width: 36, height: 36, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center' },
  txnDesc: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  txnType: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, textTransform: 'capitalize' },
  txnAmount: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md },
});
