import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, LocateFixed } from 'lucide-react-native';

import { theme } from '../theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { api, type GeoPlace } from '../api';
import { session } from '../session';
import { OsmMapView, type LatLng } from './OsmMapView';
import { currentPosition } from './location';

/**
 * "Mark your home on the map" at checkout (client V2, OpenStreetMap).
 * Optional — helps the professional find the house. Search a landmark, use
 * the phone's location, or tap/drag the pin, then Confirm.
 */
export function PinPickerModal({
  visible,
  initial,
  pincode,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initial: LatLng | null;
  pincode: string;
  onClose: () => void;
  onConfirm: (p: LatLng | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState<LatLng | null>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState<'search' | 'gps' | null>(null);
  const [msg, setMsg] = useState('');

  // Each time it opens: start from the saved pin, or near their pincode.
  useEffect(() => {
    if (!visible) return;
    setPin(initial);
    setResults([]);
    setMsg('');
    if (initial || !/^\d{6}$/.test(pincode)) return;
    (async () => {
      const t = await session.getToken();
      if (!t) return;
      try {
        const r = await api.geoSearch(t, `${pincode}, India`);
        if (r[0]) setPin({ lat: r[0].lat, lng: r[0].lng });
        setMsg('Drag the pin onto your home, or tap the map.');
      } catch { /* map still usable */ }
    })();
    // initial/pincode are read only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const search = async () => {
    if (query.trim().length < 3) return setMsg('Type at least 3 letters — e.g. a landmark or apartment.');
    const t = await session.getToken();
    if (!t) return;
    setBusy('search');
    setMsg('');
    try {
      const r = await api.geoSearch(t, query.trim());
      if (r.length === 0) setMsg('Nothing found. Try a nearby landmark or area, then drag the pin.');
      else if (r.length === 1) { setPin({ lat: r[0].lat, lng: r[0].lng }); setResults([]); }
      else setResults(r);
    } catch {
      setMsg('Search isn’t available right now — tap the map to place the pin.');
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = async () => {
    setBusy('gps');
    setMsg('');
    try {
      setPin(await currentPosition());
      setMsg('Pin placed at your current location. Drag it if needed.');
    } catch (e: any) {
      setMsg(e?.message || 'Couldn’t get your location — search or tap the map instead.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Mark your home</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
            <X size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Search a landmark, apartment or area"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              returnKeyType="search"
              leftIcon={<Search size={18} color={theme.colors.textMuted} />}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={!!busy} accessibilityLabel="Search">
            {busy === 'search' ? <ActivityIndicator color={theme.colors.textInverse} /> : <Search size={18} color={theme.colors.textInverse} />}
          </TouchableOpacity>
        </View>

        {results.length > 1 && (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.map((r) => (
              <TouchableOpacity key={`${r.lat},${r.lng}`} style={styles.result} onPress={() => { setPin({ lat: r.lat, lng: r.lng }); setResults([]); }}>
                <Text style={styles.resultText} numberOfLines={2}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <OsmMapView
          style={styles.map}
          pickable
          pin={pin}
          onPick={(p) => { setPin(p); setMsg(''); }}
          onError={setMsg}
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing[4]) }]}>
          <TouchableOpacity style={styles.gps} onPress={useMyLocation} disabled={!!busy}>
            {busy === 'gps' ? <ActivityIndicator color={theme.colors.primary600} /> : <LocateFixed size={18} color={theme.colors.primary600} />}
            <Text style={styles.gpsText}>Use my current location</Text>
          </TouchableOpacity>
          <Text style={styles.msg}>{msg || (pin ? 'Drag the pin if it isn’t exactly on your home.' : 'Tap the map (or search) to drop the pin on your home.')}</Text>
          <Button title="Confirm location" onPress={() => onConfirm(pin)} disabled={!pin} />
          {initial && (
            <TouchableOpacity onPress={() => onConfirm(null)} style={{ alignItems: 'center', marginTop: theme.spacing[3] }}>
              <Text style={styles.remove}>Remove pin</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[3] },
  title: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.xl, color: theme.colors.textPrimary },
  searchRow: { flexDirection: 'row', gap: theme.spacing[2], paddingHorizontal: theme.spacing[4], alignItems: 'flex-start' },
  searchBtn: { width: 48, height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary600, justifyContent: 'center', alignItems: 'center' },
  results: { maxHeight: 180, marginHorizontal: theme.spacing[4], borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: theme.spacing[2] },
  result: { padding: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  resultText: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  map: { flex: 1, minHeight: 260 },
  footer: { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[3], borderTopWidth: 1, borderTopColor: theme.colors.border },
  gps: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
  gpsText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.primary600 },
  msg: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing[3] },
  remove: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.error },
});
