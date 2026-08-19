import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SectionTitle, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

function Options({ values, value, setValue }: { values: string[]; value: string; setValue: (value: string) => void }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map((entry) => <Pressable key={entry} onPress={() => setValue(entry)} style={[ui.option, { flexGrow: 1, flexBasis: '28%' }, value === entry && ui.optionSelected]}><Text style={[ui.optionText, value === entry && ui.optionTextSelected]}>{entry}</Text></Pressable>)}</View>;
}

export default function DamageScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const [type, setType] = useState(data.damageType);
  const [location, setLocation] = useState(data.damageLocation);
  const [severity, setSeverity] = useState(data.damageSeverity);
  const [notes, setNotes] = useState(data.damageNotes);
  const save = () => { update({ damageType: type, damageLocation: location, damageSeverity: severity, damageNotes: notes }); router.push('/checklist'); };
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Damage assessment</Text><Text style={ui.subtitle}>Tag visible damage and link it to your roof photos.</Text>
    <SectionTitle>Damage type</SectionTitle><Options values={['Hail', 'Wind', 'None']} value={type} setValue={setType} />
    <SectionTitle>Damage location</SectionTitle><Options values={['Front Slope', 'Rear Slope', 'Left Slope', 'Right Slope']} value={location} setValue={setLocation} />
    <SectionTitle>Severity</SectionTitle><Options values={['Minor', 'Moderate', 'Severe']} value={severity} setValue={setSeverity} />
    <SectionTitle>Damage details</SectionTitle><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Describe observed damage and related photos..." placeholderTextColor="#8A9AA3" style={[ui.input, { height: 100 }]} textAlignVertical="top" />
    <Text style={{ color: '#70818A', fontSize: 13, marginTop: 10 }}>Related photos: {data.photos.length}</Text>
    <View style={{ marginTop: 28 }}><PrimaryButton title="Save Damage" onPress={save} /></View>
  </ScrollView></SafeAreaView>;
}
