import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { updatePushPreferenceWithApi } from '@/lib/api';
import { getStableDeviceId } from '@/lib/device-id';
import { loadPushPrefs, savePushPrefs } from '@/lib/push-prefs';
import { syncPushRegistration } from '@/lib/push-notifications';

const HeroPrimary = Brand.accent;
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const PulseBlue = 'rgba(181,203,211,0.5)';
const StatusBlue = "#32CD32";
const StatusText = '#8FAEB8';
const GlowBlue = '181,203,211';

const AVATAR_SIZE = 88;
const RING_SIZE = 104;
const ARC_SIZE = AVATAR_SIZE - 16;
const PULSE_MS = 3200;
const ROTATE_MS = 6000;
const DRIFT_MS = 9000;

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
        <Ionicons color={Brand.accent} name={icon} size={18} />
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
        trackColor={{ false: '#D8E0E4', true: Brand.accent }}
        value={value}
      />
    </View>
  );
}

function StatusDotBlink({ active }: { active: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }

    // Full blink cycle ≈ 2s
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 200 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.statusHalo}>
      <Animated.View style={[styles.statusDot, style]} />
    </View>
  );
}

function PulseRing({ delayMs, active }: { delayMs: number; active: boolean }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (!active) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 0.85;
      opacity.value = 0;
      return;
    }

    scale.value = 0.85;
    opacity.value = 0.55;
    const ease = Easing.out(Easing.cubic);
    scale.value = withDelay(
      delayMs,
      withRepeat(withTiming(1.45, { duration: PULSE_MS, easing: ease }), -1, false),
    );
    opacity.value = withDelay(
      delayMs,
      withRepeat(withTiming(0, { duration: PULSE_MS, easing: ease }), -1, false),
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, delayMs, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      importantForAccessibility="no"
      pointerEvents="none"
      style={[styles.pulseRing, style]}
    />
  );
}

function RotatingArc({ active }: { active: boolean }) {
  const rotation = useSharedValue(0);
  const stroke = 1.5;
  const radius = (ARC_SIZE - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.45;

  useEffect(() => {
    if (!active) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATE_MS, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [active, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      importantForAccessibility="no"
      pointerEvents="none"
      style={[styles.rotatingArc, style]}
    >
      <Svg height={ARC_SIZE} width={ARC_SIZE}>
        <Circle
          cx={ARC_SIZE / 2}
          cy={ARC_SIZE / 2}
          fill="none"
          r={radius}
          stroke={`rgba(${GlowBlue},0.35)`}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </Svg>
    </Animated.View>
  );
}

function AmbientGlow({ active }: { active: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }

    const ease = Easing.inOut(Easing.ease);
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DRIFT_MS / 2, easing: ease }),
        withTiming(0, { duration: DRIFT_MS / 2, easing: ease }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [active, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * 14 },
      { translateY: progress.value * -10 },
    ],
  }));

  return (
    <Animated.View
      importantForAccessibility="no"
      pointerEvents="none"
      style={[styles.ambientGlow, style]}
    >
      <View style={styles.ambientGlowCore}>
        <View style={styles.ambientGlowOuter} />
        <View style={styles.ambientGlowMid} />
        <View style={styles.ambientGlowInner} />
      </View>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, company, companyName, logout, token } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void loadPushPrefs().then((prefs) => setPushNotifications(prefs.enabled));
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  const motionActive = screenFocused && !reduceMotion;

  const onTogglePush = async (next: boolean) => {
    setPushNotifications(next);
    setPushBusy(true);
    try {
      await savePushPrefs({ enabled: next });
      if (!token) return;
      const deviceId = await getStableDeviceId();
      if (next) {
        await syncPushRegistration(token);
      } else {
        try {
          await updatePushPreferenceWithApi(token, { deviceId, pushEnabled: false });
        } catch {
          // Device may not be registered yet — local preference is enough.
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const firstName = user?.profile?.firstName?.trim() || '';
  const lastName = user?.profile?.lastName?.trim() || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Inspector';
  const initial =
    firstName.charAt(0).toUpperCase() ||
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
        <AmbientGlow active={motionActive} />

        <View style={styles.topBar}>
          <View style={styles.topBarSide} />
          <Text style={styles.topBarTitle}>Profile</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            hitSlop={10}
            onPress={() => setLogoutOpen(true)}
            style={styles.topBarSide}
          >
            
            <Ionicons color="#DC2626" name="log-out-outline" size={22} />
          </Pressable>
        </View>

        <View style={styles.avatarBlock}>
          <PulseRing active={motionActive} delayMs={0} />
          <PulseRing active={motionActive} delayMs={1100} />
          <PulseRing active={motionActive} delayMs={2200} />
          <RotatingArc active={motionActive} />

          <View
            accessibilityLabel={`${fullName}, ${roleLabel}`}
            accessibilityRole="image"
            style={styles.avatarRing}
          >
            {user?.profile?.avatarUrl ? (
              <Image source={{ uri: user.profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.heroName}>{fullName}</Text>
        <View style={styles.statusLine}>
          <StatusDotBlink active={motionActive} />
          <Text style={styles.statusText}>Inspector · on duty</Text>
        </View>
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
              onValueChange={(next) => {
                if (!pushBusy) void onTogglePush(next);
              }}
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
    overflow: 'hidden',
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  ambientGlow: {
    borderRadius: 95,
    height: 190,
    left: -56,
    opacity: 0.45,
    overflow: 'hidden',
    position: 'absolute',
    top: -48,
    width: 190,
  },
  ambientGlowCore: {
    alignItems: 'center',
    borderRadius: 95,
    height: 190,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 190,
  },
  ambientGlowOuter: {
    backgroundColor: `rgba(${GlowBlue},0.03)`,
    borderRadius: 95,
    height: 190,
    overflow: 'hidden',
    position: 'absolute',
    width: 190,
  },
  ambientGlowMid: {
    backgroundColor: `rgba(${GlowBlue},0.055)`,
    borderRadius: 66,
    height: 132,
    overflow: 'hidden',
    position: 'absolute',
    width: 132,
  },
  ambientGlowInner: {
    backgroundColor: `rgba(${GlowBlue},0.1)`,
    borderRadius: 38,
    height: 76,
    overflow: 'hidden',
    position: 'absolute',
    width: 76,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    width: '100%',
    zIndex: 2,
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
  avatarBlock: {
    alignItems: 'center',
    height: RING_SIZE * 1.45,
    justifyContent: 'center',
    marginBottom: 0,
    width: RING_SIZE * 1.45,
    zIndex: 2,
  },
  pulseRing: {
    borderColor: PulseBlue,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    height: RING_SIZE,
    position: 'absolute',
    width: RING_SIZE,
  },
  rotatingArc: {
    height: ARC_SIZE,
    position: 'absolute',
    width: ARC_SIZE,
  },
  avatarRing: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    height: AVATAR_SIZE,
    overflow: 'hidden',
    width: AVATAR_SIZE,
    zIndex: 3,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    height: AVATAR_SIZE - 4,
    justifyContent: 'center',
    width: AVATAR_SIZE - 4,
  },
  avatarImage: {
    height: AVATAR_SIZE - 4,
    width: AVATAR_SIZE - 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 16,
    textAlign: 'center',
    zIndex: 2,
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
    zIndex: 2,
  },
  statusHalo: {
    alignItems: 'center',
    backgroundColor: `rgba(${GlowBlue},0.18)`,
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 14,
  },
  statusDot: {
    backgroundColor: StatusBlue,
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: 6,
  },
  statusText: {
    color: StatusText,
    fontSize: 12,
    fontWeight: '500',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
    marginTop: -14,
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
