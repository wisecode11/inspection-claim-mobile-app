import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

const items = ['Gutters', 'Downspouts', 'Siding', 'Windows', 'Screens', 'Exterior', 'Other collateral'];

export default function ChecklistScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const toggle = (item: string) => update({ collateralDamage: data.collateralDamage.includes(item) ? data.collateralDamage.filter((entry) => entry !== item) : [...data.collateralDamage, item] });
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Collateral checklist</Text><Text style={ui.subtitle}>Mark collateral items with damage. Notes and photos can be added later in the prototype.</Text>
    <View style={styles.card}>{items.map((item) => { const found = data.collateralDamage.includes(item); return <Pressable key={item} style={styles.row} onPress={() => toggle(item)}><View style={[styles.box, found && styles.boxFound]}><Text style={styles.check}>{found ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{item}</Text><Text style={styles.status}>{found ? 'Damage Found' : 'No Damage'}</Text></View></Pressable>; })}</View>
    <View style={{ marginTop: 28 }}><PrimaryButton title="Next: Weather Verification" onPress={() => router.push('/weather')} /></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 24, paddingHorizontal: 14 },
  row: { alignItems: 'center', borderBottomColor: '#EDF1F2', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 14 },
  box: { alignItems: 'center', borderColor: '#9DB0B7', borderRadius: 5, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  boxFound: { backgroundColor: '#E17035', borderColor: '#E17035' },
  check: { color: '#FFF', fontWeight: '800' },
  name: { color: '#163A4A', fontSize: 15, fontWeight: '800' },
  status: { color: '#70818A', fontSize: 13, marginTop: 2 },
});
