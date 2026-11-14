import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Camera, ImageIcon, FileText, Trash2, LogOut, Repeat, Plus, ExternalLink, Phone } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useToast } from '../../components/Toast';
import { confirmDialog } from '../../dialog';
import { api, type VendorDocType, type VendorProfile } from '../../api';
import { session } from '../../session';
import { pickImage, uploadImage } from '../../vendor/upload';

const DOC_TYPES: { id: VendorDocType; label: string }[] = [
  { id: 'aadhaar', label: 'Aadhaar' },
  { id: 'driving_licence', label: 'Driving licence' },
  { id: 'electricity_bill', label: 'Electricity bill' },
  { id: 'other', label: 'Other' },
];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Vendor profile (client V2 item 5.4): profile photo + ID documents. Documents
 * are uploaded as private files — MV Cleaning admins can view them; there is no
 * approval step. Also: switch back to Customer mode, and log out.
 */
export function VendorProfileScreen() {
  const [p, setP] = useState<VendorProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<'photo' | 'document' | null>(null);
  const [adding, setAdding] = useState(false);
  const [docType, setDocType] = useState<VendorDocType>('aadhaar');
  const [docLabel, setDocLabel] = useState('');
  const [switching, setSwitching] = useState(false);
  const navigation = useNavigation<any>();
  const toast = useToast();

  const load = useCallback(async () => {
    const t = await session.getToken();
    if (!t) return;
    try {
      setP(await api.vendorProfile(t));
    } catch {
      /* keep last known */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changePhoto = async (source: 'camera' | 'library') => {
    const t = await session.getToken();
    if (!t) return;
    try {
      const img = await pickImage(source, true);
      if (!img) return;
      setUploading('photo');
      const up = await uploadImage(t, 'photo', img);
      setP(await api.vendorSetPhoto(t, up.secureUrl));
      toast.success('Profile photo updated.');
    } catch (e: any) {
      toast.error(e.message || 'Could not update photo');
    } finally {
      setUploading(null);
    }
  };

  const addDocument = async (source: 'camera' | 'library') => {
    if (docType === 'other' && !docLabel.trim()) {
      return toast.error('Type what the document is, e.g. PAN card.');
    }
    const t = await session.getToken();
    if (!t) return;
    try {
      const img = await pickImage(source, false);
      if (!img) return;
      setUploading('document');
      const up = await uploadImage(t, 'document', img);
      setP(await api.vendorAddDocument(t, {
        type: docType,
        label: docType === 'other' ? docLabel.trim() : undefined,
        publicId: up.publicId,
        format: up.format,
      }));
      setAdding(false);
      setDocLabel('');
      toast.success('Document uploaded.');
    } catch (e: any) {
      toast.error(e.message || 'Could not upload document');
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (id: string, label: string) => {
    const ok = await confirmDialog({ title: `Remove ${label}?`, confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    const t = await session.getToken();
    if (!t) return;
    try {
      setP(await api.vendorRemoveDocument(t, id));
    } catch (e: any) {
      toast.error(e.message || 'Could not remove document');
    }
  };

  const switchToCustomer = async () => {
    const t = await session.getToken();
    if (!t) return;
    setSwitching(true);
    try {
      const res = await api.switchToCustomer(t);
      await session.saveSession(res.accessToken, 'customer');
      navigation.reset({ index: 0, routes: [{ name: 'CustomerApp' }] });
    } catch (e: any) {
      toast.error(e.message || 'Could not switch to Customer mode');
    } finally {
      setSwitching(false);
    }
  };

  const logout = async () => {
    const ok = await confirmDialog({ title: 'Log out', message: 'Are you sure you want to log out?', confirmLabel: 'Log out', destructive: true });
    if (!ok) return;
    await session.clear();
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  if (!p) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary600} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.colors.primary600]} />}
      >
        {/* Photo + identity */}
        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {uploading === 'photo'
                ? <ActivityIndicator color={theme.colors.primary600} />
                : p.photoUrl
                  ? <Image source={{ uri: p.photoUrl }} style={styles.avatarImg} accessibilityLabel="Your profile photo" />
                  : <User size={32} color={theme.colors.primary600} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <View style={styles.inline}>
                <Phone size={13} color={theme.colors.textMuted} />
                <Text style={styles.muted}>{p.contactNumber}</Text>
              </View>
              {!!p.area && <Text style={styles.muted}>{p.area}</Text>}
            </View>
          </View>
          <View style={styles.btnRow}>
            <SmallBtn icon={<Camera size={16} color={theme.colors.primary600} />} label="Take photo" onPress={() => changePhoto('camera')} disabled={!!uploading} />
            <SmallBtn icon={<ImageIcon size={16} color={theme.colors.primary600} />} label={p.photoUrl ? 'Change photo' : 'Add photo'} onPress={() => changePhoto('library')} disabled={!!uploading} />
          </View>
          {p.services.length > 0 && (
            <Text style={[styles.muted, { marginTop: theme.spacing[3] }]}>Services: {p.services.join(', ')}</Text>
          )}
        </View>

        {/* Documents */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Documents</Text>
          <Text style={styles.muted}>Upload a clear photo of each ID. Only MV Cleaning can see these.</Text>

          {p.documents.length === 0 && !adding && (
            <Text style={[styles.muted, { marginTop: theme.spacing[3] }]}>No documents uploaded yet.</Text>
          )}
          {p.documents.map((d) => (
            <View key={d.id} style={styles.doc}>
              <View style={styles.docIcon}><FileText size={18} color={theme.colors.primary600} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{d.typeLabel}</Text>
                <Text style={styles.mutedXs}>Uploaded {fmt(d.uploadedAt)}</Text>
              </View>
              {!!d.viewUrl && (
                <TouchableOpacity onPress={() => Linking.openURL(d.viewUrl)} style={styles.iconBtn} accessibilityLabel={`View ${d.typeLabel}`}>
                  <ExternalLink size={18} color={theme.colors.primary600} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => removeDocument(d.id, d.typeLabel)} style={styles.iconBtn} accessibilityLabel={`Remove ${d.typeLabel}`}>
                <Trash2 size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {adding ? (
            <View style={styles.addBox}>
              <Text style={styles.label}>Which document?</Text>
              <View style={styles.chips}>
                {DOC_TYPES.map((t) => {
                  const sel = docType === t.id;
                  return (
                    <TouchableOpacity key={t.id} onPress={() => setDocType(t.id)} style={[styles.chip, sel && styles.chipSel]} accessibilityState={{ selected: sel }}>
                      <Text style={[styles.chipText, sel && styles.chipTextSel]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {docType === 'other' && (
                <Input label="Document name" placeholder="e.g. PAN card" value={docLabel} onChangeText={setDocLabel} maxLength={40} />
              )}
              {uploading === 'document' ? (
                <View style={styles.uploadingRow}><ActivityIndicator color={theme.colors.primary600} /><Text style={styles.muted}>Uploading…</Text></View>
              ) : (
                <View style={styles.btnRow}>
                  <SmallBtn icon={<Camera size={16} color={theme.colors.primary600} />} label="Take photo" onPress={() => addDocument('camera')} />
                  <SmallBtn icon={<ImageIcon size={16} color={theme.colors.primary600} />} label="From gallery" onPress={() => addDocument('library')} />
                </View>
              )}
              <TouchableOpacity onPress={() => setAdding(false)} style={{ alignSelf: 'center', marginTop: theme.spacing[3] }} disabled={!!uploading}>
                <Text style={styles.muted}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Button title="Add document" variant="secondary" onPress={() => setAdding(true)} style={{ marginTop: theme.spacing[4] }} icon={<Plus size={16} color={theme.colors.primary600} />} />
          )}
        </View>

        <TouchableOpacity style={styles.row} onPress={switchToCustomer} disabled={switching} activeOpacity={0.7}>
          <Repeat size={18} color={theme.colors.primary600} />
          <Text style={styles.rowText}>{switching ? 'Switching…' : 'Switch to Customer mode'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={logout} activeOpacity={0.7}>
          <LogOut size={18} color={theme.colors.error} />
          <Text style={[styles.rowText, { color: theme.colors.error }]}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallBtn({ icon, label, onPress, disabled }: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.smallBtn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      {icon}
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4],
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes['2xl'], color: theme.colors.textPrimary },
  content: { padding: theme.spacing[4], paddingBottom: 100, gap: theme.spacing[4] },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing[4] },
  cardTitle: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.md, color: theme.colors.textPrimary, marginBottom: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 72, height: 72 },
  name: { fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.sizes.lg, color: theme.colors.textPrimary },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  muted: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  mutedXs: { fontFamily: theme.typography.fontFamily.regular, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  btnRow: { flexDirection: 'row', gap: theme.spacing[3], marginTop: theme.spacing[4] },
  smallBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: theme.spacing[3], borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.primary200, backgroundColor: theme.colors.primary50 },
  smallBtnText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.primary700 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], paddingVertical: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  docIcon: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary50, justifyContent: 'center', alignItems: 'center' },
  docTitle: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
  iconBtn: { padding: theme.spacing[2] },
  addBox: { marginTop: theme.spacing[4], padding: theme.spacing[3], borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSubtle },
  label: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary, marginBottom: theme.spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[3] },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipSel: { backgroundColor: theme.colors.primary600, borderColor: theme.colors.primary600 },
  chipText: { fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  chipTextSel: { color: theme.colors.textInverse },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingVertical: theme.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingVertical: theme.spacing[4], backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  rowText: { fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.sizes.md, color: theme.colors.primary700 },
});
