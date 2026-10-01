import { Icon } from '@/components/icon';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  Easing,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  jobDateLabel,
  jobStatusLabel,
  resolveApiUrl,
} from '@/lib/api';
import { loadCachedJobs, loadJobsSortMode, loadJobsViewMode, saveCachedJobs, saveJobsSortMode, saveJobsViewMode, type JobsSortMode, type JobsViewMode } from '@/lib/jobs-storage';

const HeroPrimary = Brand.accent;
const HeroPrimaryLight = '#1E5059';
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const STAT_CARD_HEIGHT = 88;

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key === 'rejected') {
    return { bg: '#FEF2F2', text: '#B42318', border: '#F5C7C7' };
  }
  if (key === 'submitted' || key === 'reviewed') {
    return { bg: '#FFF8E6', text: '#9A6700', border: '#F3DFA8' };
  }
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
  if (key === 'rejected') {
    return { label: 'Fix & resend', variant: 'primary' as const };
  }
  if (key.includes('complete')) {
    return { label: 'View approved report', variant: 'ghost' as const };
  }
  if (key.includes('submit') || key === 'reviewed') {
    return { label: 'View approval status', variant: 'ghost' as const };
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
  // Rejected packages go back to the inspector, so they count as work in progress.
  return key.includes('progress') || key === 'rejected';
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

const SORT_OPTIONS: { key: JobsSortMode; label: string; hint: string }[] = [
  { key: 'newest', label: 'Newest first', hint: 'Latest scheduled / created' },
  { key: 'oldest', label: 'Oldest first', hint: 'Earliest scheduled / created' },
  { key: 'nameAsc', label: 'Name A–Z', hint: 'Customer name ascending' },
  { key: 'nameDesc', label: 'Name Z–A', hint: 'Customer name descending' },
  { key: 'status', label: 'By status', hint: 'Assigned → in progress → done' },
];

function jobSortTimestamp(job: InspectionJob) {
  const iso = job.scheduledAt || job.createdAt;
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function statusSortRank(status: string) {
  const key = status.toLowerCase();
  if (key === 'rejected') return 0;
  if (key.includes('progress')) return 1;
  if (key.includes('complete') || key.includes('submit')) return 3;
  if (key.includes('cancel')) return 4;
  return 0; // assigned / scheduled / reopened
}

function sortJobs(list: InspectionJob[], mode: JobsSortMode) {
  const next = [...list];
  next.sort((a, b) => {
    switch (mode) {
      case 'oldest':
        return jobSortTimestamp(a) - jobSortTimestamp(b);
      case 'nameAsc':
        return jobCustomerName(a).localeCompare(jobCustomerName(b), undefined, { sensitivity: 'base' });
      case 'nameDesc':
        return jobCustomerName(b).localeCompare(jobCustomerName(a), undefined, { sensitivity: 'base' });
      case 'status': {
        const rank = statusSortRank(a.status) - statusSortRank(b.status);
        if (rank !== 0) return rank;
        return jobSortTimestamp(b) - jobSortTimestamp(a);
      }
      case 'newest':
      default:
        return jobSortTimestamp(b) - jobSortTimestamp(a);
    }
  });
  return next;
}

const CHIP_GAP = 0;
/** Underline length as a fraction of one tab's width. */
const UNDERLINE_RATIO = 0.7;

function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: JobFilter;
  onChange: (next: JobFilter) => void;
  counts: Record<JobFilter, number>;
}) {
  const [rowWidth, setRowWidth] = useState(0);
  const underlineX = useSharedValue(0);
  const placed = useRef(false);

  const activeIndex = Math.max(0, FILTER_CHIPS.findIndex((chip) => chip.key === value));
  const tabWidth = rowWidth > 0 ? (rowWidth - CHIP_GAP * (FILTER_CHIPS.length - 1)) / FILTER_CHIPS.length : 0;
  const underlineWidth = tabWidth * UNDERLINE_RATIO;

  useEffect(() => {
    if (!tabWidth) return;
    const target = activeIndex * (tabWidth + CHIP_GAP) + (tabWidth - underlineWidth) / 2;
    // Jump into place on first layout; slide on every tab change after that.
    if (!placed.current) {
      placed.current = true;
      underlineX.value = target;
      return;
    }
    underlineX.value = withTiming(target, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, tabWidth, underlineWidth, underlineX]);

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
  }));

  return (
    <View
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={styles.chipsWrap}
    >
      <View style={styles.chipsRow}>
        {FILTER_CHIPS.map((chip) => {
          const active = value === chip.key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={chip.key}
              onPress={() => onChange(chip.key)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {chip.label}
              </Text>
              <View style={[styles.chipCount, active && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                  {counts[chip.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.underlineTrack}>
        <View style={styles.underlineBaseline} />
        {tabWidth > 0 ? (
          <Animated.View style={[styles.underline, { width: underlineWidth }, underlineStyle]} />
        ) : null}
      </View>
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

function JobGridItem({ index, item, onOpen }: JobListItemProps) {
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
      style={styles.gridItem}
    >
      <Pressable
        onPress={onOpen}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        style={styles.gridPressable}
      >
        <Animated.View style={[styles.gridCard, cardAnimStyle]}>
          <View style={styles.gridTop}>
            <View style={styles.gridAvatar}>
              <Text style={styles.gridAvatarText}>{customerInitial(customer)}</Text>
            </View>
            <View style={[styles.gridStatus, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text numberOfLines={1} style={[styles.gridStatusText, { color: tone.text }]}>
                {status}
              </Text>
            </View>
          </View>

          <Text numberOfLines={2} style={styles.gridName}>
            {customer}
          </Text>
          <Text numberOfLines={1} style={styles.gridJobNumber}>
            {item.jobNumber || 'Inspection'}
          </Text>
          <Text numberOfLines={2} style={styles.gridAddress}>
            {shortAddress(address)}
          </Text>
          <Text numberOfLines={1} style={styles.gridDate}>
            {date}
          </Text>

          <View style={styles.gridAction}>
            <Text numberOfLines={1} style={styles.gridActionText}>
              {action.label}
            </Text>
            <Icon color={Brand.accent} name="chevron-forward" size={14} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: JobsViewMode;
  onChange: (next: JobsViewMode) => void;
}) {
  return (
    <View style={styles.viewToggle}>
      <Pressable
        accessibilityLabel="List view"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'list' }}
        hitSlop={4}
        onPress={() => onChange('list')}
        style={({ pressed }) => [
          styles.viewToggleBtn,
          value === 'list' && styles.viewToggleBtnActive,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Icon color={value === 'list' ? Brand.surface : Brand.soft} name="list-outline" size={16} />
      </Pressable>
      <Pressable
        accessibilityLabel="Grid view"
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'grid' }}
        hitSlop={4}
        onPress={() => onChange('grid')}
        style={({ pressed }) => [
          styles.viewToggleBtn,
          value === 'grid' && styles.viewToggleBtnActive,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Icon color={value === 'grid' ? Brand.surface : Brand.soft} name="grid-outline" size={16} />
      </Pressable>
    </View>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: JobsSortMode;
  onChange: (next: JobsSortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = SORT_OPTIONS.find((option) => option.key === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    return () => setOpen(false);
  }, []);

  return (
    <>
      <Pressable
        accessibilityLabel={`Sort: ${active.label}`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.8 }]}
      >
        <Icon color={HeroPrimary} name="swap-vertical-outline" size={15} />
        <Text numberOfLines={1} style={styles.sortBtnText}>
          {active.label}
        </Text>
        <Icon color={Brand.soft} name="chevron-down" size={14} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable onPress={() => setOpen(false)} style={styles.sortOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Sort jobs</Text>
            {SORT_OPTIONS.map((option) => {
              const selected = option.key === value;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.sortOption,
                    selected && styles.sortOptionActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.sortOptionCopy}>
                    <Text style={[styles.sortOptionLabel, selected && styles.sortOptionLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.sortOptionHint}>{option.hint}</Text>
                  </View>
                  {selected ? <Icon color={HeroPrimary} name="checkmark" size={18} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { user, token } = useAuth();
  const firstName = user?.profile?.firstName?.trim();
  const avatarUri = resolveApiUrl(user?.profile?.avatarUrl);

  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const { openJob: openJobForItem } = useOpenJob(setJobs);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<JobsViewMode>('list');
  const [sortMode, setSortMode] = useState<JobsSortMode>('newest');
  const hasLoaded = useRef(false);

  useEffect(() => {
    void loadJobsViewMode().then(setViewMode);
    void loadJobsSortMode().then(setSortMode);
  }, []);

  const setViewModePersist = useCallback((next: JobsViewMode) => {
    setViewMode(next);
    void saveJobsViewMode(next);
  }, []);

  const setSortModePersist = useCallback((next: JobsSortMode) => {
    setSortMode(next);
    void saveJobsSortMode(next);
  }, []);

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
  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      if (filter === 'inProgress' && !isInProgressStatus(job.status)) return false;
      if (filter === 'completed' && !isCompletedStatus(job.status)) return false;
      if (!query) return true;
      const customer = jobCustomerName(job).toLowerCase();
      const address = jobAddressText(job).toLowerCase();
      return customer.includes(query) || address.includes(query);
    });
    return sortJobs(filtered, sortMode);
  }, [filter, jobs, query, sortMode]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StatusBar style="light" />
      <SafeTopGuard color={HeroPrimary} />
      <View style={[styles.heroSection, { paddingTop: 12 }]}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={styles.brand}>RoofCheck</Text>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.85 }]}
          >
            {avatarUri ? (
              <Image
                contentFit="cover"
                source={{ uri: avatarUri }}
                style={styles.profileBtnImage}
                transition={150}
              />
            ) : (
              <Text style={styles.profileBtnText}>
                {(firstName?.charAt(0) || 'I').toUpperCase()}
              </Text>
            )}
          </Pressable>
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
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          data={filteredJobs}
          key={viewMode}
          keyExtractor={(job) => String(job.id)}
          keyboardShouldPersistTaps="handled"
          numColumns={viewMode === 'grid' ? 2 : 1}
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
                <View style={styles.sectionHeaderCopy}>
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
                </View>
                <View style={styles.sectionActions}>
                  <SortMenu value={sortMode} onChange={setSortModePersist} />
                  <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
                </View>
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
                No jobs found for &ldquo;{search.trim()}&rdquo;. Try a different name or address.
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
          const openJob = () => {
            void openJobForItem(item);
          };

          return viewMode === 'grid' ? (
            <JobGridItem index={index} item={item} onOpen={openJob} />
          ) : (
            <JobListItem index={index} item={item} onOpen={openJob} />
          );
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
    overflow: 'hidden',
    width: 36,
  },
  profileBtnImage: {
    height: '100%',
    width: '100%',
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
  // Equal-width chips spanning the full row, so their edges line up with the search bar and cards.
  chipsWrap: {
    marginBottom: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: CHIP_GAP,
  },
  // Thin full-width rule with the active underline riding on top of it.
  underlineTrack: {
    height: 3,
    justifyContent: 'flex-end',
  },
  underlineBaseline: {
    backgroundColor: Brand.border,
    height: StyleSheet.hairlineWidth * 2,
  },
  underline: {
    backgroundColor: HeroPrimary,
    borderRadius: 2,
    height: 3,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  chip: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  chipPressed: {
    opacity: 0.6,
  },
  chipText: {
    color: Brand.soft,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Brand.ink,
    fontWeight: '800',
  },
  chipCount: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
  },
  chipCountActive: {
    backgroundColor: HeroPrimary,
  },
  chipCountText: {
    color: Brand.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: HeroPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionCount: {
    color: HeroTextMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
  },
  sortBtn: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    flexDirection: 'row',
    gap: 4,
    maxWidth: 148,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  sortBtnText: {
    color: HeroPrimary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  sortOverlay: {
    backgroundColor: 'rgba(15, 30, 36, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  sortSheet: {
    backgroundColor: Brand.surface,
    borderRadius: 20,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  sortSheetTitle: {
    color: HeroPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sortOption: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sortOptionActive: {
    backgroundColor: Brand.accentLight,
  },
  sortOptionCopy: {
    flex: 1,
  },
  sortOptionLabel: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  sortOptionLabelActive: {
    color: HeroPrimary,
  },
  sortOptionHint: {
    color: Brand.soft,
    fontSize: 12,
    marginTop: 2,
  },
  viewToggle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  viewToggleBtn: {
    alignItems: 'center',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 34,
  },
  viewToggleBtnActive: {
    backgroundColor: HeroPrimary,
  },
  gridRow: {
    gap: 10,
    justifyContent: 'flex-start',
  },
  gridItem: {
    // Keep half-width so a lone last card doesn't stretch full row.
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 10,
    width: '48.5%',
  },
  gridPressable: {
    flex: 1,
  },
  gridCard: {
    backgroundColor: Brand.surface,
    borderLeftColor: HeroPrimary,
    borderLeftWidth: 4,
    borderRadius: 18,
    elevation: 3,
    flex: 1,
    minHeight: 188,
    overflow: 'hidden',
    padding: 14,
    shadowColor: '#133A42',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  gridTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridAvatar: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  gridAvatarText: {
    color: HeroPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  gridStatus: {
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
    maxWidth: '68%',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gridStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gridName: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  gridJobNumber: {
    color: Brand.soft,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  gridAddress: {
    color: Brand.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  gridDate: {
    color: Brand.soft,
    fontSize: 11,
    marginTop: 4,
  },
  gridAction: {
    alignItems: 'center',
    borderTopColor: Brand.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'flex-end',
    marginTop: 'auto',
    paddingTop: 10,
  },
  gridActionText: {
    color: HeroPrimary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
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
    borderLeftColor: HeroPrimary,
    borderLeftWidth: 4,
    borderRadius: 20,
    elevation: 4,
    marginBottom: 14,
    overflow: 'hidden',
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
