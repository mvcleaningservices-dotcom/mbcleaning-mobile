import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Wallet, LogOut, ChevronRight, MapPin } from 'lucide-react-native';

import { theme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { api, Profile, WalletState } from '../api';
import { session } from '../session';

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletState>({ balance: 0, history: [] });
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const fetchData = async () => {
    try {
      const token = await session.getToken();
      if (!token) return;
      const [p, w] = await Promise.all([
        api.getProfile(token),
        api.getWallet(token),
      ]);
      setProfile(p);
      setName(p.name || '');
      setAddress(p.address || '');
      setPincode(p.pincode || '');
      setWallet(w);
    } catch (e) {
      // non-critical — keep last known state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const saveProfile = async () => {
    const token = await session.getToken();
    if (!token) return;
    
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return Alert.alert('Invalid pincode', 'Enter a 6-digit pincode');
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
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await session.clear();
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing[3] }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <LogOut size={20} color={theme.colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary600]} />}
      >
        {/* Wallet summary — full top-up & history live on the Wallet tab */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('WalletTab')}>
          <Card style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <View style={styles.walletIcon}><Wallet size={24} color={theme.colors.primary600} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>Wallet Balance</Text>
                <Text style={styles.walletBalance}>₹{wallet.balance}</Text>
              </View>
              <View style={styles.walletLink}>
                <Text style={styles.walletLinkText}>Manage</Text>
                <ChevronRight size={18} color={theme.colors.primary600} />
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Profile Section */}
        <Card style={styles.profileCard}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          <Input
            label="Mobile Number"
            value={profile?.mobile || ''}
            editable={false}
            style={{ color: theme.colors.textMuted }}
          />
          
          <Input
            label="Full Name"
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            leftIcon={<User size={18} color={theme.colors.textMuted} />}
          />
          
          <Input
            label="Default Address"
            placeholder="Flat, street, landmark"
            value={address}
            onChangeText={setAddress}
            multiline
            leftIcon={<MapPin size={18} color={theme.colors.textMuted} />}
          />
          
          <Input
            label="Pincode"
            placeholder="6-digit pincode"
            keyboardType="number-pad"
            maxLength={6}
            value={pincode}
            onChangeText={setPincode}
          />
          
          <Button 
            title="Save Changes" 
            onPress={saveProfile} 
            loading={saving} 
            disabled={saving} 
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 0, paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[4], 
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 24, color: theme.colors.textPrimary },
  logoutBtn: { padding: 8, marginRight: -8 },
  
  scrollArea: { flex: 1 },
  scrollContent: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },
  
  walletCard: { padding: theme.spacing[5] },
  walletHeader: { flexDirection: 'row', alignItems: 'center' },
  walletIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  walletLabel: { fontFamily: theme.typography.fontFamily.regular, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 2 },
  walletBalance: { fontFamily: theme.typography.fontFamily.bold, fontSize: 28, color: theme.colors.textPrimary },
  walletLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  walletLinkText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: 14, color: theme.colors.primary600 },

  profileCard: { padding: theme.spacing[5] },
  sectionTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: 18, color: theme.colors.textPrimary, marginBottom: theme.spacing[4] },
});
