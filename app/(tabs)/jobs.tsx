import { Icon } from '@/components/icon';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeTopGuard } from '@/components/safe-top-guard';
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

const HeroPrimary = Brand.accent;
const HeroPrimaryLight = '#1E5059';
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const STAT_CARD_HEIGHT = 88;

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('progress')) {
    return { bg: '#FFF4E8', text: '#C45A1A', border: '#F5DCC8' };
  }
  if (key.includes('complete') || key.includes('submit')) {
    return { bg: '#EDF7F1', text: '#1D6B3F', border: '#C8E6D4' };
  }
  if (key.includes('cancel')) {
    return { bg: '#FEF2F2', text: '#B42318', border: '#F5C7C7' };
  }
  return { bg: Brand.accentLight, text: Brand.accent, border: Brand.accentMuted };
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

type JobFilter = 'all' | 'inProgress' | 'completed';

const FILTER_CHIPS: { key: JobFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: JobFilter;
  onChange: (next: JobFilter) => void;
  counts: Record<JobFilter, number>;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.chipsRow}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
    >
      {FILTER_CHIPS.map((chip) => {
        const active = value === chip.key;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {chip.label}{' '}
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>
                {counts[chip.key]}
              </Text>
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
    <View style={[styles.statCard, isActive && styles.statCardActive]}>
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
      entering={FadeIn.delay(Math.min(index * 40, 200)).duration(220)}
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
          <View style={styles.cardTop}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{customerInitial(customer)}</Text>
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.name}>{customer}</Text>
                <Text style={styles.jobNumber}>{item.jobNumber || 'Inspection'}</Text>
              </View>
            </View>
            <View style={[styles.status, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={[styles.statusText, { color: tone.text }]}>{status}</Text>
            </View>
          </View>

          <Text style={styles.addressText}>{shortAddress(address)}</Text>
          <Text style={styles.dateText}>{date}</Text>

          {item.notes ? (
            <View style={styles.notesBox}>
              <Text numberOfLines={3} style={styles.notes}>
                {item.notes}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {action.variant === 'primary' ? (
              <View style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>{action.label}</Text>
                <Icon color={Brand.surface} name="chevron-forward" size={18} />
              </View>
            ) : (
              <View style={styles.ghostAction}>
                <Text style={styles.ghostActionText}>{action.label}</Text>
                <Icon color={Brand.accent} name="chevron-forward" size={18} />
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { resetForJob } = useInspection();
  const { user, token } = useAuth();
  const firstName = user?.profile?.firstName?.trim();

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');
  const [search, setSearch] = useState('');
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (params.filter === 'all' || params.filter === 'inProgress' || params.filter === 'completed') {
        setFilter(params.filter);
      }
    }, [params.filter]),
  );

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
  const query = search.trim().toLowerCase();
  const filteredJobs = jobs.filter((job) => {
    if (filter === 'inProgress' && !isInProgressStatus(job.status)) return false;
    if (filter === 'completed' && !isCompletedStatus(job.status)) return false;
    if (!query) return true;
    const customer = jobCustomerName(job).toLowerCase();
    const address = jobAddressText(job).toLowerCase();
    return customer.includes(query) || address.includes(query);
  });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SafeTopGuard color={HeroPrimary} />
      <View style={[styles.heroSection, { paddingTop: 12 }]}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={styles.brand}>RoofCheck</Text>
          <View style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>
              {(firstName?.charAt(0) || 'I').toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(40).duration(220)}
          style={styles.welcomeBlock}
        >
          <Text style={styles.greeting}>{timeGreeting()},</Text>
          <Text style={styles.greetingName}>{displayName(firstName)}</Text>
          <Text style={styles.headline}>
            {loading
              ? 'Loading your schedule…'
              : `${jobs.length} ${jobs.length === 1 ? 'inspection' : 'inspections'} scheduled today`}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
      </View>

      <View style={styles.bodySheet}>
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredJobs}
          keyExtractor={(job) => String(job.id)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
            <View>
              <View style={styles.statRow}>
                <StatCard loading={loading} value={stats.today} label="Today" />
                <StatCard
                  loading={loading}
                  value={stats.inProgress}
                  label="In progress"
                  variant="active"
                />
                <StatCard
                  loading={loading}
                  value={stats.completed}
                  label="Completed"
                  variant={stats.completed === 0 && !loading ? 'muted' : 'default'}
                />
              </View>

              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Icon color={Brand.soft} name="search" size={18} />
                  <TextInput
                    autoCorrect={false}
                    onChangeText={setSearch}
                    placeholder="Search by name or address"
                    placeholderTextColor={Brand.soft}
                    returnKeyType="search"
                    style={styles.searchInput}
                    value={search}
                  />
                  {search.length > 0 ? (
                    <Pressable hitSlop={8} onPress={() => setSearch('')}>
                      <Icon color={Brand.soft} name="close-circle" size={18} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel="Reset filters"
                  onPress={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                  style={styles.filterIconBtn}
                >
                  <Icon color="#FFFFFF" name="options-outline" size={20} />
                </Pressable>
              </View>

              <FilterChips
                value={filter}
                onChange={setFilter}
                counts={{ all: jobs.length, inProgress: stats.inProgress, completed: stats.completed }}
              />

              <Animated.View
                entering={FadeIn.delay(280).duration(360)}
                style={styles.sectionHeader}
              >
                <Text style={styles.sectionTitle}>
                  {filter === 'inProgress'
                    ? 'In progress'
                    : filter === 'completed'
                      ? 'Completed'
                      : 'Your jobs'}
                </Text>
                <Text style={styles.sectionCount}>
                  {loading
                    ? '—'
                    : query
                      ? `${filteredJobs.length} match${filteredJobs.length === 1 ? '' : 'es'}`
                      : `${filteredJobs.length} total`}
                </Text>
              </Animated.View>
            </View>
          }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Brand.accent} style={styles.emptySpinner} />
          ) : query ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon color={Brand.accent} name="search" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyText}>
                No jobs found for "{search.trim()}". Try a different name or address.
              </Text>
              <Pressable onPress={() => setSearch('')} style={styles.retry}>
                <Text style={styles.retryText}>Clear search</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon color={Brand.accent} name="clipboard-outline" size={28} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'inProgress'
                  ? 'No jobs in progress'
                  : filter === 'completed'
                    ? 'No completed jobs'
                    : 'No jobs yet'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'inProgress'
                  ? 'Jobs you start will show up here.'
                  : filter === 'completed'
                    ? 'Jobs you finish will show up here.'
                    : 'When a job is assigned to you, it will appear here.'}
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
                        job.id === item.id ? { ...job, status: started.status } : job,
                      ),
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: HeroPrimary,
    flex: 1,
  },
  listView: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  heroSection: {
    backgroundColor: HeroPrimary,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  brand: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  profileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  welcomeBlock: {
    marginBottom: 4,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  greetingName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  headline: {
    color: HeroTextMuted,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  error: {
    color: '#FFB4B4',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
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
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 10,
    flex: 1,
    height: STAT_CARD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  statCardActive: {
    backgroundColor: HeroPrimaryLight,
    elevation: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  statNumber: {
    color: HeroPrimary,
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
    color: Brand.soft,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  statLabelActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  statLabelMuted: {
    color: '#C5CDD3',
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 3,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  searchInput: {
    color: Brand.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  filterIconBtn: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  chipsScroll: {
    marginBottom: 20,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: Brand.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: HeroPrimary,
    borderColor: HeroPrimary,
  },
  chipText: {
    color: Brand.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipCount: {
    color: Brand.soft,
    fontSize: 13,
    fontWeight: '700',
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: HeroPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionCount: {
    color: HeroTextMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySpinner: {
    marginTop: 40,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  emptyTitle: {
    color: HeroPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadius,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: Brand.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 20,
    elevation: 4,
    marginBottom: 14,
    padding: 18,
    shadowColor: '#133A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: HeroPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  identityCopy: {
    flex: 1,
  },
  jobNumber: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  status: {
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  name: {
    color: HeroPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  addressText: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  dateText: {
    color: Brand.soft,
    fontSize: 13,
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: Brand.accentLight,
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notes: {
    color: Brand.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    marginTop: 16,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadius,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryActionText: {
    color: Brand.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  ghostAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'flex-end',
    paddingVertical: 4,
  },
  ghostActionText: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
