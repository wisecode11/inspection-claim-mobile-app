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

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  acceptJob,
  fetchJobs,
  InspectionJob,
  jobAddressText,
  jobCoordinates,
  jobCustomerName,
  jobDateLabel,
  jobDateOfLoss,
  jobStatusLabel,
} from '@/lib/api';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';

const HomeBg = '#F5F8FA';
const PortalAccent = '#A83808';
const TextPrimary = '#1A1A1A';
const TextSecondary = '#666666';

function heroHelloName(firstName?: string) {
  const trimmed = firstName?.trim();
  if (!trimmed) return 'there';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function profileInitial(firstName?: string) {
  const letter = (firstName?.trim().charAt(0) || 'I').toUpperCase();
  return letter;
}

function FieldHeroBanner({
  firstName,
  company,
}: {
  firstName?: string;
  company: string;
}) {
  return (
    <View style={styles.fieldHero}>
      <View style={[styles.heroOrb, styles.heroOrbLarge]} />
      <View style={[styles.heroOrb, styles.heroOrbSmall]} />
      <View style={styles.heroContent}>
        <Text style={styles.heroHello}>Hello, {heroHelloName(firstName)}</Text>
        {company ? <Text style={styles.heroCompany}>from {company}</Text> : null}
        <Text style={styles.heroTitle}>Ready for the field</Text>
        <Text style={styles.heroBody}>
          Review today&apos;s assignments, open a job, and capture claim-ready evidence.
        </Text>
      </View>
    </View>
  );
}

function isCompletedStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('complete') || key.includes('submit');
}

function isInProgressStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('progress');
}

function isActionableStatus(status: string) {
  const key = status.toLowerCase();
  return (
    isInProgressStatus(key) ||
    key === 'assigned' ||
    key === 'scheduled' ||
    key === 'reopened'
  );
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

function addressLines(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return { street: 'No address on file', city: '' };
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { street: parts[0], city: parts.slice(1).join(', ') };
  }
  return { street: trimmed, city: '' };
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('progress')) {
    return { bg: '#FFF4EC', text: '#B85A24', border: '#F5D4BC' };
  }
  return { bg: '#EEF4F6', text: '#1B5F6E', border: '#C5D9DF' };
}

function StatCard({
  value,
  label,
  accentNumber = false,
  loading,
}: {
  value: number;
  label: string;
  accentNumber?: boolean;
  loading: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statNumber, accentNumber && styles.statNumberAccent]}>
        {loading ? '—' : String(value)}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, token, companyName } = useAuth();
  const { resetForJob } = useInspection();
  const firstName = user?.profile?.firstName?.trim();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
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

  const actionableJobs = useMemo(
    () => jobs.filter((job) => isActionableStatus(job.status)),
    [jobs],
  );

  const featuredJob = useMemo(() => {
    const inProgress = actionableJobs.find((job) => isInProgressStatus(job.status));
    if (inProgress) return inProgress;
    return actionableJobs[0] ?? null;
  }, [actionableJobs]);

  const showCaughtUp = !loading && !featuredJob;

  const openJob = useCallback(
    async (job: InspectionJob) => {
      const customer = jobCustomerName(job);
      const address = jobAddressText(job);
      const date = jobDateLabel(job);

      setOpeningJobId(String(job.id));
      let nextStatus = job.status;

      if (token) {
        try {
          const key = job.status.toLowerCase();
          if (key === 'assigned' || key === 'reopened') {
            const started = await acceptJob(token, job.id);
            nextStatus = started.status;
            setJobs((current) =>
              current.map((entry) =>
                entry.id === job.id ? { ...entry, status: started.status } : entry,
              ),
            );
          }
        } catch {
          // Offline / already started — continue with local draft.
        }
      }

      const coords = jobCoordinates(job);
      resetForJob({
        jobId: job.id,
        customer,
        address: job.geocode?.formattedAddress?.trim() || address,
        date,
        jobStatus: nextStatus,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        locationConfirmed: Boolean(job.geocode?.confirmed),
        geocodeError: job.geocode?.error || '',
        dateOfLoss: jobDateOfLoss(job),
        claimNumber: job.claim?.claimNumber || '',
        policyNumber: job.claim?.policyNumber || '',
        phone: job.customer?.phone || '',
        email: job.customer?.email || '',
      });
      setOpeningJobId(null);
      router.push('/property');
    },
    [resetForJob, router, token],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={[PortalAccent]}
            onRefresh={() => void loadJobs('refresh')}
            refreshing={refreshing}
            tintColor={PortalAccent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{profileInitial(firstName)}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.portalTitle}>Inspector Portal</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={10} style={styles.bellBtn}>
            <Ionicons color={PortalAccent} name="notifications-outline" size={24} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        <FieldHeroBanner company={companyName} firstName={firstName} />

        {error ? (
          <Pressable onPress={() => void loadJobs('full')} style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </Pressable>
        ) : null}

        <View style={styles.statRow}>
          <StatCard loading={loading} value={stats.today} label="TODAY" />
          <StatCard loading={loading} value={stats.inProgress} label="IN PROGRESS" accentNumber />
          <StatCard loading={loading} value={stats.completed} label="COMPLETED" accentNumber />
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={PortalAccent} size="large" />
          </View>
        ) : featuredJob ? (
          <View style={styles.featuredSection}>
            <View style={styles.featuredCard}>
              <Text style={styles.priorityLabel}>PRIORITY JOB</Text>
              <Text style={styles.featuredEyebrow}>
                {isInProgressStatus(featuredJob.status) ? 'Continue' : 'Up next'}
              </Text>
              <Text style={styles.featuredName}>{jobCustomerName(featuredJob)}</Text>
              {(() => {
                const lines = addressLines(jobAddressText(featuredJob));
                return (
                  <Text style={styles.featuredAddress} numberOfLines={2}>
                    {lines.city ? `${lines.street}, ${lines.city}` : lines.street}
                  </Text>
                );
              })()}
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusTone(featuredJob.status).bg,
                    borderColor: statusTone(featuredJob.status).border,
                  },
                ]}
              >
                <Text style={[styles.statusText, { color: statusTone(featuredJob.status).text }]}>
                  {jobStatusLabel(featuredJob.status)}
                </Text>
              </View>
              <Pressable
                disabled={openingJobId === String(featuredJob.id)}
                onPress={() => void openJob(featuredJob)}
                style={({ pressed }) => [styles.featuredCta, pressed && styles.pressed]}
              >
                {openingJobId === String(featuredJob.id) ? (
                  <ActivityIndicator color={Brand.surface} size="small" />
                ) : (
                  <Text style={styles.featuredCtaText}>
                    {isInProgressStatus(featuredJob.status)
                      ? 'Continue inspection'
                      : 'Start inspection'}
                  </Text>
                )}
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.navigate('/jobs')}
              style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
            >
              <Text style={styles.viewAllText}>View all</Text>
              <Ionicons color={PortalAccent} name="chevron-forward" size={16} />
            </Pressable>
          </View>
        ) : showCaughtUp ? (
          <View style={styles.emptyArea}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconOuter}>
                <View style={styles.emptyIconInner}>
                  <Ionicons color="#FFFFFF" name="checkmark" size={28} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyText}>
                You have no pending jobs. Pull down to refresh your schedule.
              </Text>
            </View>
            <Pressable
              onPress={() => router.navigate('/jobs')}
              style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
            >
              <Text style={styles.viewAllText}>View all</Text>
              <Ionicons color={PortalAccent} name="chevron-forward" size={16} />
            </Pressable>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: HomeBg, flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  fieldHero: {
    backgroundColor: Brand.ink,
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
    position: 'relative',
  },
  heroOrb: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 999,
    position: 'absolute',
  },
  heroOrbLarge: {
    height: 190,
    right: -48,
    top: -36,
    width: 190,
  },
  heroOrbSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -52,
    height: 140,
    right: 24,
    width: 140,
  },
  heroContent: {
    zIndex: 1,
  },
  heroHello: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  heroCompany: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginTop: 12,
  },
  heroBody: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: '92%',
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: '#E8EEF0',
    borderColor: '#DCE4E8',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  profileAvatarText: {
    color: Brand.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  portalTitle: {
    color: PortalAccent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bellBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  bellDot: {
    backgroundColor: '#E53935',
    borderColor: HomeBg,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 8,
    position: 'absolute',
    right: 6,
    top: 6,
    width: 8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  loadingArea: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  featuredSection: {
    marginTop: 14,
  },
  viewAllButton: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: PortalAccent,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  viewAllText: {
    color: PortalAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyArea: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 260,
    paddingVertical: 24,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 14,
    elevation: 2,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statNumber: {
    color: TextPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statNumberAccent: {
    color: PortalAccent,
  },
  statLabel: {
    color: TextSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 300,
    paddingHorizontal: 12,
  },
  emptyIconOuter: {
    alignItems: 'center',
    backgroundColor: '#E8F2F8',
    borderRadius: 52,
    height: 104,
    justifyContent: 'center',
    marginBottom: 20,
    width: 104,
  },
  emptyIconInner: {
    alignItems: 'center',
    backgroundColor: PortalAccent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyTitle: {
    color: TextPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyText: {
    color: TextSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  featuredCard: {
    alignSelf: 'stretch',
    backgroundColor: Brand.surface,
    borderRadius: 16,
    elevation: 2,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  priorityLabel: {
    color: PortalAccent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  featuredEyebrow: {
    color: Brand.soft,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  featuredName: {
    color: TextPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  featuredAddress: {
    color: TextSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  featuredCta: {
    alignItems: 'center',
    backgroundColor: PortalAccent,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 46,
    paddingVertical: 12,
  },
  featuredCtaText: {
    color: Brand.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: { opacity: 0.92 },
  errorBanner: {
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { color: Brand.danger, fontSize: 14, fontWeight: '700' },
  errorRetry: { color: '#8F3A32', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
