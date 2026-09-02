import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useOpenJob } from '@/hooks/use-open-job';
import {
  fetchJobs,
  InspectionJob,
  jobAddressText,
  jobCustomerName,
} from '@/lib/api';
import {
  filterInProgressJobs,
  isActionableStatus,
  isCompletedStatus,
  isInProgressStatus,
} from '@/lib/job-status';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';

const BodyBg = Brand.sheetBg;
const HeroPrimary = Brand.accent;
const HeroPrimaryLight = '#1E5059';
const HeroTextMuted = '#8FAEB8';
const STAT_CARD_HEIGHT = 88;
const STAT_CARD_OVERLAP = STAT_CARD_HEIGHT / 2;
const TextPrimary = '#1A1A1A';
const TextSecondary = '#6B7280';
const StatusGold = '#C49A2C';

function heroHelloName(firstName?: string) {
  const trimmed = firstName?.trim();
  if (!trimmed) return 'THERE';
  return trimmed.toUpperCase();
}

function profileInitial(firstName?: string) {
  return (firstName?.trim().charAt(0) || 'I').toUpperCase();
}

function jobStats(jobs: InspectionJob[]) {
  const actionable = jobs.filter((job) => isActionableStatus(job.status));
  return {
    today: actionable.filter((job) => {
      const key = job.status.toLowerCase();
      return key === 'assigned' || key === 'scheduled' || key === 'reopened';
    }).length,
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
            <Ionicons color="#FFFFFF" name="chevron-forward" size={18} />
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
}: {
  value: number;
  label: string;
  variant?: 'default' | 'active' | 'muted';
  loading: boolean;
}) {
  const isActive = variant === 'active';
  const isMuted = variant === 'muted';

  return (
    <View
      style={[
        styles.statCard,
        isActive && styles.statCardActive,
      ]}
    >
      <Text
        style={[
          styles.statNumber,
          isActive && styles.statNumberActive,
          isMuted && styles.statNumberMuted,
        ]}
      >
        {loading ? '—' : String(value)}
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
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, token, companyName } = useAuth();
  const firstName = user?.profile?.firstName?.trim();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const { openJob, openingJobId } = useOpenJob(setJobs);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);

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
    }, [loadJobs]),
  );

  const stats = jobStats(jobs);

  const inProgressJobs = useMemo(() => filterInProgressJobs(jobs), [jobs]);
  const previewJobs = useMemo(() => inProgressJobs.slice(0, 2), [inProgressJobs]);
  const showNoInProgress = !loading && inProgressJobs.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SafeTopGuard color={HeroPrimary} />
      <ScrollView
        bounces
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            colors={[Brand.accent]}
            onRefresh={() => void loadJobs('refresh')}
            refreshing={refreshing}
            tintColor="#FFFFFF"
          />
        }
      >
        <View style={[styles.heroSection, { paddingTop: 12 }]}>
          <View style={styles.heroOrbLarge} pointerEvents="none" />
          <View style={styles.heroOrbSmall} pointerEvents="none" />

          <View style={styles.headerRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{profileInitial(firstName)}</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.portalTitle}>Inspector Portal</Text>
              {companyName ? (
                <Text style={styles.companyName} numberOfLines={1}>
                  {companyName}
                </Text>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" hitSlop={10} style={styles.bellBtn}>
              <Ionicons color="rgba(255,255,255,0.9)" name="notifications-outline" size={22} />
              <View style={styles.bellDot} />
            </Pressable>
          </View>

          <Text style={styles.heroEyebrow}>HELLO, {heroHelloName(firstName)}</Text>
          <Text style={styles.heroTitle}>{'Ready for\nthe field'}</Text>
          <Text style={styles.heroBody}>
            {"Review today's assignments, open a job,\nand capture claim-ready evidence."}
          </Text>

          <View style={styles.statRow}>
            <StatCard loading={loading} value={stats.today} label="TODAY" />
            <StatCard loading={loading} value={stats.inProgress} label="IN PROGRESS" variant="active" />
            <StatCard
              loading={loading}
              value={stats.completed}
              label="COMPLETED"
              variant={stats.completed === 0 && !loading ? 'muted' : 'default'}
            />
          </View>
        </View>

        <View style={styles.bodySheet}>
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
                <Ionicons color="#FFFFFF" name="checkmark" size={28} />
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
                  onPress={() => router.push('/jobs-in-progress')}
                  style={({ pressed }) => [styles.viewMoreBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.viewMoreText}>View more</Text>
                  <Ionicons color={HeroPrimary} name="chevron-forward" size={18} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
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
  },
  heroSection: {
    backgroundColor: HeroPrimary,
    overflow: 'visible',
    paddingBottom: 0,
    paddingHorizontal: 20,
    position: 'relative',
    zIndex: 1,
  },
  heroOrbLarge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 999,
    height: 240,
    position: 'absolute',
    right: -70,
    top: -30,
    width: 240,
  },
  heroOrbSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 999,
    bottom: 60,
    height: 140,
    position: 'absolute',
    right: 20,
    width: 140,
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
    width: 48,
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
  bellDot: {
    backgroundColor: StatusGold,
    borderColor: HeroPrimary,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 8,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
  },
  heroEyebrow: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
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
  statCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 12,
    flex: 1,
    height: STAT_CARD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
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
  statNumber: {
    color: TextPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
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
    flexGrow: 1,
    minHeight: 420,
    paddingBottom: 24,
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
