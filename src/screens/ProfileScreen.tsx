import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Wallet, LogOut, ChevronRight, MapPin, ClipboardList } from 'lucide-react-native';

import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { confirmDialog, alertDialog } from '../dialog';
import { api, Profile, WalletState } from '../api';
import { session } from '../session';

function MenuRow({ icon, label, right, onPress, last }: { icon: React.ReactNode; label: string; right?: React.ReactNode; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[styles.menuRow, !last && styles.menuRowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {right}
        <ChevronRight size={18} color={theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletState>({ balance: 0, history: [] });

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');

  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const fetchData = async () => {
    try {
      const token = await session.getToken();
      if (!token) return;
      const [p, w] = await Promise.all([api.getProfile(token), api.getWallet(token)]);
      setProfile(p);
      setName(p.name || '');
      setAddress(p.address || '');
      setPincode(p.pincode || '');
      setWallet(w);
    } catch (e) {
      // non-critical — keep last known state
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const saveProfile = async () => {
    const token = await session.getToken();
    if (!token) return;
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return alertDialog('Invalid pincode', 'Enter a 6-digit pincode');
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(token, {
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
      });
      setProfile(updated);
      if (updated.pincode && updated.pincode !== (await session.getPincode())) {
        await session.savePincode(updated.pincode);
      }
      toast.success('Your profile has been updated.');
    } catch (e: any) {
      toast.error(e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    const ok = await confirmDialog({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      destructive: true,
    });
    if (!ok) return;
    await session.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary600]} />}
      >
        {/* Identity header */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            {initials ? <Text style={styles.avatarText}>{initials}</Text> : <User size={28} color={theme.colors.primary600} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName}>{name.trim() || 'Add your name'}</Text>
            <Text style={styles.identityMobile}>{profile?.mobile || ''}</Text>
          </View>
        </View>

        {/* Quick menu */}
        <View style={styles.menuGroup}>
          <MenuRow
            icon={<Wallet size={20} color={theme.colors.primary600} />}
            label="Wallet"
            right={<Text style={styles.menuValue}>₹{wallet.balance}</Text>}
            onPress={() => navigation.navigate('WalletTab')}
          />
          <MenuRow
            icon={<ClipboardList size={20} color={theme.colors.primary600} />}
            label="My bookings"
            onPress={() => navigation.navigate('BookingsTab')}
            last
          />
        </View>

        {/* Personal details */}
        <Card style={styles.profileCard}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Input label="Mobile number" value={profile?.mobile || ''} editable={false} style={{ color: theme.colors.textMuted }} />
          <Input label="Full name" placeholder="Enter your name" value={name} onChangeText={setName} leftIcon={<User size={18} color={theme.colors.textMuted} />} />
          <Input label="Default address" placeholder="Flat, street, landmark" value={address} onChangeText={setAddress} multiline leftIcon={<MapPin size={18} color={theme.colors.textMuted} />} />
          <Input label="Pincode" placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={setPincode} />
          <Button title="Save changes" onPress={saveProfile} loading={saving} disabled={saving} style={{ marginTop: 8 }} />
        </Card>

        <TouchableOpacity style={styles.logoutRow} onPress={logout} activeOpacity={0.7}>
          <LogOut size={18} color={theme.colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MV Cleaning · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: {
    paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[4],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary },

  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },

  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4], paddingVertical: theme.spacing[2] },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.xl, color: theme.colors.primary700 },
  identityName: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },
  identityMobile: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: 2 },

  menuGroup: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing[4], paddingHorizontal: theme.spacing[4], gap: theme.spacing[3] },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  menuIcon: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  menuValue: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },

  profileCard: { padding: theme.spacing[5] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: theme.spacing[4] },

  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingVertical: theme.spacing[4], backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  logoutText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.error },
  version: { textAlign: 'center', fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing[2] },
});
