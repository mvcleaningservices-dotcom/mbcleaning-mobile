import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Phone, Navigation } from 'lucide-react-native';

import { theme } from '../theme';
import { api, type BookingTracking } from '../api';
import { session } from '../session';
import { OsmMapView, type MapMarker } from '../maps/OsmMapView';
import { useAppConfig, callHelpline } from '../content/useContent';

const REFRESH_MS = 15_000;

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m === 0 ? 'just now' : m === 1 ? '1 min ago' : `${m} min ago`;
}

/**
 * Track your professional (client V2 5.3, OpenStreetMap). Their position is
 * shown only while the job is In Progress and their app is open; it refreshes
 * every 15 s. Helpline button when the admin has set a number.
 */
export function TrackingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const bookingId: string = route.params?.bookingId;
  const { config } = useAppConfig();
  const [data, setData] = useState<BookingTracking | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = await session.getToken();
    if (!t) return;
    try {
      setData(await api.bookingTracking(t, bookingId));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Couldn’t load tracking');
    }
  }, [bookingId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, REFRESH_MS);
    return () => clearInterval(iv);
  }, [load]);

  const markers: MapMarker[] = [];
  if (data?.home) markers.push({ ...data.home, label: 'Your home', kind: 'home' });
  for (const p of data?.partners ?? []) markers.push({ lat: p.lat, lng: p.lng, label: p.name, kind: 'partner' });

  const names = data?.assignedNames.length ? data.assignedNames.join(', ') : 'Your professional';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Track your professional</Text>
          {!!data && <Text style={styles.sub}>{data.orderNumber}</Text>}
        </View>
      </View>

      {!data && !error ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary600} /></View>
      ) : (
        <>
          {markers.length > 0 ? (
            <OsmMapView style={styles.map} markers={markers} />
          ) : (
            <View style={[styles.map, styles.center]}>
              <Text style={styles.muted}>Map not available for this booking.</Text>
            </View>
          )}

          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, theme.spacing[4]) }]}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {data && !data.sharing ? (
              <Text style={styles.status}>
                {data.status === 'completed'
                  ? 'This job is complete.'
                  : 'Live location appears here once your professional starts the job.'}
              </Text>
            ) : data && data.partners.length === 0 ? (
              <Text style={styles.status}>{names} is on the job. Their location will appear when their app shares it.</Text>
            ) : (
              data?.partners.map((p) => (
                <View key={p.name} style={styles.partnerRow}>
                  <Navigation size={18} color={theme.colors.primary600} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerName}>{p.name}</Text>
                    <Text style={styles.muted}>
                      {p.distanceKm != null ? `${p.distanceKm} km away · ` : ''}updated {minutesAgo(p.at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
            {!!config.helplineNumber && (
              <TouchableOpacity style={styles.help} onPress={() => callHelpline(config.helplineNumber)} accessibilityRole="button">
                <Phone size={16} color={theme.colors.error} />
                <Text style={styles.helpText}>Emergency helpline · {config.helplineNumber}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing[3], paddingBottom: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  back: { padding: 8 },
  title: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  panel: { padding: theme.spacing[4], gap: theme.spacing[3], borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  status: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.md, color: theme.colors.textSecondary },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  partnerName: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  muted: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  error: { color: theme.colors.error, fontFamily: theme.typography.fontFamily.medium },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing[3], borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.error },
  helpText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.error },
});
