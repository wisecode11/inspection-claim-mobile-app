import { useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoRow, PrimaryButton, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

export default function ReviewScreen() {
  const router = useRouter();
  const { data } = useInspection();
  const hailResult = `${data.hailImpacts} impacts / ${data.hailArea} sq ft`;
  const submit = () => Alert.alert('Inspection submitted successfully.', 'Your inspection is ready for final summary.', [{ text: 'Continue', onPress: () => router.push('/summary') }]);
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Inspection review</Text><Text style={ui.subtitle}>Confirm the inspection record before submitting.</Text>
    <View style={[ui.card, { marginTop: 24 }]}>
      <InfoRow label="Customer" value={data.customer} /><InfoRow label="Property" value={data.address} /><InfoRow label="Photos" value={String(data.photos.length)} />
      <InfoRow label="Hail Test" value={hailResult} /><InfoRow label="Damage" value={`${data.damageType} • ${data.damageSeverity}`} />
      <InfoRow label="Collateral" value={`${data.collateralDamage.length} items damaged`} /><InfoRow label="Weather" value="Storm Verified" last />
    </View>
    <Pressable style={styles.edit} onPress={() => router.push('/roof-inspection')}><Text style={styles.editText}>Edit Inspection</Text></Pressable>
    <View style={{ marginTop: 12 }}><PrimaryButton title="Submit Inspection" onPress={submit} /></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  edit: { alignItems: 'center', borderColor: '#163A4A', borderRadius: 12, borderWidth: 1, marginTop: 28, padding: 15 },
  editText: { color: '#163A4A', fontWeight: '800' },
});
