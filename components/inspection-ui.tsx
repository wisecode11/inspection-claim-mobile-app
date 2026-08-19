import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function Page({ children }: PropsWithChildren) {
  return <View style={styles.page}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  content: { padding: 20, paddingBottom: 34 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  title: { color: '#163A4A', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#70818A', fontSize: 14, lineHeight: 20, marginTop: 6 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#D8E0E4', borderRadius: 12, borderWidth: 1, color: '#163A4A', fontSize: 15, padding: 14 },
  option: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E0E4', borderRadius: 10, borderWidth: 1, flex: 1, padding: 12 },
  optionSelected: { backgroundColor: '#163A4A', borderColor: '#163A4A' },
  optionText: { color: '#526A74', fontSize: 14, fontWeight: '700' },
  optionTextSelected: { color: '#FFFFFF' },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7F8' },
  sectionTitle: { color: '#163A4A', fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 24 },
  button: { alignItems: 'center', backgroundColor: '#E17035', borderRadius: 12, padding: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  infoRow: { borderBottomColor: '#EDF1F2', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: '#70818A', fontSize: 14, marginRight: 15 },
  infoValue: { color: '#163A4A', flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});
