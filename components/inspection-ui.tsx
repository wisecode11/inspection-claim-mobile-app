import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}>;

/** Screen-level safe area wrapper — prefer this over RN SafeAreaView. */
export function Screen({ children, edges = ['bottom'], style }: ScreenProps) {
  return (
    <SafeAreaView style={[ui.screen, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function Page({ children }: PropsWithChildren) {
  return <Screen edges={['bottom']}>{children}</Screen>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function OutlineButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.outlineButton, disabled && styles.buttonDisabled]}
      onPress={onPress}
    >
      <Text style={styles.outlineButtonText}>{title}</Text>
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
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 34 },
  card: { backgroundColor: Brand.surface, borderRadius: 16, padding: 16 },
  title: { color: Brand.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: Brand.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  input: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 12,
    borderWidth: 1,
    color: Brand.ink,
    fontSize: 15,
    padding: 14,
  },
  option: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  optionSelected: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  optionText: { color: '#526A74', fontSize: 14, fontWeight: '700' },
  optionTextSelected: { color: Brand.surface },
});

const styles = StyleSheet.create({
  sectionTitle: { color: Brand.ink, fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 24 },
  button: { alignItems: 'center', backgroundColor: Brand.accent, borderRadius: Brand.buttonRadius, minHeight: 54, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  outlineButton: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.accent,
    borderRadius: Brand.buttonRadius,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: Brand.surface, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  outlineButtonText: { color: Brand.accent, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  infoRow: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: Brand.muted, fontSize: 14, marginRight: 15 },
  infoValue: { color: Brand.ink, flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});
