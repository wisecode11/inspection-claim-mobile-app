import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useInspection } from '@/context/inspection-context';

export default function SummaryScreen() {
  const router = useRouter();
  const { data } = useInspection();
  const generateReport = () => router.push('/report');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>INSPECTION COMPLETE</Text>
        <Text style={styles.title}>Inspection Summary</Text>
        <Text style={styles.subtitle}>Review the details below before generating the report.</Text>

        <View style={styles.card}>
          <SummaryRow label="Customer" value={data.customer} />
          <SummaryRow label="Property" value={data.address} />
          <SummaryRow label="Inspection Date" value={data.date} />
          <SummaryRow label="Inspector" value="Alex Johnson" />
          <SummaryRow label="Photos Count" value={String(data.photos.length)} />
          <SummaryRow label="Damage Found" value={data.damageType} />
          <SummaryRow label="Hail Test Result" value={`${data.hailImpacts} impacts / ${data.hailArea} sq ft`} />
          <SummaryRow label="Collateral Damage" value={`${data.collateralDamage.length} items`} />
          <SummaryRow label="Weather Status" value={data.weatherStatus} />
          <SummaryRow label="Inspection Status" value="Submitted" last />
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable style={styles.button} onPress={generateReport}>
          <Text style={styles.buttonText}>Generate Report</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  content: { flex: 1, padding: 20 },
  eyebrow: { color: '#E17035', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  title: { color: '#163A4A', fontSize: 28, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#70818A', fontSize: 14, lineHeight: 20, marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 24, paddingHorizontal: 17 },
  row: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: '#70818A', fontSize: 14, marginRight: 16 },
  rowValue: { color: '#163A4A', flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  bottom: { backgroundColor: '#FFFFFF', borderTopColor: '#E3E9EB', borderTopWidth: 1, padding: 20 },
  button: { alignItems: 'center', backgroundColor: '#E17035', borderRadius: 12, padding: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
