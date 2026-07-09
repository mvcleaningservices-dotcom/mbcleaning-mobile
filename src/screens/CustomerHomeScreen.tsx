import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Search, PackageSearch } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { api, ServiceItem } from '../api';
import { session } from '../session';

export function CustomerHomeScreen() {
  const [pincode, setPincode] = useState('');
  const [hasPincode, setHasPincode] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadInitialData();
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      let savedPin = await session.getPincode();
      if (!savedPin) {
        const token = await session.getToken();
        if (token) {
          const profile = await api.getProfile(token);
          if (profile.pincode) {
            savedPin = profile.pincode;
            await session.savePincode(savedPin);
          }
        }
      }
      if (savedPin) {
        setPincode(savedPin);
        setHasPincode(true);
        await fetchServices(savedPin, '');
      }
    } catch (e) {
      // non-critical — keep last known state
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async (pin: string, q: string) => {
    try {
      const list = await api.listServices(pin, q);
      setServices(list);
    } catch (e: any) {
      // non-critical — keep last known state
    }
  };

  const submitPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      return Alert.alert('Invalid pincode', 'Enter a 6-digit pincode');
    }
    setBusy(true);
    setLoading(true);
    try {
      await session.savePincode(pincode);
      const token = await session.getToken();
      if (token) await api.updateProfile(token, { pincode }).catch(() => {});
      setHasPincode(true);
      await fetchServices(pincode, '');
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  // Debounced search so we don't hit the API on every keystroke.
  const onSearch = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchServices(pincode, text), 300);
  };

  const changePincode = () => {
    setHasPincode(false);
    setServices([]);
  };

  // ── Pincode entry ──────────────────────────────────────────────
  if (!hasPincode) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.headerCentered}>
            <View style={styles.iconContainer}>
              <MapPin color={theme.colors.primary600} size={32} />
            </View>
            <Text style={styles.title}>Where do you need service?</Text>
            <Text style={styles.subtitle}>Enter your area pincode to see available services.</Text>
          </View>
          <Input
            placeholder="6-digit pincode"
            keyboardType="number-pad"
            maxLength={6}
            value={pincode}
            onChangeText={setPincode}
            style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: '600' }}
          />
          <Button title="Find Services" onPress={submitPincode} loading={busy} disabled={pincode.length < 6} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Service listing ────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: insets.top + theme.spacing[3] }]}>
        <Text style={styles.greeting}>Welcome back!</Text>
        <View style={styles.locationRow}>
          <MapPin size={14} color={theme.colors.primary600} />
          <Text style={styles.locationText}>{pincode}</Text>
          <TouchableOpacity onPress={changePincode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search services..."
          value={search}
          onChangeText={onSearch}
          leftIcon={<Search size={18} color={theme.colors.textMuted} />}
        />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Available Services</Text>

        {loading ? (
          <View>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</View>
        ) : services.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={30} color={theme.colors.primary600} />}
            title={search ? 'No matching services' : 'No services here yet'}
            subtitle={search ? 'Try a different search term.' : 'We don’t serve this pincode yet. Try changing your area.'}
          />
        ) : (
          <View style={styles.grid}>
            {services.map((s) => (
              <Card key={s.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.servicePrice}>{'₹'}{s.price}</Text>
                </View>
                <Text style={styles.serviceDesc} numberOfLines={2}>{s.description}</Text>
                <Button
                  title="Book Now"
                  size="sm"
                  variant="secondary"
                  onPress={() => navigation.navigate('Services')}
                  style={{ marginTop: theme.spacing[3] }}
                />
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  content: { flex: 1, paddingHorizontal: theme.spacing[6], justifyContent: 'center' },
  headerCentered: { alignItems: 'center', marginBottom: theme.spacing[8] },
  iconContainer: { width: 64, height: 64, borderRadius: theme.radius['2xl'], backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing[6] },
  title: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary, marginBottom: theme.spacing[2], textAlign: 'center' },
  subtitle: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.md, color: theme.colors.textSecondary, textAlign: 'center' },

  topHeader: { backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[4], borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  greeting: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.xl, color: theme.colors.textPrimary, marginBottom: theme.spacing[1] },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  locationText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  changeText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.xs, color: theme.colors.primary600, marginLeft: theme.spacing[2] },

  searchContainer: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], backgroundColor: theme.colors.surfaceSubtle },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[16] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary, marginBottom: theme.spacing[4], marginTop: theme.spacing[2] },

  grid: { gap: theme.spacing[3] },
  serviceCard: { padding: theme.spacing[4] },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[2] },
  serviceName: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, flex: 1, marginRight: theme.spacing[2] },
  servicePrice: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.primary600 },
  serviceDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 20 },
});
