import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { LocationMap } from '@/components/location-map';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import { confirmJobLocation, formatLatitude, formatLongitude } from '@/lib/api';

export default function PropertyScreen() {
  const router = useRouter();
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

  const onConfirm = async () => {
    if (!hasCoords || !data.jobId || !token) {
      Alert.alert(
        'Location missing',
        data.geocodeError || 'This address could not be mapped. Create the job with a real street address, then try again.'
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
      Alert.alert('Confirm location first', 'Move the pin if needed, then tap Confirm Location.');
      return;
    }
    router.push('/setup');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PROPERTY LOCATION</Text>
        <Text style={styles.title}>{data.address}</Text>

        {typeof data.latitude === 'number' && typeof data.longitude === 'number' ? (
          <LocationMap
            key={data.jobId}
            initialLatitude={data.latitude}
            initialLongitude={data.longitude}
            onMove={(coords) => {
              setPin(coords);
              update({ locationConfirmed: false });
            }}
          />
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.fallbackTitle}>Address not mapped</Text>
            <Text style={styles.fallbackText}>
              {data.geocodeError || 'Use a real street address when creating the job so latitude and longitude can be filled automatically.'}
            </Text>
          </View>
        )}

        <View style={styles.details}>
          <Text style={styles.sectionTitle}>Property details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Customer</Text>
            <Text style={styles.rowValue}>{data.customer}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Latitude</Text>
            <Text style={styles.rowValue}>{formatLatitude(pinLat)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Longitude</Text>
            <Text style={styles.rowValue}>{formatLongitude(pinLng)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Location</Text>
            <Text style={styles.rowValue}>{data.locationConfirmed ? 'Confirmed' : 'Needs confirmation'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottom}>
        <Pressable disabled={saving} style={styles.confirmButton} onPress={() => void onConfirm()}>
          {saving ? (
            <ActivityIndicator color="#163A4A" />
          ) : (
            <Text style={styles.confirmText}>Confirm Location</Text>
          )}
        </Pressable>
        <Pressable style={styles.button} onPress={onStart}>
          <Text style={styles.buttonText}>Start Inspection</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  content: { flex: 1, padding: 20 },
  eyebrow: { color: '#E17035', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  title: { color: '#163A4A', fontSize: 25, fontWeight: '800', lineHeight: 32, marginTop: 7 },
  mapFallback: {
    backgroundColor: '#DDECEE',
    borderRadius: 16,
    height: 235,
    justifyContent: 'center',
    marginTop: 25,
    padding: 20,
  },
  fallbackTitle: { color: '#163A4A', fontSize: 16, fontWeight: '800' },
  fallbackText: { color: '#345560', fontSize: 14, lineHeight: 20, marginTop: 8 },
  details: { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 18, padding: 17 },
  sectionTitle: { color: '#163A4A', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  row: { borderTopColor: '#EDF1F2', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 },
  rowLabel: { color: '#70818A', fontSize: 14 },
  rowValue: { color: '#294954', fontSize: 14, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  bottom: { backgroundColor: '#FFFFFF', borderTopColor: '#E3E9EB', borderTopWidth: 1, gap: 10, padding: 20 },
  confirmButton: { alignItems: 'center', borderColor: '#163A4A', borderRadius: 12, borderWidth: 1, padding: 14 },
  confirmText: { color: '#163A4A', fontSize: 15, fontWeight: '800' },
  button: { alignItems: 'center', backgroundColor: '#E17035', borderRadius: 12, padding: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
