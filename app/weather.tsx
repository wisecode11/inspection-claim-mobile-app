import { useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoRow, PrimaryButton, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

export default function WeatherScreen() {
  const router = useRouter();
  const { data } = useInspection();
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Weather verification</Text><Text style={ui.subtitle}>Mock storm data matched against {data.address}.</Text>
    <View style={styles.verified}><Text style={styles.verifiedIcon}>✓</Text><View><Text style={styles.verifiedTitle}>Storm Date Verified</Text><Text style={styles.verifiedSub}>Mock weather lookup complete</Text></View></View>
    <View style={[ui.card, { marginTop: 18 }]}>
      <InfoRow label="Storm Date" value="July 3, 2026" />
      <InfoRow label="Weather" value="Storm Detected" />
      <InfoRow label="Hail" value="Hail Event Found" />
      <InfoRow label="Wind" value="34 mph" />
      <InfoRow label="Rain" value="0.82 in" />
      <InfoRow label="Storm Match" value="Verified" last />
    </View>
    <View style={{ marginTop: 28 }}><PrimaryButton title="Continue to Review" onPress={() => router.push('/review')} /></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  verified: { alignItems: 'center', backgroundColor: '#E5F3EB', borderRadius: 14, flexDirection: 'row', gap: 12, marginTop: 24, padding: 16 },
  verifiedIcon: { backgroundColor: '#3C8C5A', borderRadius: 15, color: '#FFF', fontWeight: '900', height: 30, paddingTop: 5, textAlign: 'center', width: 30 },
  verifiedTitle: { color: '#236540', fontSize: 16, fontWeight: '800' },
  verifiedSub: { color: '#4E7860', fontSize: 13, marginTop: 2 },
});
