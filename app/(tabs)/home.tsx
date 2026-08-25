import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { fetchJobs, InspectionJob } from '@/lib/api';
import { loadCachedJobs, saveCachedJobs } from '@/lib/jobs-storage';

export default function HomeScreen() {
  const router = useRouter();
  const { user, token, companyName } = useAuth();
  const firstName = user?.profile?.firstName?.trim();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
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

  const scheduled = jobs.filter((job) => job.status === 'scheduled').length;
  const inProgress = jobs.filter((job) => {
    const key = job.status.toLowerCase();
    return key.includes('progress') || key.includes('inspect');
  }).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[Brand.accent]}
            onRefresh={() => void loadJobs('refresh')}
            refreshing={refreshing}
            tintColor={Brand.accent}
          />
        }
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoMark}>⌂</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>RoofCheck</Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              {companyName || 'Inspection workspace'}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroMarks}>
            <View style={[styles.heroCircle, styles.heroCircleLg]} />
            <View style={[styles.heroCircle, styles.heroCircleSm]} />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.hello}>{firstName ? `Hello, ${firstName}` : 'Hello'}</Text>
            {companyName ? (
              <Text style={styles.helloFrom} numberOfLines={2}>
                from {companyName}
              </Text>
            ) : null}
            <Text style={styles.heroTitle}>Ready for the field</Text>
            <Text style={styles.heroCopy}>
              Review today&apos;s assignments, open a job, and capture claim-ready evidence.
            </Text>
          </View>
        </View>

        {error ? (
          <Pressable onPress={() => void loadJobs('full')} style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>Today at a glance</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{loading ? '—' : String(jobs.length)}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{loading ? '—' : String(scheduled)}</Text>
            <Text style={styles.statLabel}>Scheduled</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{loading ? '—' : String(inProgress)}</Text>
            <Text style={styles.statLabel}>In progress</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <Pressable
          onPress={() => router.navigate('/jobs')}
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
        >
          <View style={styles.actionIcon}>
            <Ionicons color={Brand.accent} name="briefcase-outline" size={22} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>View jobs</Text>
            <Text style={styles.actionSub}>
              {loading
                ? 'Loading assignments...'
                : jobs.length === 1
                  ? '1 inspection assigned'
                  : `${jobs.length} inspections assigned`}
            </Text>
          </View>
          <Ionicons color={Brand.soft} name="chevron-forward" size={18} />
        </Pressable>

        <Pressable
          onPress={() => router.navigate('/profile')}
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
        >
          <View style={[styles.actionIcon, styles.actionIconMuted]}>
            <Ionicons color={Brand.ink} name="person-outline" size={22} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Inspector profile</Text>
            <Text style={styles.actionSub}>Account details and sign out</Text>
          </View>
          <Ionicons color={Brand.soft} name="chevron-forward" size={18} />
        </Pressable>

        {loading ? <ActivityIndicator color={Brand.accent} style={styles.spinner} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.background, flex: 1 },
  content: { paddingBottom: 28, paddingHorizontal: 20 },
  brandRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 18, marginTop: 6 },
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
  brandCopy: { flex: 1, minWidth: 0 },
  brand: { color: Brand.ink, fontSize: 17, fontWeight: '800' },
  brandSub: { color: Brand.soft, fontSize: 12, marginTop: 1 },
  hero: {
    backgroundColor: Brand.ink,
    borderRadius: 22,
    elevation: 6,
    marginBottom: 22,
    overflow: 'hidden',
    padding: 20,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  heroMarks: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCircle: {
    borderRadius: 999,
    position: 'absolute',
  },
  heroCircleLg: {
    backgroundColor: 'rgba(225, 112, 53, 0.22)',
    height: 120,
    right: -28,
    top: -18,
    width: 120,
  },
  heroCircleSm: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    bottom: -20,
    height: 84,
    right: 28,
    width: 84,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  hello: { color: '#C9D9DF', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  helloFrom: {
    color: '#C9D9DF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  heroTitle: { color: Brand.surface, fontSize: 26, fontWeight: '800', marginTop: 10 },
  heroCopy: { color: '#B7C9D0', fontSize: 14, lineHeight: 20, marginTop: 8 },
  sectionLabel: {
    color: Brand.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    elevation: 3,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statNumber: { color: Brand.ink, fontSize: 22, fontWeight: '800' },
  statLabel: { color: Brand.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  actionCard: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pressed: { opacity: 0.88 },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF4EE',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  actionIconMuted: { backgroundColor: '#E8EEF0' },
  actionCopy: { flex: 1 },
  actionTitle: { color: Brand.ink, fontSize: 16, fontWeight: '800' },
  actionSub: { color: Brand.muted, fontSize: 13, marginTop: 2 },
  spinner: { marginTop: 12 },
  errorBanner: {
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { color: Brand.danger, fontSize: 14, fontWeight: '700' },
  errorRetry: { color: '#8F3A32', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
