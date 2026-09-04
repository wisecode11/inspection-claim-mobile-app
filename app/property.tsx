import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { LocationMap } from '@/components/location-map';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import { confirmJobLocation, formatLatitude, formatLongitude } from '@/lib/api';

const HeroPrimary = Brand.accent;
const BodyBg = Brand.sheetBg;
const LabelMuted = '#9AA8B0';
const ConfirmedGreen = '#1B5E20';
const MAP_OVERLAP = 28;

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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
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

function RowDivider() {
  return <View style={styles.rowDivider} />;
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
  const [confirmedOpen, setConfirmedOpen] = useState(false);

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
      setConfirmedOpen(true);
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
      <View style={styles.mapHero}>
        {hasCoords ? (
          <LocationMap
            key={data.jobId}
            hero
            initialLatitude={data.latitude!}
            initialLongitude={data.longitude!}
            onMove={(coords) => {
              setPin(coords);
              update({ locationConfirmed: false });
            }}
          />
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons color={Brand.muted} name="map-outline" size={36} />
            <Text style={styles.fallbackTitle}>Address not mapped</Text>
            <Text style={styles.fallbackText}>
              {data.geocodeError ||
                'Use a real street address when creating the job so latitude and longitude can be filled automatically.'}
            </Text>
          </View>
        )}

        <View
          pointerEvents="none"
          style={[styles.headerFade, { height: insets.top + 104 }]}
        >
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="propertyHeaderFade" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={HeroPrimary} stopOpacity="0.92" />
                <Stop offset="0.42" stopColor={HeroPrimary} stopOpacity="0.62" />
                <Stop offset="0.72" stopColor={HeroPrimary} stopOpacity="0.28" />
                <Stop offset="1" stopColor={HeroPrimary} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#propertyHeaderFade)" height="100%" width="100%" />
          </Svg>
        </View>
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Ionicons color="#FFFFFF" name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Property Details</Text>
          <Pressable accessibilityRole="button" hitSlop={10} style={styles.headerBtn}>
            <Ionicons color="#FFFFFF" name="ellipsis-vertical" size={20} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bodySheet, { marginTop: -MAP_OVERLAP }]}>
        <View style={styles.sheetHandle} />

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
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
              <Text numberOfLines={3} style={styles.cityLine}>
                {addressLines.secondary}
              </Text>
            ) : data.address && data.address.trim() !== addressLines.primary ? (
              <Text numberOfLines={3} style={styles.cityLine}>
                {data.address}
              </Text>
            ) : null}
          </View>

          <View style={styles.detailsCard}>
            <DetailRow icon="person-outline" label="CUSTOMER" value={data.customer || '—'} />
            <RowDivider />
            <DetailRow icon="compass-outline" label="COORDINATES" value={coordinates} />
            <RowDivider />
            <DetailRow
              icon="document-text-outline"
              label="CLAIM"
              value={data.claimNumber || '—'}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            disabled={saving}
            onPress={() => void onConfirm()}
            style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          >
            {saving ? (
              <ActivityIndicator color={HeroPrimary} />
            ) : (
              <>
                <Ionicons color={HeroPrimary} name="checkmark-circle-outline" size={19} />
                <Text style={styles.confirmText}>Confirm location</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onStart}
            style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          >
            <Text style={styles.startButtonText}>Start inspection</Text>
            <Ionicons color="#FFFFFF" name="chevron-forward" size={18} />
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={confirmedOpen}
        onRequestClose={() => setConfirmedOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons color={ConfirmedGreen} name="checkmark-circle" size={30} />
            </View>
            <Text style={styles.modalTitle}>Location confirmed</Text>
            <Text style={styles.modalCopy}>
              This pin will be used for the inspection. You can start when you are ready.
            </Text>
            <Pressable
              onPress={() => setConfirmedOpen(false)}
              style={({ pressed }) => [styles.modalButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BodyBg,
    flex: 1,
  },
  mapHero: {
    height: '42%',
    minHeight: 280,
    position: 'relative',
  },
  mapFallback: {
    alignItems: 'center',
    backgroundColor: '#DDECEE',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  fallbackTitle: {
    color: HeroPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  fallbackText: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  headerFade: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  headerOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  headerBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    elevation: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D1C9BE',
    borderRadius: 3,
    height: 4,
    marginBottom: 20,
    marginTop: 12,
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  addressBlock: {
    marginBottom: 18,
  },
  addressTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  streetLine: {
    color: HeroPrimary,
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  cityLine: {
    color: '#6B7B85',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 8,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusConfirmed: {
    backgroundColor: ConfirmedGreen,
  },
  statusPending: {
    backgroundColor: HeroPrimary,
  },
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
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBE6DF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDivider: {
    backgroundColor: '#E5E0D8',
    height: 1,
    marginHorizontal: 16,
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F3F5',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: LabelMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  detailValue: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 3,
  },
  footer: {
    backgroundColor: BodyBg,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: HeroPrimary,
    borderRadius: Brand.buttonRadiusLg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 14,
  },
  confirmText: {
    color: HeroPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadiusLg,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 14,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.92,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 58, 66, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 22,
    padding: 22,
    width: '100%',
  },
  modalIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(27, 94, 32, 0.12)',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  modalTitle: {
    color: Brand.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalCopy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: HeroPrimary,
    borderRadius: Brand.buttonRadiusLg,
    marginTop: 22,
    paddingVertical: 14,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
