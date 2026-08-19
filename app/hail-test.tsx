import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SectionTitle, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

export default function HailTestScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const [area, setArea] = useState(data.hailArea);
  const [size, setSize] = useState(data.hailSize);
  const [impacts, setImpacts] = useState(data.hailImpacts);
  const [notes, setNotes] = useState(data.hailNotes);
  const result = `${impacts || '0'} impacts / ${area || '0'} sq ft`;
  const save = () => { update({ hailArea: area, hailSize: size, hailImpacts: impacts, hailNotes: notes }); router.push('/damage'); };
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Hail test square</Text><Text style={ui.subtitle}>Use the roof test square to document hail impact density.</Text>
    <SectionTitle>Test square area</SectionTitle><TextInput value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="100" placeholderTextColor="#8A9AA3" style={ui.input} />
    <SectionTitle>Hail size</SectionTitle><TextInput value={size} onChangeText={setSize} placeholder="e.g. 1 inch" placeholderTextColor="#8A9AA3" style={ui.input} />
    <SectionTitle>Hail impact count</SectionTitle><TextInput value={impacts} onChangeText={setImpacts} keyboardType="number-pad" placeholder="12" placeholderTextColor="#8A9AA3" style={ui.input} />
    <View style={[ui.card, { marginTop: 24 }]}><Text style={{ color: '#70818A', fontSize: 13 }}>RESULT</Text><Text style={{ color: '#163A4A', fontSize: 20, fontWeight: '800', marginTop: 5 }}>{result}</Text></View>
    <SectionTitle>Notes</SectionTitle><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Add hail test notes..." placeholderTextColor="#8A9AA3" style={[ui.input, { height: 95 }]} textAlignVertical="top" />
    <View style={{ marginTop: 28 }}><PrimaryButton title="Save Hail Test" onPress={save} /></View>
  </ScrollView></SafeAreaView>;
}
