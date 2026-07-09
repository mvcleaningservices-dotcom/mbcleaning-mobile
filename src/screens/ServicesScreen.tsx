import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ChevronLeft, PackageSearch } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { api, ServiceItem } from '../api';
import { session } from '../session';

export function ServicesScreen() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, ServiceItem>>({});
  const [loading, setLoading] = useState(true);
  
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  useEffect(() => {
    loadServices('');
  }, []);

  const loadServices = async (q: string) => {
    setLoading(true);
    try {
      const pin = await session.getPincode();
      if (!pin) {
        toast.error('Please set your location first.');
        navigation.goBack();
        return;
      }
      const list = await api.listServices(pin, q);
      setServices(list);
    } catch (e: any) {
      // non-critical — keep last known state
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (text: string) => {
    setSearch(text);
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

  const proceedToCheckout = () => {
    if (selectedList.length === 0) return;
    // In a real app we'd use a global store/context for cart. 
    // Here we pass it through navigation params.
    navigation.navigate('Checkout', { selectedServices: selectedList, total });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Services</Text>
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

      {loading ? (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : services.length === 0 ? (
        <EmptyState
          icon={<PackageSearch size={30} color={theme.colors.primary600} />}
          title={search ? 'No matching services' : 'No services found'}
          subtitle={search ? 'Try a different search term.' : 'There are no services available for this area right now.'}
        />
      ) : (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <View style={styles.grid}>
            {services.map((s) => {
              const isSel = !!selected[s.id];
              return (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.8}
                  onPress={() => toggleSelect(s)}
                >
                  <Card style={{ ...styles.serviceCard, ...(isSel ? styles.serviceCardSel : {}) }}>
                    <View style={styles.serviceContent}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{s.name}</Text>
                        <Text style={styles.serviceDesc} numberOfLines={2}>{s.description}</Text>
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.servicePrice}>₹{s.price}</Text>
                        <View style={[styles.checkbox, isSel && styles.checkboxSel]}>
                          {isSel && <View style={styles.checkboxInner} />}
                        </View>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {selectedList.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>{selectedList.length} items</Text>
            <Text style={styles.cartTotal}>₹{total}</Text>
          </View>
          <Button 
            title="Continue" 
            onPress={proceedToCheckout}
            style={{ paddingHorizontal: theme.spacing[6] }}
          />
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
    paddingTop: 0, 
    paddingHorizontal: theme.spacing[4], 
    paddingBottom: theme.spacing[4], 
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 18, color: theme.colors.textPrimary },
  
  searchContainer: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], backgroundColor: theme.colors.surfaceSubtle },
  
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacing[5], paddingBottom: 100, paddingTop: theme.spacing[2] },
  
  grid: { gap: theme.spacing[3] },
  serviceCard: { padding: theme.spacing[4], borderWidth: 2, borderColor: 'transparent' },
  serviceCardSel: { borderColor: theme.colors.primary600, backgroundColor: theme.colors.primary50 },
  
  serviceContent: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceName: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  serviceDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  
  priceContainer: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: theme.spacing[4] },
  servicePrice: { fontFamily: theme.typography.fontFamily.bold, fontSize: 16, color: theme.colors.primary600 },
  
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxSel: { borderColor: theme.colors.primary600 },
  checkboxInner: { width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.primary600 },
  
  emptyState: { padding: theme.spacing[8], alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { fontFamily: theme.typography.fontFamily.medium, color: theme.colors.textMuted },
  
  bottomBar: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: theme.colors.surface, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: theme.spacing[5], 
    paddingVertical: theme.spacing[4],
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing[4],
    borderTopWidth: 1, 
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  cartInfo: { flex: 1 },
  cartItems: { fontFamily: theme.typography.fontFamily.regular, fontSize: 12, color: theme.colors.textSecondary },
  cartTotal: { fontFamily: theme.typography.fontFamily.bold, fontSize: 18, color: theme.colors.textPrimary },
});
