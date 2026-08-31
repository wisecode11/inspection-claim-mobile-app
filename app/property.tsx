import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { LocationMap } from '@/components/location-map';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import { confirmJobLocation, formatLatitude, formatLongitude } from '@/lib/api';

const PageBg = '#F4F7F8';
const LabelMuted = '#9AA8B0';
const ConfirmedGreen = '#1B5E20';

const cardShadow = {
  elevation: 3,
  shadowColor: '#163A4A',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
};

function formatAddressDisplay(address: string) {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return { primary: address.trim() || 'No address on file', secondary: '' };
  }

  return {
    primary: parts.slice(0, 2).join(', '),
    secondary: parts.slice(2).join(', '),
  };
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <View style={styles.detailIcon}>
        <Ionicons color="#5C6F78" name={icon} size={17} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function PropertyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { data, update } = useInspection();
  const [pin, setPin] = useState({
    latitude: data.latitude,
    longitude: data.longitude,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPin({ latitude: data.latitude, longitude: data.longitude });
  }, [data.jobId]);

  const pinLat = pin.latitude;
  const pinLng = pin.longitude;
  const hasCoords = typeof pinLat === 'number' && typeof pinLng === 'number';
  const addressLines = formatAddressDisplay(data.address);
  const coordinates = hasCoords
    ? `${formatLatitude(pinLat)}, ${formatLongitude(pinLng)}`
    : '—';
  const isConfirmed = data.locationConfirmed;

  const onConfirm = async () => {
    if (!hasCoords || !data.jobId || !token) {
      Alert.alert(
        'Location missing',
        data.geocodeError ||
          'This address could not be mapped. Create the job with a real street address, then try again.',
      );
      return;
    }

    setSaving(true);
    try {
      const job = await confirmJobLocation(token, data.jobId, {
        latitude: pinLat,
        longitude: pinLng,
      });
      update({
        latitude: job.latitude ?? pinLat,
        longitude: job.longitude ?? pinLng,
        locationConfirmed: true,
      });
      Alert.alert('Location confirmed', 'This pin will be used for the inspection.');
    } catch (error) {
      Alert.alert('Could not confirm', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onStart = () => {
    if (!data.locationConfirmed) {
      Alert.alert('Confirm location first', 'Move the pin if needed, then tap Confirm location.');
      return;
    }
    router.push('/setup');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.propertyCard}>
          <View style={styles.addressBlock}>
            <View style={styles.addressTopRow}>
              <Text numberOfLines={2} style={styles.streetLine}>
                {addressLines.primary}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isConfirmed ? styles.statusConfirmed : styles.statusPending,
                ]}
              >
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{isConfirmed ? 'CONFIRMED' : 'PENDING'}</Text>
              </View>
            </View>
            {addressLines.secondary ? (
              <Text numberOfLines={2} style={styles.cityLine}>
                {addressLines.secondary}
              </Text>
            ) : null}
          </View>

          <View style={styles.mapDivider} />

          {typeof data.latitude === 'number' && typeof data.longitude === 'number' ? (
            <LocationMap
              key={data.jobId}
              embedded
              initialLatitude={data.latitude}
              initialLongitude={data.longitude}
              onMove={(coords) => {
                setPin(coords);
                update({ locationConfirmed: false });
              }}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons color={Brand.muted} name="map-outline" size={32} />
              <Text style={styles.fallbackTitle}>Address not mapped</Text>
              <Text style={styles.fallbackText}>
                {data.geocodeError ||
                  'Use a real street address when creating the job so latitude and longitude can be filled automatically.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.sectionTitle}>Inspection details</Text>
          </View>
          <DetailRow icon="person-outline" label="CUSTOMER" value={data.customer || '—'} />
          <DetailRow icon="compass-outline" label="COORDINATES" value={coordinates} />
          <DetailRow icon="document-text-outline" label="CLAIM" value={data.claimNumber || '—'} last />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          disabled={saving}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          onPress={() => void onConfirm()}
        >
          {saving ? (
            <ActivityIndicator color={Brand.ink} />
          ) : (
            <>
              <Ionicons color={Brand.ink} name="checkmark-circle-outline" size={19} />
              <Text style={styles.confirmText}>Confirm location</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          onPress={onStart}
        >
          <Text style={styles.startButtonText}>Start inspection</Text>
          <Ionicons color={Brand.surface} name="arrow-forward" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: PageBg, flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 12 },
  propertyCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...cardShadow,
  },
  addressBlock: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addressTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  streetLine: {
    color: Brand.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 23,
  },
  cityLine: {
    color: '#6B7B85',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 6,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusConfirmed: { backgroundColor: ConfirmedGreen },
  statusPending: { backgroundColor: '#B85A24' },
  statusDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mapDivider: {
    backgroundColor: '#EEF1F3',
    height: StyleSheet.hairlineWidth,
  },
  mapFallback: {
    alignItems: 'center',
    height: 260,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackTitle: { color: Brand.ink, fontSize: 16, fontWeight: '700' },
  fallbackText: { color: Brand.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  detailsCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...cardShadow,
  },
  detailsHeader: {
    borderBottomColor: '#EEF1F3',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  sectionTitle: {
    color: Brand.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  detailRowBorder: {
    borderBottomColor: '#EEF1F3',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F3F5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: {
    color: LabelMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  detailValue: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 3,
  },
  footer: {
    backgroundColor: PageBg,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.ink,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 14,
  },
  confirmText: { color: Brand.ink, fontSize: 15, fontWeight: '700' },
  startButton: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 14,
  },
  startButtonText: { color: Brand.surface, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.92 },
});
