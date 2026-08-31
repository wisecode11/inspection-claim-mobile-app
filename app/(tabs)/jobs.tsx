import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
  jobDateOfLoss,
  jobDateLabel,
  jobStatusLabel,
} from '@/lib/api';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('progress')) {
    return { bg: '#FFF4EC', text: '#B85A24', border: '#F5D4BC' };
  }
  if (key.includes('complete') || key.includes('submit')) {
    return { bg: '#EDF7F1', text: '#1D6B3F', border: '#C8E6D4' };
  }
  if (key.includes('cancel')) {
    return { bg: '#FEF2F2', text: '#B42318', border: '#F5C7C7' };
  }
  return { bg: '#EEF4F6', text: '#1B5F6E', border: '#C5D9DF' };
}

function jobAction(status: string) {
  const key = status.toLowerCase();
  if (key.includes('complete') || key.includes('submit')) {
    return { label: 'View inspection', variant: 'ghost' as const };
  }
  if (key.includes('progress')) {
    return { label: 'Continue inspection', variant: 'primary' as const };
  }
  return { label: 'Start inspection', variant: 'primary' as const };
}

function isCompletedStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('complete') || key.includes('submit');
}

function isInProgressStatus(status: string) {
  const key = status.toLowerCase();
  return key.includes('progress');
}

function isTodayStatus(status: string) {
  const key = status.toLowerCase();
  return key === 'assigned' || key === 'scheduled' || key === 'reopened';
}

function jobStats(jobs: InspectionJob[]) {
  return {
    today: jobs.filter((job) => isTodayStatus(job.status)).length,
    inProgress: jobs.filter((job) => isInProgressStatus(job.status)).length,
    completed: jobs.filter((job) => isCompletedStatus(job.status)).length,
  };
}

function displayName(firstName?: string) {
  if (!firstName) return 'there';
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
function customerInitial(name: string) {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || '?';
}

function shortAddress(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return 'No address on file';
  if (trimmed.length <= 72) return trimmed;

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return `${trimmed.slice(0, 69)}…`;
}

type JobListItemProps = {
  index: number;
  item: InspectionJob;
  onOpen: () => void;
};

function JobListItem({ index, item, onOpen }: JobListItemProps) {
  const scale = useSharedValue(1);
  const customer = jobCustomerName(item);
  const address = jobAddressText(item);
  const date = jobDateLabel(item);
  const status = jobStatusLabel(item.status);
  const tone = statusTone(item.status);
  const action = jobAction(item.status);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 80, 320))
        .duration(480)
        .springify()
        .damping(18)}
    >
      <Pressable
        onPress={onOpen}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
      >
        <Animated.View style={[styles.card, cardAnimStyle]}>
          <View style={styles.cardContent}>
            <View style={styles.cardTop}>
              <View style={styles.identity}>
                <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.avatarText, { color: tone.text }]}>
                    {customerInitial(customer)}
                  </Text>
                </View>
                <View style={styles.identityCopy}>
                  <Text style={styles.name}>{customer}</Text>
                  <Text style={styles.jobNumber}>{item.jobNumber || 'Inspection'}</Text>
                </View>
              </View>
              <View style={[styles.status, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <View style={[styles.statusDot, { backgroundColor: tone.text }]} />
                <Text style={[styles.statusText, { color: tone.text }]}>{status}</Text>
              </View>
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons color={Brand.muted} name="location-outline" size={17} />
                <Text style={styles.detailText}>{shortAddress(address)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons color={Brand.muted} name="time-outline" size={17} />
                <Text style={styles.detailText}>{date}</Text>
              </View>
              {item.claim?.claimNumber ? (
                <View style={styles.detailRow}>
                  <Ionicons color={Brand.muted} name="document-text-outline" size={17} />
                  <Text style={styles.detailText}>Claim {item.claim.claimNumber}</Text>
                </View>
              ) : null}
            </View>

            {item.notes ? (
              <View style={styles.notesRow}>
                <Ionicons color={Brand.muted} name="chatbubble-ellipses-outline" size={15} />
                <Text numberOfLines={2} style={styles.notes}>
                  {item.notes}
                </Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              {action.variant === 'primary' ? (
                <View style={styles.primaryAction}>
                  <Text style={styles.primaryActionText}>{action.label}</Text>
                  <Ionicons color={Brand.surface} name="arrow-forward" size={16} />
                </View>
              ) : (
                <View style={styles.ghostAction}>
                  <Text style={styles.ghostActionText}>{action.label}</Text>
                  <Ionicons color={Brand.accent} name="chevron-forward" size={18} />
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const { resetForJob } = useInspection();
  const { user, token } = useAuth();
  const firstName = user?.profile?.firstName?.trim();

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);

  const loadJobs = useCallback(async (mode: 'full' | 'refresh' = 'full') => {
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
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      const mode = hasLoaded.current ? 'refresh' : 'full';
      hasLoaded.current = true;
      void loadJobs(mode);
    }, [loadJobs]),
  );

  const stats = jobStats(jobs);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.list}
        data={jobs}
        keyExtractor={(job) => String(job.id)}
        keyboardShouldPersistTaps="handled"
        style={styles.listView}
        refreshControl={
          <RefreshControl
            colors={[Brand.accent]}
            onRefresh={() => {
              void loadJobs('refresh');
            }}
            refreshing={refreshing}
            tintColor={Brand.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View entering={FadeInDown.duration(420).springify()} style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons color={Brand.ink} name="home" size={18} />
              </View>
              <Text style={styles.brand}>RoofCheck</Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(70).duration(420).springify()}
              style={styles.welcomeBlock}
            >
              <Text style={styles.greeting}>
                {timeGreeting()},{' '}
                <Text style={styles.greetingName}>{displayName(firstName)}</Text>
              </Text>
              <Text style={styles.headline}>
                {loading ? (
                  'Loading your schedule…'
                ) : (
                  <>
                    <Text style={styles.headlineAccent}>{jobs.length}</Text>
                    {` ${jobs.length === 1 ? 'inspection' : 'inspections'} scheduled today`}
                  </>
                )}
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Animated.View>

            <View style={styles.statRow}>
              <Animated.View
                entering={FadeInDown.delay(140).duration(420).springify()}
                style={styles.statCard}
              >
                <View style={styles.statIcon}>
                  <Ionicons color={Brand.muted} name="today-outline" size={16} />
                </View>
                <Text style={styles.statNumber}>{loading ? '—' : String(stats.today)}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </Animated.View>
              <Animated.View
                entering={FadeInDown.delay(180).duration(420).springify()}
                style={styles.statCard}
              >
                <View style={styles.statIcon}>
                  <Ionicons color={Brand.muted} name="hourglass-outline" size={16} />
                </View>
                <Text style={styles.statNumber}>{loading ? '—' : String(stats.inProgress)}</Text>
                <Text style={styles.statLabel}>In progress</Text>
              </Animated.View>
              <Animated.View
                entering={FadeInDown.delay(220).duration(420).springify()}
                style={styles.statCard}
              >
                <View style={styles.statIcon}>
                  <Ionicons color={Brand.muted} name="checkmark-circle-outline" size={16} />
                </View>
                <Text style={styles.statNumber}>{loading ? '—' : String(stats.completed)}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </Animated.View>
            </View>

            <Animated.Text
              entering={FadeIn.delay(280).duration(360)}
              style={styles.sectionLabel}
            >
              Your jobs
            </Animated.Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Brand.accent} style={styles.emptySpinner} />
          ) : (
            <Animated.View entering={FadeInUp.duration(500).springify()} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons color={Brand.accent} name="clipboard-outline" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptyText}>
                When a job is assigned to you, it will appear here.
              </Text>
              <Pressable onPress={() => void loadJobs('full')} style={styles.retry}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            </Animated.View>
          )
        }
        renderItem={({ item, index }) => {
          const customer = jobCustomerName(item);
          const address = jobAddressText(item);
          const date = jobDateLabel(item);

          const openJob = () => {
            void (async () => {
              let nextStatus = item.status;
              if (token) {
                try {
                  const key = item.status.toLowerCase();
                  if (key === 'assigned' || key === 'reopened') {
                    const started = await acceptJob(token, item.id);
                    nextStatus = started.status;
                    setJobs((current) =>
                      current.map((job) =>
                        job.id === item.id ? { ...job, status: started.status } : job
                      )
                    );
                  }
                } catch {
                  // Offline / already started — continue with local draft.
                }
              }

              const coords = jobCoordinates(item);
              resetForJob({
                jobId: item.id,
                customer,
                address: item.geocode?.formattedAddress?.trim() || address,
                date,
                jobStatus: nextStatus,
                latitude: coords?.latitude ?? null,
                longitude: coords?.longitude ?? null,
                locationConfirmed: Boolean(item.geocode?.confirmed),
                geocodeError: item.geocode?.error || '',
                dateOfLoss: jobDateOfLoss(item),
                claimNumber: item.claim?.claimNumber || '',
                policyNumber: item.claim?.policyNumber || '',
                phone: item.customer?.phone || '',
                email: item.customer?.email || '',
              });
              router.push('/property');
            })();
          };

          return <JobListItem index={index} item={item} onOpen={openJob} />;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.background, flex: 1 },
  listView: { flex: 1 },
  list: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 8 },
  header: { marginBottom: 4 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 22 },
  logo: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  brand: { color: Brand.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  welcomeBlock: { marginBottom: 18 },
  greeting: {
    color: Brand.ink,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  greetingName: { color: Brand.accent },
  headline: {
    color: Brand.muted,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 21,
    marginTop: 6,
  },
  headlineAccent: {
    color: Brand.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  error: { color: Brand.danger, fontSize: 13, lineHeight: 18, marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: '#F4F7F8',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    marginBottom: 10,
    width: 30,
  },
  statNumber: { color: Brand.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { color: Brand.soft, fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionLabel: {
    color: Brand.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  emptySpinner: { marginTop: 40 },
  empty: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF4EE',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  emptyTitle: { color: Brand.ink, fontSize: 18, fontWeight: '800' },
  emptyText: { color: Brand.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  retry: {
    backgroundColor: Brand.ink,
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: Brand.surface, fontSize: 14, fontWeight: '800' },
  card: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#163A4A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  cardContent: { paddingBottom: 16, paddingHorizontal: 18, paddingTop: 16 },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  avatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  identityCopy: { flex: 1 },
  jobNumber: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  status: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  name: { color: Brand.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  details: { gap: 10, marginTop: 18 },
  detailRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  detailText: { color: Brand.muted, flex: 1, fontSize: 14, lineHeight: 20 },
  notesRow: {
    alignItems: 'flex-start',
    borderLeftColor: Brand.border,
    borderLeftWidth: 2,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingLeft: 10,
  },
  notes: { color: Brand.soft, flex: 1, fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  actionRow: { marginTop: 18 },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryActionText: { color: Brand.surface, fontSize: 15, fontWeight: '700' },
  ghostAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  ghostActionText: { color: Brand.accent, fontSize: 15, fontWeight: '700' },
});
