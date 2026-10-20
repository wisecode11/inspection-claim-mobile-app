import { Icon, type IconName } from '@/components/icon';
import { CommonActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import {
  Camera,
  CloudLightning,
  Hammer,
  HardHat,
  Ruler,
  ClipboardList,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';

import { requireOptionalNativeModule } from 'expo';

import { ConnectionDot } from '@/components/connection-dot';
import type {
  ProfileToolModel,
  ProfileToolPlacement,
  ProfileTools3D as ProfileTools3DComponent,
} from '@/components/profile-tools-3d';
import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { resolveApiUrl, updatePushPreferenceWithApi } from '@/lib/api';
import { getStableDeviceId } from '@/lib/device-id';
import { loadPushPrefs, savePushPrefs } from '@/lib/push-prefs';
import { syncPushRegistration } from '@/lib/push-notifications';

// expo-gl throws at import time when its native module is missing (e.g. an older
// dev build), so only load the 3D tools when the module exists.
const GL_AVAILABLE = Boolean(requireOptionalNativeModule('ExponentGLObjectManager'));
/* eslint-disable @typescript-eslint/no-require-imports */
const ProfileTools3D: typeof ProfileTools3DComponent | null = GL_AVAILABLE
  ? require('@/components/profile-tools-3d').ProfileTools3D
  : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const HeroPrimary = Brand.accent;
const BodyBg = Brand.sheetBg;
const StatusBlue = '#32CD32';
const StatusText = '#8FAEB8';

const AVATAR_SIZE = 80;
const HERO_HEIGHT = 268;
/** Avatar centre, in % of the hero. The 3D network and the overlay share this point. */
const NETWORK_HUB = { x: 50, y: 48 };

type NetworkNode = {
  Icon: LucideIcon;
  model: ProfileToolModel;
  /** Centre of the node, in % of the hero's width / height. */
  x: number;
  y: number;
  size: number;
  color: string;
  /** Other node indexes this one also connects to, besides the line back to the avatar. */
  links: number[];
  /** Extra space between this tool and its node, in points. */
  toolGap?: number;
  /** Shift the map pin horizontally, in points. Negative moves it left. */
  pinShiftX?: number;
};

// Laid out like the geometric-network reference: a few solid tools around the avatar,
// clear of the name and the "Profile" title.
// Positions are an even ring around the avatar, matching the reference:
// lightning under the title, side tools level with the photo, lower tools
// beside the name rather than in the empty band above the card.
const NETWORK_NODES: NetworkNode[] = [
  { Icon: CloudLightning, model: 'lightning', x: 50, y: 30, size: 20, color: '#FFD84D', links: [1, 2], toolGap: 18, pinShiftX: -36 },
  { Icon: Hammer, model: 'hammer', x: 16, y: 32, size: 30, color: '#E7B56A', links: [3] },
  { Icon: Ruler, model: 'ruler', x: 84, y: 26, size: 28, color: '#FFD84D', links: [4] },
  { Icon: Wrench, model: 'wrench', x: 10, y: 48, size: 28, color: '#6AA4FF', links: [] },
  { Icon: ClipboardList, model: 'clipboard', x: 90, y: 42, size: 30, color: '#E7B56A', links: [6] },
  { Icon: Camera, model: 'camera', x: 22, y: 66, size: 26, color: '#6AA4FF', links: [] },
  { Icon: HardHat, model: 'hardHat', x: 80, y: 64, size: 28, color: '#F5B533', links: [] },
];

const TOOL_PLACEMENTS: ProfileToolPlacement[] = NETWORK_NODES.map((node) => ({
  model: node.model,
  x: node.x,
  y: node.y,
  size: node.size,
  links: node.links,
  toolGap: node.toolGap,
  pinShiftX: node.pinShiftX,
  lockFacing: node.model === 'lightning',
}));

function GeometricNetworkFallback({ width, height }: { width: number; height: number }) {
  const px = (percent: number) => (percent / 100) * width;
  const py = (percent: number) => (percent / 100) * height;
  const hubX = px(NETWORK_HUB.x);
  const hubY = py(NETWORK_HUB.y);
  const vanishY = height * 0.16;
  const bottom = height;
  const rows = 8;
  const cols = 12;
  const horizontals: { x1: number; x2: number; y: number }[] = [];
  const verticals: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let row = 0; row <= rows; row++) {
    const t = Math.pow(row / rows, 1.65);
    const y = vanishY + (bottom - vanishY) * t;
    const dist = (y - vanishY) / (bottom - vanishY);
    const half = width * (0.05 + dist * 0.62);
    horizontals.push({ x1: width / 2 - half, x2: width / 2 + half, y });
  }
  for (let col = 0; col <= cols; col++) {
    const u = col / cols;
    verticals.push({
      x1: width * (0.45 + u * 0.1),
      y1: vanishY,
      x2: width * (0.04 + u * 0.92),
      y2: bottom,
    });
  }

  const points = NETWORK_NODES.map((node) => ({ x: px(node.x), y: py(node.y) }));

  return (
    <View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height={height} width={width}>
        {horizontals.map((line, index) => (
          <Line
            key={`h-${index}`}
            stroke="rgba(103,215,226,0.34)"
            strokeWidth={1}
            x1={line.x1}
            x2={line.x2}
            y1={line.y}
            y2={line.y}
          />
        ))}
        {verticals.map((line, index) => (
          <Line
            key={`v-${index}`}
            stroke="rgba(103,215,226,0.34)"
            strokeWidth={1}
            x1={line.x1}
            x2={line.x2}
            y1={line.y1}
            y2={line.y2}
          />
        ))}
        {points.map((point, index) => {
          const pinX = point.x + (NETWORK_NODES[index].pinShiftX ?? 0);
          const dx = pinX - hubX;
          const dy = point.y - hubY;
          const len = Math.hypot(dx, dy) || 1;
          const gap = AVATAR_SIZE / 2 + 10;
          return (
            <Line
              key={`hub-${index}`}
              stroke="rgba(142,234,242,0.8)"
              strokeWidth={1.4}
              x1={hubX + (dx / len) * gap}
              x2={pinX - (dx / len) * 8}
              y1={hubY + (dy / len) * gap}
              y2={point.y - (dy / len) * 8}
            />
          );
        })}
        {NETWORK_NODES.flatMap((node, index) =>
          node.links
            .filter((other) => other > index && points[other])
            .map((other) => (
              <Line
                key={`link-${index}-${other}`}
                stroke="rgba(142,234,242,0.55)"
                strokeWidth={1.2}
                x1={points[index].x}
                x2={points[other].x}
                y1={points[index].y}
                y2={points[other].y}
              />
            )),
        )}
        {points.map((point, index) => (
          <Circle
            key={`pin-${index}`}
            cx={point.x + (NETWORK_NODES[index].pinShiftX ?? 0)}
            cy={point.y}
            fill="#2AD4C8"
            r={5.5}
          />
        ))}
        {points.map((point, index) => (
          <Circle
            key={`pin-hole-${index}`}
            cx={point.x + (NETWORK_NODES[index].pinShiftX ?? 0)}
            cy={point.y - 1}
            fill="#F4FFFE"
            r={2}
          />
        ))}
      </Svg>
      {NETWORK_NODES.map((node, index) => {
        const point = points[index];
        const Icon = node.Icon;
        const dx = point.x - hubX;
        const dy = point.y - hubY;
        const len = Math.hypot(dx, dy) || 1;
        const gap = node.toolGap ?? 12;
        const iconX = point.x + (dx / len) * gap - node.size / 2;
        const iconY = point.y + (dy / len) * gap - node.size / 2;
        return (
          <View key={node.model} style={{ left: iconX, position: 'absolute', top: iconY }}>
            <Icon color={node.color} size={node.size} strokeWidth={1.7} />
          </View>
        );
      })}
    </View>
  );
}

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
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIconWrap}>
        <Icon color={Brand.accent} name={icon} size={18} />
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
  icon: IconName;
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
      <Icon color={Brand.soft} name={icon} size={20} />
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

/** Full-screen view of the profile photo. Tap anywhere outside the buttons to close. */
function ProfilePhotoViewer({
  uri,
  name,
  visible,
  onClose,
  onChangePhoto,
}: {
  uri: string;
  name: string;
  visible: boolean;
  onClose: () => void;
  onChangePhoto: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Close photo"
        onPress={onClose}
        style={styles.viewerBackdrop}
      >
        <View style={[styles.viewerTopBar, { paddingTop: insets.top + 8 }]}>
          <Text numberOfLines={1} style={styles.viewerTitle}>
            {name}
          </Text>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}
          >
            <Icon color="#FFFFFF" name="close" size={22} />
          </Pressable>
        </View>

        <View style={styles.viewerImageWrap}>
          <Image
            accessibilityLabel={`${name} profile photo`}
            contentFit="contain"
            source={{ uri }}
            style={styles.viewerImage}
            transition={200}
          />
        </View>

        <View style={[styles.viewerActions, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onChangePhoto}
            style={({ pressed }) => [styles.viewerChange, pressed && styles.pressed]}
          >
            <Icon color={HeroPrimary} name="camera-outline" size={18} />
            <Text style={styles.viewerChangeText}>Change photo</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { user, company, companyName, logout, token } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [heroSize, setHeroSize] = useState<{ width: number; height: number } | null>(null);
  const [tools3dFailed, setTools3dFailed] = useState(false);
  const show3dTools = Boolean(ProfileTools3D) && !tools3dFailed;

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
  const online = useOnlineStatus();

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
  const avatarUri = resolveApiUrl(user?.profile?.avatarUrl);
  const openEditProfile = () => router.push('/edit-profile');
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
      <StatusBar style="light" />
      <SafeTopGuard color={HeroPrimary} />

      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setHeroSize((current) =>
            current && current.width === width && current.height === height ? current : { width, height },
          );
        }}
        style={styles.heroSection}
      >
        {show3dTools && ProfileTools3D ? (
          heroSize ? (
            <ProfileTools3D
              key={`${heroSize.width}x${heroSize.height}-h${NETWORK_HUB.y}-pin${NETWORK_NODES[0].pinShiftX}-beam-blue`}
              active={screenFocused}
              background={HeroPrimary}
              height={heroSize.height}
              hub={NETWORK_HUB}
              hubClearance={AVATAR_SIZE / 2 + 10}
              onError={() => setTools3dFailed(true)}
              reduceMotion={reduceMotion}
              tools={TOOL_PLACEMENTS}
              width={heroSize.width}
            />
          ) : null
        ) : heroSize ? (
          <GeometricNetworkFallback height={heroSize.height} width={heroSize.width} />
        ) : null}

        <Text style={styles.heroTitle}>Profile</Text>

        <View style={styles.avatarAnchor}>
          <Pressable
            accessibilityHint={avatarUri ? 'Opens your profile photo' : 'Opens edit profile'}
            accessibilityLabel={`${fullName}, ${roleLabel}`}
            accessibilityRole="button"
            onPress={avatarUri ? () => setPhotoOpen(true) : openEditProfile}
            style={styles.avatarRing}
          >
            {avatarUri ? (
              <Image contentFit="cover" source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
            hitSlop={6}
            onPress={openEditProfile}
            style={styles.avatarEditBadge}
          >
            <Icon color={HeroPrimary} name="camera-outline" size={14} />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <Text style={styles.heroName}>{fullName}</Text>
          <View style={styles.statusLine}>
            <ConnectionDot active={motionActive} onlineColor={StatusBlue} />
            <Text style={[styles.statusText, !online && styles.statusTextOffline]}>
              {online ? 'Inspector · on duty' : 'Inspector · offline'}
            </Text>
          </View>
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
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, styles.cardHeaderTitle]}>Inspector Information</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={openEditProfile}
                style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}
              >
                <Icon color={Brand.accent} name="pencil" size={14} />
                <Text style={styles.editLinkText}>Edit</Text>
              </Pressable>
            </View>
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
            <Text style={styles.cardTitle}>Security</Text>
            <Pressable
              accessibilityHint="Opens the change password screen"
              accessibilityRole="button"
              onPress={() => router.push('/change-password')}
              style={({ pressed }) => [styles.infoRow, styles.infoRowLast, pressed && styles.pressed]}
            >
              <View style={styles.infoIconWrap}>
                <Icon color={Brand.accent} name="lock-closed-outline" size={18} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.preferenceTitle}>Change Password</Text>
                <Text style={styles.preferenceSub}>Update the password you use to sign in.</Text>
              </View>
              <Icon color={Brand.soft} name="chevron-forward" size={20} />
            </Pressable>
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

      {avatarUri ? (
        <ProfilePhotoViewer
          name={fullName}
          onChangePhoto={() => {
            setPhotoOpen(false);
            openEditProfile();
          }}
          onClose={() => setPhotoOpen(false)}
          uri={avatarUri}
          visible={photoOpen}
        />
      ) : null}

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
              <Icon color={Brand.accent} name="log-out-outline" size={26} />
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
    backgroundColor: HeroPrimary,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 2,
    zIndex: 5,
  },
  avatarAnchor: {
    height: AVATAR_SIZE,
    left: '50%',
    marginLeft: -AVATAR_SIZE / 2,
    position: 'absolute',
    top: (NETWORK_HUB.y / 100) * HERO_HEIGHT - AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    zIndex: 5,
  },
  identity: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: (NETWORK_HUB.y / 100) * HERO_HEIGHT + AVATAR_SIZE / 2 + 8,
    zIndex: 5,
  },
  avatarRing: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: '#FFFFFF',
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    elevation: 6,
    height: AVATAR_SIZE,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    width: AVATAR_SIZE,
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
  // Sits on the avatar's bottom-right edge (45° point of the 88px circle inside the ring block).
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: HeroPrimary,
    borderRadius: 13,
    borderWidth: 2,
    bottom: -2,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 26,
    zIndex: 6,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusText: {
    color: StatusText,
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextOffline: {
    color: '#FF8A8C',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    marginTop: -22,
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderTitle: {
    flex: 1,
    marginBottom: 0,
  },
  editLink: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editLinkText: {
    color: Brand.accent,
    fontSize: 13,
    fontWeight: '700',
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
  viewerBackdrop: {
    backgroundColor: 'rgba(5, 18, 21, 0.94)',
    flex: 1,
  },
  viewerTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  viewerTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  viewerClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  viewerImageWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  viewerImage: {
    aspectRatio: 1,
    borderRadius: 16,
    width: '100%',
  },
  viewerActions: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  viewerChange: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  viewerChangeText: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '800',
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
