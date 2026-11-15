import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList, Calendar, MapPin, Navigation } from 'lucide-react-native';
import { openDirections } from '../../maps/location';

import { theme } from '../../theme';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { api, type VendorOrder } from '../../api';
import { session } from '../../session';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', assigned: 'Assigned',
  in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const variant = (s: string) =>
  s === 'completed' ? 'success' : s === 'cancelled' ? 'error' : s === 'assigned' || s === 'in_progress' ? 'info' : 'warning';

/** Orders MV Cleaning assigned to this Service Partner (own orders only). */
export function VendorOrdersScreen() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = await session.getToken();
    if (!t) return;
    try {
      setOrders(await api.vendorOrders(t));
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load your orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = orders.filter((o) => ['confirmed', 'assigned', 'in_progress'].includes(o.status));
  const past = orders.filter((o) => !['confirmed', 'assigned', 'in_progress'].includes(o.status));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My orders</Text>
        <Text style={styles.headerSub}>Jobs MV Cleaning has assigned to you</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary600} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.colors.primary600]} />}
        >
          {!!error && <Text style={styles.error}>{error}</Text>}
          {orders.length === 0 && !error ? (
            <EmptyState
              icon={<ClipboardList size={28} color={theme.colors.primary600} />}
              title="No orders yet"
              subtitle="Orders assigned to you will show up here. Pull down to refresh."
            />
          ) : (
            <>
              {active.length > 0 && <Text style={styles.section}>Upcoming & ongoing ({active.length})</Text>}
              {active.map((o) => <OrderCard key={o.orderNumber} o={o} />)}
              {past.length > 0 && <Text style={styles.section}>Past</Text>}
              {past.map((o) => <OrderCard key={o.orderNumber} o={o} />)}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OrderCard({ o }: { o: VendorOrder }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNo}>{o.orderNumber}</Text>
        <Badge label={STATUS_LABEL[o.status] ?? o.status} variant={variant(o.status)} />
      </View>
      <Text style={styles.services}>{o.services.join(', ')}</Text>
      <View style={styles.line}>
        <Calendar size={15} color={theme.colors.textMuted} />
        <Text style={styles.lineText}>{o.scheduledDate} · {o.timeSlot}</Text>
      </View>
      <View style={styles.line}>
        <MapPin size={15} color={theme.colors.textMuted} />
        <Text style={styles.lineText}>{o.address}</Text>
      </View>
      {['confirmed', 'assigned', 'in_progress'].includes(o.status) && (
        <TouchableOpacity
          style={styles.dirBtn}
          onPress={() => openDirections(o.location, [o.address, o.pincode].filter(Boolean).join(', '))}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${o.orderNumber}`}
        >
          <Navigation size={15} color={theme.colors.primary700} />
          <Text style={styles.dirText}>Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary },
  headerSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: 2 },
  content: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[3] },
  section: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: theme.spacing[2] },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing[4], gap: theme.spacing[2] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  services: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2] },
  lineText: { flex: 1, fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  error: { color: theme.colors.error, fontFamily: theme.typography.fontFamily.medium, textAlign: 'center' },
  dirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: theme.spacing[1], paddingVertical: theme.spacing[2], borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.primary200, backgroundColor: theme.colors.primary50 },
  dirText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.primary700 },
});
