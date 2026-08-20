import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton, ui } from '@/components/inspection-ui';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import { fetchWeatherVerification, verifyWeatherForJob } from '@/lib/api';
import { captureHref } from '@/lib/routes';

function Field({
  label,
  value,
  onChangeText,
  required = false,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={ui.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A9AA3"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function weatherTone(status: string | null) {
  if (status === 'match') return { bg: '#E7F6EC', text: '#1F7A45', border: '#B7E0C4' };
  if (status === 'mismatch') return { bg: '#FDECEC', text: '#B42318', border: '#F2C4C0' };
  if (status === 'inconclusive') return { bg: '#FFF8E8', text: '#A15C00', border: '#F0D9A0' };
  return { bg: '#EEF3F5', text: '#526A74', border: '#D8E0E4' };
}

export default function SetupScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { data, update } = useInspection();
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNote, setWeatherNote] = useState('');
  const [weatherError, setWeatherError] = useState('');

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
        setWeatherError('Confirm the property pin first so weather can look up this address.');
        setWeatherNote('Waiting for confirmed location');
        return;
      }

      if (!data.dateOfLoss) {
        setWeatherError('This job needs a Date of Loss before storm matching can run.');
        setWeatherNote('Date of loss missing');
        return;
      }

      setWeatherBusy(true);
      setWeatherError('');
      setWeatherNote(force ? 'Refreshing hail / weather data…' : 'Looking up hail / weather data…');

      try {
        const weather = force
          ? await verifyWeatherForJob(token, data.jobId, true)
          : await fetchWeatherVerification(token, data.jobId).catch(() =>
              verifyWeatherForJob(token, data.jobId, false)
            );

        update({
          weatherSummary: weather.summary,
          weatherMatchStatus: weather.matchStatus,
          weatherStatus: weather.summary.stormMatch || weather.summary.badgeTitle,
        });
        setWeatherNote(weather.summary.badgeTitle || 'Weather data attached');
        setWeatherError('');
      } catch (error) {
        update({
          weatherSummary: null,
          weatherMatchStatus: 'no_data',
          weatherStatus: '',
        });
        const message =
          error instanceof Error ? error.message : 'Weather lookup failed';
        setWeatherNote('Weather unavailable — inspection can continue');
        setWeatherError(message);
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
    ]
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

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>CLAIMCAPTURE</Text>
        <Text style={ui.title}>Inspection setup</Text>
        <Text style={ui.subtitle}>
          Enter once — this fills the Evidence Package cover, summary, and existing conditions.
        </Text>

        <View style={[styles.weatherCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <View style={styles.weatherRow}>
            {weatherBusy ? <ActivityIndicator color="#E17035" /> : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.weatherText, { color: tone.text }]}>
                {weatherNote || 'Weather lookup idle'}
              </Text>
              {data.weatherSummary ? (
                <Text style={styles.weatherSub}>
                  {data.weatherSummary.hail} · {data.weatherSummary.wind} ·{' '}
                  {data.weatherSummary.stormMatch}
                </Text>
              ) : null}
              {weatherError ? <Text style={styles.weatherErr}>{weatherError}</Text> : null}
            </View>
          </View>
          <Pressable
            disabled={weatherBusy}
            style={styles.retry}
            onPress={() => void runWeatherLookup(true)}
          >
            <Text style={styles.retryText}>{weatherBusy ? 'Checking…' : 'Retry weather'}</Text>
          </Pressable>
        </View>

        <Field
          label="Property address"
          required
          value={data.address}
          onChangeText={(address) => update({ address })}
        />
        <Field
          label="Homeowner name"
          required
          value={data.homeownerName}
          onChangeText={(homeownerName) => update({ homeownerName })}
        />
        <Field
          label="Inspector name"
          value={data.inspectorName}
          onChangeText={(inspectorName) => update({ inspectorName })}
        />
        <Field
          label="Phone"
          value={data.phone}
          onChangeText={(phone) => update({ phone })}
          keyboardType="phone-pad"
        />
        <Field
          label="Email"
          value={data.email}
          onChangeText={(email) => update({ email })}
          keyboardType="email-address"
        />
        <Field
          label="Claim number"
          value={data.claimNumber}
          onChangeText={(claimNumber) => update({ claimNumber })}
        />
        <Field
          label="Policy number"
          value={data.policyNumber}
          onChangeText={(policyNumber) => update({ policyNumber })}
        />
        <Field
          label="Date of loss"
          value={data.dateOfLoss ? String(data.dateOfLoss).slice(0, 10) : ''}
          onChangeText={(dateOfLoss) => update({ dateOfLoss: dateOfLoss || null })}
          placeholder="YYYY-MM-DD"
        />
        <Field
          label="Estimated roof age"
          value={data.estimatedRoofAge}
          onChangeText={(estimatedRoofAge) => update({ estimatedRoofAge })}
          placeholder="e.g. 12 years"
        />

        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Start 10-Step Inspection" onPress={onContinue} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: { color: '#E17035', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  field: { marginTop: 14 },
  label: { color: '#526A74', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  weatherCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  weatherRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  weatherText: { fontSize: 14, fontWeight: '800' },
  weatherSub: { color: '#526A74', fontSize: 13, marginTop: 6 },
  weatherErr: { color: '#8A4B3A', fontSize: 12, lineHeight: 17, marginTop: 6 },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: '#163A4A',
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
