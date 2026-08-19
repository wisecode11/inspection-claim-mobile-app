import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SectionTitle, ui } from '@/components/inspection-ui';
import { useInspection } from '@/context/inspection-context';

function SelectRow({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>{items.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[ui.option, value === item && ui.optionSelected]}><Text style={[ui.optionText, value === item && ui.optionTextSelected]}>{item}</Text></Pressable>)}</View>;
}

export default function RoofInspectionScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const [slope, setSlope] = useState(data.roofSlope);
  const [type, setType] = useState(data.roofType);
  const [condition, setCondition] = useState(data.roofCondition);
  const [notes, setNotes] = useState(data.roofNotes);

  const next = () => {
    update({ roofSlope: slope, roofType: type, roofCondition: condition, roofNotes: notes });
    router.push('/photos');
  };

  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>Roof inspection</Text><Text style={ui.subtitle}>Record the primary roof slope and its condition.</Text>
    <SectionTitle>Roof area / slope</SectionTitle><SelectRow items={['Front', 'Rear', 'Left', 'Right']} value={slope} onChange={setSlope} />
    <SectionTitle>Roof type</SectionTitle><SelectRow items={['Asphalt', 'Metal', 'Tile']} value={type === 'Asphalt Shingle' ? 'Asphalt' : type} onChange={(value) => setType(value === 'Asphalt' ? 'Asphalt Shingle' : value)} />
    <SectionTitle>Roof condition</SectionTitle><SelectRow items={['Good', 'Worn', 'Damaged']} value={condition} onChange={setCondition} />
    <SectionTitle>Notes</SectionTitle><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Add roof observations..." placeholderTextColor="#8A9AA3" style={[ui.input, { height: 110 }]} textAlignVertical="top" />
    <View style={{ marginTop: 28 }}><PrimaryButton title="Next: Photos" onPress={next} /></View>
  </ScrollView></SafeAreaView>;
}
