import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInspection } from '@/context/inspection-context';

const sections = [
  ['Property Information', 'Address and location confirmed'],
  ['Roof Inspection', 'Slope, roof type, and condition'],
  ['Photos', 'Document roof evidence'],
  ['Hail Test', 'Test-square impact calculation'],
  ['Damage', 'Damage type and location'],
  ['Checklist', 'Collateral property inspection'],
  ['Weather', 'Storm date verification'],
];

export default function InspectionScreen() {
  const router = useRouter();
  const { data } = useInspection();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.address}>{data.address}</Text>
        <Text style={styles.subtitle}>Work through each section to create a complete inspection record.</Text>
        {sections.map(([title, detail], index) => (
          <View key={title} style={styles.card}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <View style={styles.cardText}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text></View>
          </View>
        ))}
        <Pressable style={styles.submitButton} onPress={() => router.push('/roof-inspection')}>
          <Text style={styles.submitText}>Start Inspection</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  content: { padding: 20, paddingBottom: 34 },
  address: { color: '#163A4A', fontSize: 21, fontWeight: '800', lineHeight: 27, marginTop: 8 },
  subtitle: { color: '#70818A', fontSize: 14, lineHeight: 20, marginTop: 6 },
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', marginTop: 13, padding: 14 },
  number: { alignItems: 'center', backgroundColor: '#E4EFF2', borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 12, width: 36 },
  numberText: { color: '#163A4A', fontWeight: '800' },
  cardText: { flex: 1 },
  cardTitle: { color: '#163A4A', fontSize: 15, fontWeight: '800' },
  cardDetail: { color: '#70818A', fontSize: 13, marginTop: 3 },
  submitButton: { alignItems: 'center', backgroundColor: '#E17035', borderRadius: 12, marginTop: 28, padding: 16 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
