import { Icon } from '@/components/icon';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requireOptionalNativeModule } from 'expo';

import { ConnectionDot } from '@/components/connection-dot';
import type { HeroInspection3D as HeroInspection3DComponent } from '@/components/hero-inspection-3d';
import type { MiniScene3D as MiniScene3DComponent, MiniSceneBuilder } from '@/components/mini-scene-3d';
import { SafeTopGuard } from '@/components/safe-top-guard';
import { TypewriterGreeting } from '@/components/typewriter-greeting';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCountUp } from '@/hooks/use-count-up';
import { useOpenJob } from '@/hooks/use-open-job';
import {
  fetchJobs,
  fetchUnreadNotificationCount,
  InspectionJob,
  jobAddressText,
  jobCustomerName,
  resolveApiUrl,
} from '@/lib/api';
import {
  filterInProgressJobs,
  isCompletedStatus,
  isInProgressStatus,
} from '@/lib/job-status';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';
import { syncAppBadge } from '@/lib/notification-inbox';
import { buildCalendarIcon, buildCheckBadgeIcon, buildProgressIcon } from '@/lib/stat-icons-3d';

// expo-gl throws at import time when its native module is missing (e.g. an older
// dev build), so only load the 3D components when the module exists.
const GL_AVAILABLE = Boolean(requireOptionalNativeModule('ExponentGLObjectManager'));
/* eslint-disable @typescript-eslint/no-require-imports */
const HeroInspection3D: typeof HeroInspection3DComponent | null = GL_AVAILABLE
  ? require('@/components/hero-inspection-3d').HeroInspection3D
  : null;
const MiniScene3D: typeof MiniScene3DComponent | null = GL_AVAILABLE
  ? require('@/components/mini-scene-3d').MiniScene3D
  : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const STAT_ICON_SIZE = 40;
const BADGE_ICON = buildCheckBadgeIcon(false);
const BADGE_ICON_MUTED = buildCheckBadgeIcon(true);
// Greeting geometry (see heroEyebrow / heroTitle styles). The scene spans from the top of
// the eyebrow line to the bottom of the two-line title, beside them on the right.
const EYEBROW_LINE_HEIGHT = 18;
const TITLE_MARGIN_TOP = 14;
const HERO_SCENE_HEIGHT = EYEBROW_LINE_HEIGHT + TITLE_MARGIN_TOP + 38 * 2 + 4; // ≈ title bottom
const HERO_SCENE_WIDTH = 136;

const BodyBg = Brand.sheetBg;
const HeroPrimary = Brand.accent;
const HeroPrimaryLight = '#1E5059';
const HeroTextMuted = '#8FAEB8';
const STAT_CARD_HEIGHT = 116; // 3D icon + number + label
const STAT_CARD_OVERLAP = STAT_CARD_HEIGHT / 2;
const TextPrimary = '#1A1A1A';
const TextSecondary = '#6B7280';
const StatusGold = '#C49A2C';
const StatusBlue = "#14e614";
const BELL_SHAKE_PAUSE_MS = 4600;
const BELL_SHAKE_TICK_MS = 55;


function heroHelloName(firstName?: string) {
  const trimmed = firstName?.trim();
  if (!trimmed) return 'THERE';
  return trimmed.toUpperCase();
}

function profileInitial(firstName?: string) {
  return (firstName?.trim().charAt(0) || 'I').toUpperCase();
}

function NotificationBellButton({
  unreadCount,
  onPress,
}: {
  unreadCount: number;
  onPress: () => void;
}) {
  const rotation = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [focused, setFocused] = useState(true);

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
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const hasUnread = unreadCount > 0;

  useEffect(() => {
    // Only nudge for attention when there is actually something unread.
    if (!focused || reduceMotion || !hasUnread) {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 120 });
      return;
    }

    const tick = { duration: BELL_SHAKE_TICK_MS, easing: Easing.linear };
    rotation.value = withRepeat(
      withSequence(
        withTiming(0, { duration: BELL_SHAKE_PAUSE_MS, easing: Easing.linear }),
        withTiming(-14, tick),
        withTiming(14, tick),
        withTiming(-12, tick),
        withTiming(12, tick),
        withTiming(-8, tick),
        withTiming(8, tick),
        withTiming(-4, tick),
        withTiming(0, tick),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [focused, reduceMotion, hasUnread, rotation]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={styles.bellBtn}
    >
      <Animated.View style={bellStyle}>
        <Icon color="rgba(255,255,255,0.9)" name="notifications-outline" size={22} />
      </Animated.View>
      {unreadCount > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>
            {unreadCount > 9 ? '9+' : String(unreadCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}



function jobStats(jobs: InspectionJob[]) {
  return {
    total: jobs.length,
    inProgress: jobs.filter((job) => isInProgressStatus(job.status)).length,
    completed: jobs.filter((job) => isCompletedStatus(job.status)).length,
  };
}

function InProgressJobCard({
  job,
  opening,
  onOpen,
}: {
  job: InspectionJob;
  opening: boolean;
  onOpen: () => void;
}) {
  return (
    <View style={styles.jobCard}>
      <View style={styles.statusLine}>
        <View style={styles.statusDot} />
        <Text style={styles.statusLineText}>IN PROGRESS · CONTINUE</Text>
      </View>

      <Text style={styles.jobName}>{jobCustomerName(job)}</Text>
      <Text style={styles.jobAddress} numberOfLines={3}>
        {job.geocode?.formattedAddress?.trim() || jobAddressText(job) || 'No address on file'}
      </Text>

      <Pressable
        disabled={opening}
        onPress={onOpen}
        style={({ pressed }) => [styles.jobCta, pressed && styles.pressed]}
      >
        {opening ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text style={styles.jobCtaText}>Continue inspection</Text>
            <Icon color="#FFFFFF" name="chevron-forward" size={18} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function StatCard({
  value,
  label,
  variant = 'default',
  loading,
  index,
  icon,
  active,
  reduceMotion,
  onPress,
}: {
  value: number;
  label: string;
  variant?: 'default' | 'active' | 'muted';
  loading: boolean;
  /** Position in the row — staggers the entrance. */
  index: number;
  /** 3D icon scene; rebuilt when this changes. */
  icon: MiniSceneBuilder;
  /** Screen focused — pauses the 3D icon when false. */
  active: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const isActive = variant === 'active';
  const isMuted = variant === 'muted';
  const shown = useCountUp(loading ? 0 : value, reduceMotion);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * 90).duration(480)}
      style={styles.statSlot}
    >
      <Pressable
        accessibilityLabel={loading ? `${label}, loading` : `${value} ${label.toLowerCase()}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.statCard,
          isActive && styles.statCardActive,
          pressed && styles.statCardPressed,
        ]}
      >
        {MiniScene3D ? (
          <MiniScene3D
            active={active}
            background={isActive ? HeroPrimaryLight : '#FFFFFF'}
            build={icon}
            reduceMotion={reduceMotion}
            size={STAT_ICON_SIZE}
          />
        ) : null}
        <Text
          style={[
            styles.statNumber,
            isActive && styles.statNumberActive,
            isMuted && styles.statNumberMuted,
          ]}
        >
          {loading ? '—' : String(shown)}
        </Text>
        <Text
          style={[
            styles.statLabel,
            isActive && styles.statLabelActive,
            isMuted && styles.statLabelMuted,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, token, companyName } = useAuth();
  const firstName = user?.profile?.firstName?.trim();
  const avatarUri = resolveApiUrl(user?.profile?.avatarUrl);
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const { openJob, openingJobId } = useOpenJob(setJobs);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const hasLoaded = useRef(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [greetingTop, setGreetingTop] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

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
  const loadUnread = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await fetchUnreadNotificationCount(token);
      setUnreadCount(count);
      await syncAppBadge(count);
    } catch {
      // Keep last known badge if inbox API is briefly unavailable.
    }
  }, [token]);

  const loadJobs = useCallback(
    async (mode: 'full' | 'refresh' = 'full') => {
      if (!token) {
        setLoading(false);
        setError('Please log in again');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
        const cached = await loadCachedJobs();
        if (cached.length) {
          setJobs(cached);
          setLoading(false);
        }
      }
      setError('');

      try {
        const next = await fetchJobs(token);
        setJobs(next);
        await saveCachedJobs(next);
      } catch (err) {
        const cached = await loadCachedJobs();
        if (cached.length) {
          setJobs(cached);
          setError('Offline — showing saved jobs');
        } else {
          setError(err instanceof Error ? err.message : 'Could not load jobs');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      const mode = hasLoaded.current ? 'refresh' : 'full';
      hasLoaded.current = true;
      void loadJobs(mode);
      void loadUnread();
    }, [loadJobs, loadUnread]),
  );

  // A push arriving while Home is open refreshes the bell badge right away; a new
  // assignment also refreshes the job list and stat cards.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void loadUnread();
      const data = notification.request.content.data as { type?: string } | undefined;
      if (data?.type === 'job_assigned') void loadJobs('refresh');
    });
    return () => sub.remove();
  }, [loadJobs, loadUnread]);

  const stats = jobStats(jobs);
  const completedMuted = stats.completed === 0 && !loading;

  const inProgressJobs = useMemo(() => filterInProgressJobs(jobs), [jobs]);
  const previewJobs = useMemo(() => inProgressJobs.slice(0, 2), [inProgressJobs]);
  const showNoInProgress = !loading && inProgressJobs.length === 0;
  const greetingLines = useMemo(
    () => [
      {
        text: `HELLO, ${heroHelloName(firstName)}`,
        style: styles.heroEyebrow,
      },
      {
        text: 'Ready for\nthe field',
        style: styles.heroTitle,
      },
      {
        text: "Review today's assignments, open a job,\nand capture claim-ready evidence.",
        style: styles.heroBody,
      },
    ],
    [firstName],
  );
  const greetingPlayKey = token && user?.id ? `login-${user.id}-${token.slice(-12)}` : 'guest';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StatusBar style="light" />
      <SafeTopGuard color={HeroPrimary} />

      <View style={[styles.heroSection, { paddingTop: 12 }]}>
        {HeroInspection3D && greetingTop !== null ? (
          // Behind the greeting (earlier sibling), beside the title on the right.
          <View pointerEvents="none" style={[styles.heroScene, { top: greetingTop }]}>
            <HeroInspection3D
              active={screenFocused}
              height={HERO_SCENE_HEIGHT}
              reduceMotion={reduceMotion}
              width={HERO_SCENE_WIDTH}
            />
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [styles.profileAvatar, pressed && { opacity: 0.85 }]}
          >
            {avatarUri ? (
              <Image
                contentFit="cover"
                source={{ uri: avatarUri }}
                style={styles.profileAvatarImage}
                transition={150}
              />
            ) : (
              <Text style={styles.profileAvatarText}>{profileInitial(firstName)}</Text>
            )}
          </Pressable>
          <View style={styles.headerCopy}>
            <View style={styles.statusLine}>
              <ConnectionDot active={motionActive} onlineColor={StatusBlue} />
              <View>
                <Text style={styles.portalTitle}>
                  Inspector Portal
                </Text>
                {companyName ? (
                  <Text style={styles.companyName} numberOfLines={1}>
                    {companyName}
                  </Text>
                ) : null}
              </View>
            </View>

          </View>
          <NotificationBellButton
            unreadCount={unreadCount}
            onPress={() => router.push('/notifications')}
          />
        </View>

        <View onLayout={(event) => setGreetingTop(Math.round(event.nativeEvent.layout.y))}>
          <TypewriterGreeting
            playKey={greetingPlayKey}
            reduceMotion={reduceMotion}
            typeMs={32}
            lastLineTypeMs={4}
            lineGapMs={160}
            lines={greetingLines}
          />
        </View>

        <View style={styles.statRow}>
          <StatCard
            active={screenFocused}
            icon={buildCalendarIcon}
            index={0}
            label="TOTAL"
            loading={loading}
            onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'all' } })}
            reduceMotion={reduceMotion}
            value={stats.total}
          />
          <StatCard
            active={screenFocused}
            icon={buildProgressIcon}
            index={1}
            label="IN PROGRESS"
            loading={loading}
            onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'inProgress' } })}
            reduceMotion={reduceMotion}
            value={stats.inProgress}
            variant="active"
          />
          <StatCard
            // Remount when the badge switches between empty and earned.
            key={completedMuted ? 'completed-muted' : 'completed'}
            active={screenFocused}
            icon={completedMuted ? BADGE_ICON_MUTED : BADGE_ICON}
            index={2}
            label="COMPLETED"
            loading={loading}
            onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'completed' } })}
            reduceMotion={reduceMotion}
            value={stats.completed}
            variant={completedMuted ? 'muted' : 'default'}
          />
        </View>
      </View>

      <View style={styles.bodySheet}>
        <ScrollView
          bounces
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              colors={[Brand.accent]}
              onRefresh={() => {
                void loadJobs('refresh');
                void loadUnread();
              }}
              refreshing={refreshing}
              tintColor={Brand.accent}
            />
          }
        >
          {error ? (
            <Pressable onPress={() => void loadJobs('full')} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorRetry}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={Brand.accent} size="large" />
            </View>
          ) : showNoInProgress ? (
            <View style={styles.caughtUpSection}>
              <View style={styles.caughtUpIcon}>
                <Icon color="#FFFFFF" name="checkmark" size={28} />
              </View>
              <Text style={styles.caughtUpTitle}>No jobs in progress</Text>
              <Text style={styles.caughtUpText}>
                Start an inspection from the Jobs tab to see it here.
              </Text>
            </View>
          ) : (
            <View style={styles.jobsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Jobs in progress</Text>
              </View>

              {previewJobs.map((job) => (
                <InProgressJobCard
                  key={job.id}
                  job={job}
                  onOpen={() => void openJob(job)}
                  opening={openingJobId === String(job.id)}
                />
              ))}

              {inProgressJobs.length > 2 ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/jobs', params: { filter: 'inProgress' } })
                  }
                  style={({ pressed }) => [styles.viewMoreBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.viewMoreText}>View more</Text>
                  <Icon color={HeroPrimary} name="chevron-forward" size={18} />
                </Pressable>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
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
    paddingBottom: 24,
  },
  heroSection: {
    backgroundColor: HeroPrimary,
    flexShrink: 0,
    overflow: 'visible',
    paddingBottom: 0,
    paddingHorizontal: 20,
    position: 'relative',
    zIndex: 1,
  },
  heroScene: {
    position: 'absolute',
    // Right edge lines up with the bell above (20pt hero padding + a little air).
    right: 22,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: Brand.sheetBg,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  profileAvatarImage: {
    height: '100%',
    width: '100%',
  },
  profileAvatarText: {
    color: HeroPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  portalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
     marginTop: 15
  },
  companyName: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bellBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  bellBadge: {
    alignItems: 'center',
    backgroundColor: Brand.danger,
    borderColor: HeroPrimary,
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 2,
    top: 2,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  heroEyebrow: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
    lineHeight: EYEBROW_LINE_HEIGHT,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: 14,
  },
  heroBody: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 14,
    maxWidth: '92%',
  },
  statRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginBottom: -STAT_CARD_OVERLAP,
    marginTop: 28,
    zIndex: 10,
  },
  statSlot: {
    flex: 1,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 12,
    height: STAT_CARD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  statCardActive: {
    backgroundColor: HeroPrimaryLight,
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    elevation: 16,
    height: STAT_CARD_HEIGHT + 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  statCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.96 }],
  },
  statNumber: {
    color: TextPrimary,
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  statNumberActive: {
    color: '#FFFFFF',
  },
  statNumberMuted: {
    color: '#C5CDD3',
  },
  statLabel: {
    color: TextSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    textAlign: 'center',
  },
  statLabelActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  statLabelMuted: {
    color: '#C5CDD3',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: STAT_CARD_OVERLAP + 20,
    zIndex: 0,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: TextPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionLink: {
    color: TextPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  jobsSection: {
    marginBottom: 8,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBE6DF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    marginBottom: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  jobName: {
    color: TextPrimary,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  jobAddress: {
    color: TextSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  jobCta: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadiusLg,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  jobCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  viewMoreBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  viewMoreText: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    backgroundColor: StatusGold,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  statusLineText: {
    color: StatusGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  loadingArea: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  caughtUpSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  caughtUpIcon: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 16,
    width: 56,
  },
  caughtUpTitle: {
    color: TextPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  caughtUpText: {
    color: TextSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  errorBanner: {
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  errorRetry: {
    color: '#8F3A32',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
