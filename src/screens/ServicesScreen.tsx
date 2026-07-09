import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ChevronLeft, PackageSearch, Check, Plus, RefreshCw } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ServiceImage } from '../components/ServiceImage';
import { useToast } from '../components/Toast';
import { api, ServiceItem } from '../api';
import { session } from '../session';

export function ServicesScreen() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, ServiceItem>>({});
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadServices('');
  }, []);

  const loadServices = async (q: string) => {
    setLoading(true);
    setError(false);
    try {
      const pin = await session.getPincode();
      if (!pin) {
        toast.error('Please set your location first.');
        navigation.goBack();
        return;
      }
      const list = await api.listServices(pin, q);
      setServices(list);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (text: string) => {
    setSearch(text);
    setActiveCategory('All');
    loadServices(text);
  };

  const toggleSelect = (svc: ServiceItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[svc.id]) delete next[svc.id];
      else next[svc.id] = svc;
      return next;
    });
  };

  const selectedList = Object.values(selected);
  const total = selectedList.reduce((s, i) => s + i.price, 0);

  const categories = ['All', ...Array.from(new Set(services.map((s) => s.category).filter(Boolean) as string[]))];
  const visible = activeCategory === 'All' ? services : services.filter((s) => s.category === activeCategory);

  const proceedToCheckout = () => {
    if (selectedList.length === 0) return;
    navigation.navigate('Checkout', { selectedServices: selectedList, total });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Select services</Text>
          <Text style={styles.headerSub}>Add what you need, pay a small advance</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search services..."
          value={search}
          onChangeText={onSearch}
          leftIcon={<Search size={18} color={theme.colors.textMuted} />}
        />
      </View>

      {!loading && !error && categories.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
          {categories.map((c) => {
            const sel = activeCategory === c;
            return (
              <TouchableOpacity key={c} onPress={() => setActiveCategory(c)} style={[styles.catPill, sel && styles.catPillSel]} activeOpacity={0.8}>
                <Text style={[styles.catText, sel && styles.catTextSel]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : error ? (
        <View style={styles.centered}>
          <EmptyState
            icon={<RefreshCw size={28} color={theme.colors.primary600} />}
            title="Couldn’t load services"
            subtitle="Something went wrong. Check your connection and try again."
          />
          <Button title="Retry" variant="secondary" onPress={() => loadServices(search)} style={{ marginTop: theme.spacing[2], paddingHorizontal: theme.spacing[8] }} />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch size={30} color={theme.colors.primary600} />}
          title={search ? 'No matching services' : 'No services here yet'}
          subtitle={search ? 'Try a different search term.' : 'We don’t serve this area right now — try changing your location.'}
        />
      ) : (
        <Animated.ScrollView style={[styles.scrollArea, { opacity: fade }]} contentContainerStyle={styles.scrollContent}>
          {visible.map((s) => {
            const isSel = !!selected[s.id];
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.85}
                onPress={() => toggleSelect(s)}
                style={[styles.row, isSel && styles.rowSel]}
              >
                <ServiceImage uri={s.imageUrl} name={s.name} iconSize={22} style={styles.thumb} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    {!!s.category && <Text style={styles.catTag}>{s.category}</Text>}
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
                  <View style={styles.rowFooter}>
                    <Text style={styles.price}>₹{s.price}</Text>
                    <View style={[styles.addBtn, isSel && styles.addBtnSel]}>
                      {isSel ? <Check size={15} color={theme.colors.textInverse} /> : <Plus size={15} color={theme.colors.primary600} />}
                      <Text style={[styles.addText, isSel && styles.addTextSel]}>{isSel ? 'Added' : 'Add'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>
      )}

      {selectedList.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, theme.spacing[4]) }]}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>{selectedList.length} service{selectedList.length > 1 ? 's' : ''} selected</Text>
            <Text style={styles.cartTotal}>₹{total}</Text>
          </View>
          <Button title="Continue" onPress={proceedToCheckout} style={{ paddingHorizontal: theme.spacing[8] }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary, textAlign: 'center' },
  headerSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 },

  searchContainer: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], backgroundColor: theme.colors.surfaceSubtle },

  catScroll: { maxHeight: 44, backgroundColor: theme.colors.surfaceSubtle },
  catContent: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[2], paddingBottom: theme.spacing[2] },
  catPill: { paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[4], borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, height: 36, justifyContent: 'center' },
  catPillSel: { backgroundColor: theme.colors.primary50, borderColor: theme.colors.primary600 },
  catText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  catTextSel: { color: theme.colors.primary700, fontFamily: theme.typography.fontFamily.semiBold },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacing[5], paddingBottom: 120, paddingTop: theme.spacing[2], gap: theme.spacing[3] },

  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing[3],
    gap: theme.spacing[3],
    ...theme.shadows.sm,
  },
  rowSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  thumb: { width: 76, height: 76, borderRadius: theme.radius.md },
  rowBody: { flex: 1, justifyContent: 'space-between' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  name: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, flexShrink: 1 },
  catTag: { fontFamily: theme.typography.fontFamily.medium, fontSize: 10, color: theme.colors.primary700, backgroundColor: theme.colors.primary100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radius.sm, overflow: 'hidden', textTransform: 'uppercase' },
  desc: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, lineHeight: 16, marginTop: 2 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing[2] },
  price: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.primary600 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: theme.spacing[3], borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.primary600, backgroundColor: theme.colors.surface },
  addBtnSel: { backgroundColor: theme.colors.primary600 },
  addText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.primary600 },
  addTextSel: { color: theme.colors.textInverse },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  cartInfo: { flex: 1 },
  cartItems: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary },
  cartTotal: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.xl, color: theme.colors.textPrimary },
});
