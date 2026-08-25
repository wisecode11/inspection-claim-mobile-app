import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, companyName, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [jobAlerts, setJobAlerts] = useState(true);
  const [draftReminders, setDraftReminders] = useState(true);

  const firstName = user?.profile?.firstName?.trim() || '';
  const lastName = user?.profile?.lastName?.trim() || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Inspector';
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'I';

  const onConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'login' }],
        }),
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSub}>
          {companyName ? `${companyName} · inspector account` : 'Inspector account and preferences'}
        </Text>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.role}>{user?.role || 'Inspector'}</Text>
            {companyName ? <Text style={styles.company}>{companyName}</Text> : null}
            <Text style={styles.email}>{user?.email || '—'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Company</Text>
        <View style={styles.card}>
          <InfoRow label="Company name" value={companyName} last />
        </View>

        <Text style={styles.sectionLabel}>Inspector information</Text>
        <View style={styles.card}>
          <InfoRow label="Full name" value={fullName} />
          <InfoRow label="Email" value={user?.email || ''} />
          <InfoRow label="Phone" value={user?.profile?.phone || ''} />
          <InfoRow label="License #" value={user?.profile?.licenseNumber || ''} />
          <InfoRow label="Status" value={user?.status || ''} last />
        </View>

        <Text style={styles.sectionLabel}>Account settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Job alerts</Text>
              <Text style={styles.settingSub}>Notify when new jobs are assigned</Text>
            </View>
            <Switch
              trackColor={{ false: '#D8E0E4', true: '#F3C4A8' }}
              thumbColor={jobAlerts ? Brand.accent : '#f4f3f4'}
              onValueChange={setJobAlerts}
              value={jobAlerts}
            />
          </View>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Draft reminders</Text>
              <Text style={styles.settingSub}>Remind me to finish open inspections</Text>
            </View>
            <Switch
              trackColor={{ false: '#D8E0E4', true: '#F3C4A8' }}
              thumbColor={draftReminders ? Brand.accent : '#f4f3f4'}
              onValueChange={setDraftReminders}
              value={draftReminders}
            />
          </View>
        </View>

        <Pressable
          onPress={() => setLogoutOpen(true)}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        >
          <Ionicons color="#FFFFFF" name="log-out-outline" size={18} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={logoutOpen}
        onRequestClose={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons color={Brand.accent} name="log-out-outline" size={26} />
            </View>
            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalCopy}>
              You will need to sign in again to access assigned jobs and inspections.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                disabled={loggingOut}
                onPress={() => setLogoutOpen(false)}
                style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={loggingOut}
                onPress={() => void onConfirmLogout()}
                style={({ pressed }) => [styles.modalConfirm, pressed && styles.pressed]}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Log out</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.background, flex: 1 },
  content: { paddingBottom: 36, paddingHorizontal: 20 },
  pageTitle: { color: Brand.ink, fontSize: 28, fontWeight: '800', marginTop: 8 },
  pageSub: { color: Brand.muted, fontSize: 14, marginBottom: 20, marginTop: 4 },
  hero: {
    alignItems: 'center',
    backgroundColor: Brand.ink,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 22,
    padding: 18,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: { color: Brand.surface, fontSize: 20, fontWeight: '800' },
  heroCopy: { flex: 1 },
  name: { color: Brand.surface, fontSize: 20, fontWeight: '800' },
  role: { color: '#C9D9DF', fontSize: 13, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  company: { color: '#FFD7C2', fontSize: 13, fontWeight: '700', marginTop: 4 },
  email: { color: '#A9BDC5', fontSize: 13, marginTop: 4 },
  sectionLabel: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 18,
    marginBottom: 22,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  infoRow: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: Brand.muted, fontSize: 14, marginRight: 12 },
  infoValue: {
    color: Brand.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingCopy: { flex: 1 },
  settingTitle: { color: Brand.ink, fontSize: 15, fontWeight: '800' },
  settingSub: { color: Brand.muted, fontSize: 12, marginTop: 2 },
  logoutBtn: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 16,
  },
  logoutText: { color: Brand.surface, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.88 },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(22, 58, 74, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 22,
    padding: 22,
    width: '100%',
  },
  modalIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFF4EE',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
    width: 52,
  },
  modalTitle: {
    color: Brand.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalCopy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },
  modalCancelText: { color: Brand.ink, fontSize: 15, fontWeight: '800' },
  modalConfirm: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },
  modalConfirmText: { color: Brand.surface, fontSize: 15, fontWeight: '800' },
});
