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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  fetchJobs,
  InspectionJob,
  jobAddressText,
  jobCoordinates,
  jobCustomerName,
  jobDateOfLoss,
  jobDateLabel,
  jobStatusLabel,
} from '@/lib/api';

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('progress')) {
    return { bg: '#FFF1E8', text: '#C45C28' };
  }
  if (key.includes('complete') || key.includes('submit')) {
    return { bg: '#E7F6EC', text: '#1F7A45' };
  }
  if (key.includes('cancel')) {
    return { bg: '#FDECEC', text: '#B42318' };
  }
  return { bg: '#E8F3F1', text: '#1B6B7A' };
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
    }
    setError('');

    try {
      setJobs(await fetchJobs(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load jobs');
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

  const countLabel = jobs.length === 1 ? '1 inspection' : `${jobs.length} inspections`;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoMark}>⌂</Text>
          </View>
          <View>
            <Text style={styles.brand}>RoofCheck</Text>
            <Text style={styles.brandSub}>Field inspections</Text>
          </View>
        </View>
      </View>
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
          <View>
            <View style={styles.hero}>
              <Text style={styles.hello}>{firstName ? `Hello, ${firstName}` : 'Hello'}</Text>
              <Text style={styles.heroTitle}>Your inspection day</Text>
              <Text style={[styles.heroCopy, error ? styles.error : null]}>
                {error
                  ? error
                  : loading
                    ? 'Loading your assigned jobs...'
                    : `${countLabel} assigned to you`}
              </Text>
              <View style={styles.statRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statNumber}>{loading ? '—' : String(jobs.length)}</Text>
                  <Text style={styles.statLabel}>Assigned</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statNumber}>
                    {loading ? '—' : String(jobs.filter((job) => job.status === 'scheduled').length)}
                  </Text>
                  <Text style={styles.statLabel}>Scheduled</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Assigned jobs</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Brand.accent} style={styles.emptySpinner} />
          ) : (
            <View style={styles.empty}>
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
            </View>
          )
        }
        renderItem={({ item }) => {
          const customer = jobCustomerName(item);
          const address = jobAddressText(item);
          const date = jobDateLabel(item);
          const status = jobStatusLabel(item.status);
          const tone = statusTone(item.status);

          return (
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.jobNumber}>{item.jobNumber || 'Inspection'}</Text>
                  <View style={[styles.status, { backgroundColor: tone.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: tone.text }]} />
                    <Text style={[styles.statusText, { color: tone.text }]}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.name}>{customer}</Text>
                <View style={styles.metaRow}>
                  <Ionicons color={Brand.accent} name="location-outline" size={16} />
                  <Text style={styles.address}>{address || 'No address'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons color="#8AA0A8" name="time-outline" size={16} />
                  <Text style={styles.date}>{date}</Text>
                </View>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

                <Pressable
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  onPress={() => {
                    const coords = jobCoordinates(item);
                    resetForJob({
                      jobId: item.id,
                      customer,
                      address: item.geocode?.formattedAddress?.trim() || address,
                      date,
                      jobStatus: status,
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
                  }}
                >
                  <Text style={styles.buttonText}>Start Inspection</Text>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={16} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.background, flex: 1 },
  listView: { flex: 1 },
  list: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
    paddingHorizontal: 20,
  },
  brandRow: { alignItems: 'center', flexDirection: 'row' },
  logo: {
    alignItems: 'center',
    backgroundColor: Brand.ink,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    marginRight: 10,
    width: 40,
  },
  logoMark: { color: Brand.surface, fontSize: 22, fontWeight: '700', marginTop: -2 },
  brand: { color: Brand.ink, fontSize: 17, fontWeight: '800' },
  brandSub: { color: Brand.soft, fontSize: 12, marginTop: 1 },
  hero: {
    backgroundColor: Brand.ink,
    borderRadius: 22,
    marginBottom: 22,
    padding: 20,
  },
  hello: { color: '#C9D9DF', fontSize: 14, fontWeight: '600' },
  heroTitle: { color: Brand.surface, fontSize: 26, fontWeight: '800', marginTop: 4 },
  heroCopy: { color: '#B7C9D0', fontSize: 14, lineHeight: 20, marginTop: 8 },
  error: { color: '#FFB4A8' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statNumber: { color: Brand.surface, fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#A9BDC5', fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionLabel: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
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
    borderRadius: 20,
    elevation: 3,
    flexDirection: 'row',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  cardAccent: { backgroundColor: Brand.accent, width: 5 },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  jobNumber: { color: Brand.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  status: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  statusText: { fontSize: 12, fontWeight: '800' },
  name: { color: Brand.ink, fontSize: 20, fontWeight: '800', marginTop: 10 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  address: { color: '#5B717A', flex: 1, fontSize: 14, lineHeight: 20 },
  date: { color: '#5B717A', fontSize: 13, fontWeight: '600' },
  notes: {
    backgroundColor: '#F6F8F9',
    borderRadius: 10,
    color: '#4E646D',
    fontSize: 13,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 13,
  },
  buttonPressed: { opacity: 0.88 },
  buttonText: { color: Brand.surface, fontSize: 15, fontWeight: '800' },
});
