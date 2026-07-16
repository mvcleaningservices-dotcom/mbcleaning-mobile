import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Search, PackageSearch, Plus, Check, Sparkles } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { theme } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ServiceImage } from '../components/ServiceImage';
import { useToast } from '../components/Toast';
import { alertDialog } from '../dialog';
import { api, ServiceItem, PopularService } from '../api';
import { useCart } from '../cart/CartContext';
import { useServiceDetail } from '../detail/ServiceDetailContext';
import { CartBar } from '../components/CartBar';
import { session } from '../session';

function greetingPrefix() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function CustomerHomeScreen() {
  const { has, toggle } = useCart();
  const { open: openDetail } = useServiceDetail();
  const [pincode, setPincode] = useState('');
  const [hasPincode, setHasPincode] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [popular, setPopular] = useState<PopularService[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unconditional animation hooks for the Pincode entry screen
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Run the entrance animation whenever the pincode-entry card is shown — on
  // first mount and again when "Change" flips hasPincode back to false. Without
  // resetting + re-running here, the card re-appears stuck at its start opacity
  // (0) and looks washed out.
  useEffect(() => {
    if (hasPincode) return;
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [hasPincode, fadeAnim, slideAnim]);

  useEffect(() => {
    loadInitialData();
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const token = await session.getToken();
      let savedPin = await session.getPincode();
      if (token) {
        try {
          const profile = await api.getProfile(token);
          setUserName(profile.name);
          if (!savedPin && profile.pincode) {
            savedPin = profile.pincode;
            await session.savePincode(savedPin);
          }
        } catch {
          // profile is best-effort — greeting just falls back to generic
        }
      }
      if (savedPin) {
        setPincode(savedPin);
        setHasPincode(true);
        await Promise.all([fetchServices(savedPin, ''), fetchPopular(savedPin)]);
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

  const fetchPopular = async (pin: string) => {
    try {
      setPopular(await api.listPopular(pin));
    } catch (e: any) {
      // non-critical — Popular section just stays hidden
    }
  };

  const submitPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      return alertDialog('Invalid pincode', 'Enter a 6-digit pincode');
    }
    setBusy(true);
    setLoading(true);
    try {
      await session.savePincode(pincode);
      const token = await session.getToken();
      if (token) await api.updateProfile(token, { pincode }).catch(() => {});
      setHasPincode(true);
      await Promise.all([fetchServices(pincode, ''), fetchPopular(pincode)]);
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
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.topTealPanel, { paddingTop: insets.top + theme.spacing[10] }]}>
          <View style={styles.iconContainer}>
            <MapPin color={theme.colors.primary600} size={32} />
          </View>
          <Text style={styles.title}>Where do you need service?</Text>
          <Text style={styles.subtitle}>Enter your area pincode to see available services.</Text>
        </View>

        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[
            styles.card, 
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: slideAnim }] 
            }
          ]}>
            <Input
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
              value={pincode}
              onChangeText={setPincode}
              style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: '600' }}
            />
            <Button 
              title="Find Services" 
              onPress={submitPincode} 
              loading={busy} 
              disabled={pincode.length < 6} 
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Service listing ────────────────────────────────────────────
  const isSearching = search.trim() !== '';
  const categories = ['All', ...Array.from(new Set(services.map((s) => s.category).filter(Boolean) as string[]))];
  const gridServices = (!isSearching && activeCategory !== 'All')
    ? services.filter((s) => s.category === activeCategory)
    : services;
  const firstName = userName ? userName.split(' ')[0] : '';
  const greeting = firstName ? `${greetingPrefix()}, ${firstName}! 👋` : `${greetingPrefix()}! 👋`;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.topHeader, { paddingTop: insets.top + theme.spacing[3] }]}>
        <View style={styles.locationRow}>
          <MapPin size={13} color={theme.colors.primary600} />
          <Text style={styles.locationText}>Serving {pincode}</Text>
          <TouchableOpacity onPress={changePincode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>{greeting}</Text>
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
        {loading ? (
          <View>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</View>
        ) : services.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={30} color={theme.colors.primary600} />}
            title={isSearching ? 'No matching services' : 'No services here yet'}
            subtitle={isSearching ? 'Try a different search term.' : 'We don’t serve this pincode yet. Try changing your area.'}
          />
        ) : (
          <>
            {!isSearching && (
              <>
                {/* Honest value-prop banner — no fabricated discount */}
                <View style={styles.banner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerTitle}>Sparkling homes, hassle-free</Text>
                    <Text style={styles.bannerSub}>Vetted professionals · transparent pricing</Text>
                  </View>
                  <Sparkles size={26} color="rgba(255,255,255,0.9)" />
                </View>

                {categories.length > 2 && (
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

                {popular.length > 0 && activeCategory === 'All' && (
                  <>
                    <Text style={styles.sectionTitle}>Most popular</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popScroll} contentContainerStyle={styles.popContent}>
                      {popular.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.popCard, has(s.id) && styles.gridCardSel]}
                          activeOpacity={0.85}
                          onPress={() => openDetail(s)}
                          accessibilityRole="button"
                          accessibilityLabel={`${s.name}, from ${s.price} rupees. View details`}
                        >
                          <ServiceImage uri={s.imageUrl} name={s.name} style={styles.popImage} />
                          <View style={styles.popBody}>
                            <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                            <View style={styles.cardFooter}>
                              <Text style={styles.cardPrice}>from ₹{s.price}</Text>
                              <Text style={styles.bookedText}>{s.bookingCount} booked</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}

            <Text style={styles.sectionTitle}>{isSearching ? 'Results' : 'All services'}</Text>
            <View style={styles.grid2}>
              {gridServices.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.gridCard, has(s.id) && styles.gridCardSel]}
                  activeOpacity={0.85}
                  onPress={() => openDetail(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, from ${s.price} rupees. View details`}
                >
                  <ServiceImage uri={s.imageUrl} name={s.name} style={styles.gridImage} />
                  <View style={styles.gridBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardPrice}>from ₹{s.price}</Text>
                      {/* Reflects real cart state. This used to be a decorative
                          <View> on a card that only navigated away — the button
                          showed "+" and added nothing. */}
                      <TouchableOpacity
                        style={[styles.addBtn, has(s.id) && styles.addBtnSel]}
                        onPress={() => toggle(s)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: has(s.id) }}
                        accessibilityLabel={`${has(s.id) ? 'Remove' : 'Add'} ${s.name}`}
                      >
                        {has(s.id)
                          ? <Check size={16} color={theme.colors.textInverse} />
                          : <Plus size={16} color={theme.colors.textInverse} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {/* Sticky cart — without it, adding from Home has nowhere to go. */}
      <CartBar aboveTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  
  topTealPanel: {
    backgroundColor: theme.colors.primary600,
    paddingBottom: 100,
    paddingHorizontal: theme.spacing[6],
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
    marginTop: -60, // Create overlap with the teal panel
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing[6],
    padding: theme.spacing[6],
    borderRadius: theme.radius.xl,
    ...theme.shadows.lg,
  },
  iconContainer: { 
    width: 64, 
    height: 64, 
    borderRadius: theme.radius['2xl'], 
    backgroundColor: theme.colors.surface, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: theme.spacing[6] 
  },
  title: { 
    fontFamily: theme.typography.fontFamily.bold, 
    fontSize: theme.typography.sizes['2xl'], 
    color: theme.colors.textInverse, 
    marginBottom: theme.spacing[2], 
    textAlign: 'center' 
  },
  subtitle: { 
    fontFamily: theme.typography.fontFamily.regular, 
    fontSize: theme.typography.sizes.md, 
    color: 'rgba(255, 255, 255, 0.8)', 
    textAlign: 'center' 
  },

  topHeader: { backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[4], borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  greeting: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.xl, color: theme.colors.textPrimary, marginTop: theme.spacing[1] },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  locationText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  changeText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.xs, color: theme.colors.primary600, marginLeft: theme.spacing[2] },

  searchContainer: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], backgroundColor: theme.colors.surfaceSubtle },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[16] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary, marginBottom: theme.spacing[3], marginTop: theme.spacing[5] },

  // Honest value-prop banner (solid brand teal, no fabricated offer)
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.primary600,
    borderRadius: theme.radius.xl,
    padding: theme.spacing[5], marginTop: theme.spacing[4],
    ...theme.shadows.md,
  },
  bannerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textInverse, marginBottom: 2 },
  bannerSub: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: 'rgba(255,255,255,0.85)' },

  // Category pills
  catScroll: { marginTop: theme.spacing[5], marginHorizontal: -theme.spacing[5] },
  catContent: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[2] },
  catPill: { paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[4], borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  catPillSel: { backgroundColor: theme.colors.primary50, borderColor: theme.colors.primary600 },
  catText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  catTextSel: { color: theme.colors.primary700, fontFamily: theme.typography.fontFamily.semiBold },

  // Popular (horizontal)
  popScroll: { marginHorizontal: -theme.spacing[5] },
  popContent: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[3], paddingBottom: theme.spacing[1] },
  popCard: { width: 220, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  popImage: { width: '100%', height: 110 },
  popBody: { padding: theme.spacing[3] },

  // 2-column grid
  grid2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', marginBottom: theme.spacing[3] },
  gridCardSel: { borderColor: theme.colors.primary600, borderWidth: 2 },
  gridImage: { width: '100%', height: 110 },
  gridBody: { padding: theme.spacing[3] },

  // Shared card text
  cardName: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  cardDesc: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, lineHeight: 16, marginTop: 2, minHeight: 32 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing[2] },
  cardPrice: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.primary600 },
  bookedText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.primary600, justifyContent: 'center', alignItems: 'center' },
  addBtnSel: { backgroundColor: theme.colors.success },
});
