import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { Image } from 'expo-image';
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

import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const HeroPrimary = Brand.accent;
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;

function formatRole(role?: string) {
  if (!role) return 'Field Inspector';
  const cleaned = role.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'Field Inspector';
  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function InfoIconRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIconWrap}>
        <Ionicons color={HeroPrimary} name={icon} size={18} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function CompanyRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.companyRow, last && styles.infoRowLast]}>
      <View style={styles.companyCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
      <Ionicons color={Brand.soft} name={icon} size={20} />
    </View>
  );
}

function PreferenceRow({
  title,
  subtitle,
  value,
  onValueChange,
  last = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.preferenceRow, last && styles.infoRowLast]}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceSub}>{subtitle}</Text>
      </View>
      <Switch
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: '#D8E0E4', true: HeroPrimary }}
        value={value}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, company, companyName, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const firstName = user?.profile?.firstName?.trim() || '';
  const lastName = user?.profile?.lastName?.trim() || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Inspector';
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'I';
  const roleLabel = formatRole(user?.role);
  const organization = companyName || company?.name || '—';
  const regionBranch = company?.legalName || company?.name || '—';

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
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SafeTopGuard color={HeroPrimary} />

      <View style={[styles.heroSection, { paddingTop: 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.topBarSide} />
          <Text style={styles.topBarTitle}>Profile</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setLogoutOpen(true)}
            style={styles.topBarSide}
          >
            <Ionicons color="#FFFFFF" name="log-out-outline" size={22} />
          </Pressable>
        </View>

        <View style={styles.avatarRing}>
          {user?.profile?.avatarUrl ? (
            <Image source={{ uri: user.profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroName}>{fullName}</Text>
        <Text style={styles.heroRole}>{roleLabel}</Text>
      </View>

      <View style={styles.bodySheet}>
        <ScrollView
          bounces
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inspector Information</Text>
            <InfoIconRow icon="mail-outline" label="Email Address" value={user?.email || ''} />
            <InfoIconRow
              icon="call-outline"
              label="Phone Number"
              value={user?.profile?.phone || ''}
            />
            <InfoIconRow
              icon="card-outline"
              label="License ID"
              value={user?.profile?.licenseNumber || ''}
              last
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Company</Text>
            <CompanyRow icon="business-outline" label="Organization" value={organization} />
            <CompanyRow icon="map-outline" label="Region Branch" value={regionBranch} last />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preferences</Text>
            <PreferenceRow
              onValueChange={setPushNotifications}
              subtitle="Alerts for new job assignments."
              title="Push Notifications"
              value={pushNotifications}
            />
            <PreferenceRow
              onValueChange={setLocationServices}
              subtitle="Track route for dispatch."
              title="Location Services"
              value={locationServices}
            />
            <PreferenceRow
              last
              onValueChange={setDarkMode}
              subtitle="System default."
              title="Dark Mode"
              value={darkMode}
            />
          </View>

          <Pressable
            onPress={() => setLogoutOpen(true)}
            style={({ pressed }) => [styles.logoutLink, pressed && styles.pressed]}
          >
            <Text style={styles.logoutLinkText}>Log out</Text>
          </Pressable>
        </ScrollView>
      </View>

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
  screen: {
    backgroundColor: HeroPrimary,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    flexShrink: 0,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%',
  },
  topBarSide: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  avatarRing: {
    borderColor: '#FFFFFF',
    borderRadius: 52,
    borderWidth: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  avatarImage: {
    height: 96,
    width: 96,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroRole: {
    color: HeroTextMuted,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 1,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardTitle: {
    color: '#1A1A1A',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoIconWrap: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  companyRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  companyCopy: {
    flex: 1,
  },
  preferenceRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  preferenceCopy: {
    flex: 1,
    paddingRight: 8,
  },
  preferenceTitle: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
  preferenceSub: {
    color: Brand.soft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  logoutLink: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
  logoutLinkText: {
    color: Brand.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 58, 66, 0.55)',
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
    backgroundColor: Brand.accentLight,
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  modalCancel: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: Brand.buttonRadius,
    flex: 1,
    paddingVertical: 14,
  },
  modalCancelText: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  modalConfirm: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    flex: 1,
    paddingVertical: 14,
  },
  modalConfirmText: {
    color: Brand.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
