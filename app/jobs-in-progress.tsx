import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useOpenJob } from '@/hooks/use-open-job';
import {
  fetchJobs,
  InspectionJob,
  jobAddressText,
  jobCustomerName,
  jobDateLabel,
} from '@/lib/api';
import { filterInProgressJobs } from '@/lib/job-status';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';

const HeroPrimary = Brand.accent;
const StatusGold = '#C49A2C';

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
    <View style={styles.card}>
      <View style={styles.statusLine}>
        <View style={styles.statusDot} />
        <Text style={styles.statusLineText}>IN PROGRESS · CONTINUE</Text>
      </View>

      <Text style={styles.name}>{jobCustomerName(job)}</Text>
      {job.jobNumber ? <Text style={styles.jobNumber}>{job.jobNumber}</Text> : null}
      <Text style={styles.address} numberOfLines={3}>
        {job.geocode?.formattedAddress?.trim() || jobAddressText(job) || 'No address on file'}
      </Text>
      <Text style={styles.date}>{jobDateLabel(job)}</Text>

      <Pressable
        disabled={opening}
        onPress={onOpen}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        {opening ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text style={styles.ctaText}>Continue inspection</Text>
            <Ionicons color="#FFFFFF" name="chevron-forward" size={18} />
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function JobsInProgressScreen() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const { openJob, openingJobId } = useOpenJob(setJobs);
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

  const inProgressJobs = useMemo(() => filterInProgressJobs(jobs), [jobs]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={inProgressJobs}
        keyExtractor={(job) => String(job.id)}
        refreshControl={
          <RefreshControl
            colors={[Brand.accent]}
            onRefresh={() => void loadJobs('refresh')}
            refreshing={refreshing}
            tintColor={Brand.accent}
          />
        }
        ListHeaderComponent={
          error ? (
            <Pressable onPress={() => void loadJobs('full')} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorRetry}>Tap to retry</Text>
            </Pressable>
          ) : (
            <Text style={styles.subtitle}>
              {loading
                ? 'Loading jobs…'
                : `${inProgressJobs.length} ${inProgressJobs.length === 1 ? 'job' : 'jobs'} in progress`}
            </Text>
          )
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Brand.accent} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons color={Brand.accent} name="clipboard-outline" size={28} />
              </View>
              <Text style={styles.emptyTitle}>No jobs in progress</Text>
              <Text style={styles.emptyText}>
                When you start an inspection, it will appear here until it is completed.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <InProgressJobCard
            job={item}
            onOpen={() => void openJob(item)}
            opening={openingJobId === String(item.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Brand.sheetBg,
    flex: 1,
  },
  list: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
  },
  subtitle: {
    color: Brand.muted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
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
  name: {
    color: '#1A1A1A',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  jobNumber: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  address: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  date: {
    color: Brand.soft,
    fontSize: 13,
    marginTop: 4,
  },
  cta: {
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
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
  spinner: {
    marginTop: 40,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 20,
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
