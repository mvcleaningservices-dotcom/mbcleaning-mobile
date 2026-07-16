import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ShieldCheck, Wallet, Clock, Plus, Check } from 'lucide-react-native';

import { theme } from '../theme';
import { Button } from './Button';
import { ServiceImage } from './ServiceImage';
import { useCart } from '../cart/CartContext';
import { useServiceDetail } from '../detail/ServiceDetailContext';

/**
 * Service-detail bottom sheet — the mobile counterpart to web's ServiceDetailSheet.
 *
 * Mobile previously had no detail view at all: a customer could add a ₹1499 deep
 * clean without ever seeing what it included, while web users could. This is the
 * information a first-time buyer needs in order to commit.
 *
 * Uses RN's Modal, which gives Android hardware-back dismissal via onRequestClose
 * for free — the native equivalent of the Escape key.
 */
export function ServiceDetailSheet() {
  const { service, close } = useServiceDetail();
  const { has, toggle } = useCart();
  const insets = useSafeAreaInsets();

  if (!service) return null;

  const added = has(service.id);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Tap the scrim to dismiss — matches the sheet pattern users expect. */}
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close details" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing[4] }]}>
        <View style={styles.grabber} />

        <Pressable
          style={styles.close}
          onPress={close}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={theme.colors.textPrimary} />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <ServiceImage uri={service.imageUrl} name={service.name} style={styles.image} />

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.name}>{service.name}</Text>
              {!!service.category && (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{service.category}</Text>
                </View>
              )}
            </View>

            <Text style={styles.price}>from ₹{service.price}</Text>

            <Text style={styles.sectionTitle}>What's included</Text>
            <Text style={styles.description}>
              {service.description ||
                'A thorough, professional service carried out by a vetted expert.'}
            </Text>

            <View style={styles.assurances}>
              <View style={styles.assuranceRow}>
                <ShieldCheck size={16} color={theme.colors.primary600} />
                <Text style={styles.assuranceText}>Vetted, trained professional</Text>
              </View>
              <View style={styles.assuranceRow}>
                <Wallet size={16} color={theme.colors.primary600} />
                <Text style={styles.assuranceText}>
                  Pay a small advance — balance after the job
                </Text>
              </View>
              <View style={styles.assuranceRow}>
                <Clock size={16} color={theme.colors.primary600} />
                <Text style={styles.assuranceText}>Convenient slots, on time</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={added ? 'Remove from booking' : 'Add to booking'}
            variant={added ? 'secondary' : 'primary'}
            onPress={() => {
              toggle(service);
              close();
            }}
            icon={
              added ? (
                <Check size={16} color={theme.colors.primary600} />
              ) : (
                <Plus size={16} color={theme.colors.textInverse} />
              )
            }
            style={{ width: '100%' }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
    zIndex: 2,
  },
  close: {
    position: 'absolute',
    top: theme.spacing[3],
    right: theme.spacing[4],
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: 180 },
  body: { padding: theme.spacing[5] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap' },
  name: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.textPrimary,
  },
  categoryPill: {
    backgroundColor: theme.colors.primary600,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  categoryText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 10,
    color: theme.colors.textInverse,
    textTransform: 'uppercase',
  },
  price: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.primary600,
    marginTop: theme.spacing[2],
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[2],
  },
  description: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  assurances: { marginTop: theme.spacing[5], gap: theme.spacing[3] },
  assuranceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  assuranceText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  footer: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
