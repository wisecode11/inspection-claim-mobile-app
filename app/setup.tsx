import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import { fetchWeatherVerification, verifyWeatherForJob } from '@/lib/api';
import { captureHref } from '@/lib/routes';

const SetupBg = '#F4F7F8';
const TextMuted = '#6B7B85';
const LabelMuted = '#9AA8B0';
const SetupAccent = '#C45A1F';

function shortAddress(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 64) return trimmed;

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return `${trimmed.slice(0, 61)}…`;
}

function weatherTone(status: string | null) {
  if (status === 'match') {
    return {
      cardBg: '#F3FBF6',
      cardBorder: '#C6E9D4',
      iconColor: '#1D6B3F',
      pillBg: '#1D6B3F',
    };
  }
  if (status === 'mismatch') {
    return {
      cardBg: '#FFF5F5',
      cardBorder: '#F0D0D0',
      iconColor: '#C0392B',
      pillBg: '#C0392B',
    };
  }
  if (status === 'inconclusive') {
    return {
      cardBg: '#FFF6F6',
      cardBorder: '#F0D4D4',
      iconColor: '#C0392B',
      pillBg: '#D4846A',
    };
  }
  return {
    cardBg: '#F8FAFB',
    cardBorder: '#E2E8EC',
    iconColor: TextMuted,
    pillBg: '#84949C',
  };
}

function weatherStatusLabel(status: string | null) {
  if (status === 'match') return 'VERIFIED';
  if (status === 'mismatch') return 'MISMATCH';
  if (status === 'inconclusive') return 'INCONCLUSIVE';
  return 'PENDING';
}

function formatUpdatedLabel(updatedAt: number | null, busy: boolean) {
  if (busy) return 'Checking…';
  if (!updatedAt) return 'Updated just now';
  const seconds = Math.floor((Date.now() - updatedAt) / 1000);
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return 'Updated earlier';
}

const cardShadow = {
  elevation: 2,
  shadowColor: '#163A4A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
};

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const display = value.trim() || '—';
  const empty = !value.trim();

  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, empty && styles.infoValueEmpty]}>{display}</Text>
      {!last ? <View style={styles.infoDivider} /> : null}
    </View>
  );
}

function SectionBlock({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons color={Brand.ink} name={icon} size={14} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { data, update } = useInspection();
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNote, setWeatherNote] = useState('');
  const [weatherError, setWeatherError] = useState('');
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!data.inspectorName && user?.profile) {
      const name = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ');
      if (name) update({ inspectorName: name });
    }
    if (!data.homeownerName && data.customer) {
      update({ homeownerName: data.customer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.jobId]);

  const runWeatherLookup = useCallback(
    async (force = false) => {
      if (!token || !data.jobId) {
        setWeatherNote('Log in and open a job to look up weather.');
        return;
      }

      if (!data.locationConfirmed && (data.latitude == null || data.longitude == null)) {
        setWeatherError('');
        setWeatherNote('Waiting for confirmed location');
        return;
      }

      if (!data.dateOfLoss) {
        setWeatherError('');
        setWeatherNote('Date of loss missing');
        return;
      }

      setWeatherBusy(true);
      setWeatherError('');
      setWeatherNote(force ? 'Refreshing storm data…' : 'Checking storm data…');

      try {
        const weather = force
          ? await verifyWeatherForJob(token, data.jobId, true)
          : await fetchWeatherVerification(token, data.jobId).catch(() =>
              verifyWeatherForJob(token, data.jobId, false),
            );

        update({
          weatherSummary: weather.summary,
          weatherMatchStatus: weather.matchStatus,
          weatherStatus: weather.summary.stormMatch || weather.summary.badgeTitle,
        });
        setWeatherNote('');
        setWeatherError('');
        setWeatherUpdatedAt(Date.now());
      } catch (error) {
        update({
          weatherSummary: null,
          weatherMatchStatus: 'inconclusive',
          weatherStatus: '',
        });
        const message = error instanceof Error ? error.message : 'Weather lookup failed';
        setWeatherNote('Weather unavailable');
        setWeatherError(message);
        setWeatherUpdatedAt(Date.now());
      } finally {
        setWeatherBusy(false);
      }
    },
    [
      token,
      data.jobId,
      data.locationConfirmed,
      data.latitude,
      data.longitude,
      data.dateOfLoss,
      update,
    ],
  );

  useEffect(() => {
    void runWeatherLookup(false);
  }, [runWeatherLookup]);

  const onContinue = () => {
    if (!data.address.trim() || !data.homeownerName.trim()) {
      Alert.alert('Required fields', 'Property address and homeowner name are required.');
      return;
    }
    update({ currentStepId: 'elevations' });
    router.push(captureHref('elevations'));
  };

  const tone = weatherTone(data.weatherMatchStatus);
  const dateOfLoss = data.dateOfLoss ? String(data.dateOfLoss).slice(0, 10) : '';
  const weatherMeta = data.weatherSummary
    ? `${data.weatherSummary.hail} · ${data.weatherSummary.wind} · ${data.weatherSummary.stormMatch}`
    : weatherNote || 'No Hail Event · — · Inconclusive';
  const updatedLabel = formatUpdatedLabel(weatherUpdatedAt, weatherBusy);
  const statusKey = data.weatherMatchStatus || 'inconclusive';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Review claim details before starting the 10-step field inspection.
        </Text>

        <View
          style={[
            styles.weatherCard,
            { backgroundColor: tone.cardBg, borderColor: tone.cardBorder },
          ]}
        >
          <View style={styles.weatherRow}>
            <View style={styles.weatherIconBox}>
              {weatherBusy ? (
                <ActivityIndicator color={tone.iconColor} size="small" />
              ) : (
                <Ionicons color={tone.iconColor} name="cloud-outline" size={20} />
              )}
            </View>

            <View style={styles.weatherCopy}>
              <View style={styles.weatherTitleRow}>
                <Text style={styles.weatherTitle}>Weather</Text>
                <View style={[styles.statusPill, { backgroundColor: tone.pillBg }]}>
                  <Text style={styles.statusPillText}>
                    {weatherStatusLabel(statusKey)}
                  </Text>
                </View>
              </View>
              <Text style={styles.weatherMeta}>{weatherMeta}</Text>
              <Text style={styles.weatherUpdated}>{updatedLabel}</Text>
              {weatherError ? <Text style={styles.weatherError}>{weatherError}</Text> : null}
            </View>

            <Pressable
              disabled={weatherBusy}
              hitSlop={10}
              style={({ pressed }) => [styles.weatherRefresh, pressed && styles.pressed]}
              onPress={() => void runWeatherLookup(true)}
            >
              <Ionicons color={LabelMuted} name="refresh-outline" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sections}>
          <SectionBlock icon="home-outline" title="PROPERTY">
            <InfoRow label="ADDRESS" value={shortAddress(data.address)} />
            <InfoRow label="HOMEOWNER" value={data.homeownerName} />
            <InfoRow label="INSPECTOR" value={data.inspectorName} last />
          </SectionBlock>

          <SectionBlock icon="id-card-outline" title="CONTACT">
            <InfoRow label="PHONE" value={data.phone} />
            <InfoRow label="EMAIL" value={data.email} last />
          </SectionBlock>

          <SectionBlock icon="document-text-outline" title="CLAIM">
            <InfoRow label="CLAIM #" value={data.claimNumber} />
            <InfoRow label="POLICY #" value={data.policyNumber} />
            <InfoRow label="DATE OF LOSS" value={dateOfLoss} last />
          </SectionBlock>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          onPress={onContinue}
        >
          <Text style={styles.startButtonText}>Start 10-step inspection</Text>
          <Ionicons color={Brand.surface} name="arrow-forward" size={17} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: SetupBg, flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  subtitle: {
    color: TextMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  weatherCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  weatherRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  weatherIconBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F0D4D4',
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  weatherCopy: { flex: 1, minWidth: 0 },
  weatherTitleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weatherTitle: { color: Brand.ink, fontSize: 14, fontWeight: '700' },
  statusPill: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  weatherMeta: { color: TextMuted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  weatherUpdated: { color: LabelMuted, fontSize: 10, marginTop: 3 },
  weatherError: { color: Brand.danger, fontSize: 10, lineHeight: 14, marginTop: 3 },
  weatherRefresh: { padding: 4 },
  sections: { gap: 24 },
  section: { gap: 8 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  sectionTitle: {
    color: Brand.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderColor: '#E8EDEF',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    ...cardShadow,
  },
  infoRow: { paddingBottom: 13, paddingTop: 13, position: 'relative' },
  infoRowLast: { paddingBottom: 13 },
  infoLabel: {
    color: LabelMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  infoValue: {
    color: Brand.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 3,
  },
  infoValueEmpty: { color: LabelMuted, fontWeight: '500' },
  infoDivider: {
    backgroundColor: '#E8EDEF',
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 2,
    position: 'absolute',
    right: 2,
  },
  footer: {
    backgroundColor: SetupBg,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: SetupAccent,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  startButtonText: { color: Brand.surface, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.92 },
});
